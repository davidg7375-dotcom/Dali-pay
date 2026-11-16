-- DALI PAY — מיגרציה 1.2: תשלומים חלקיים, הודעות, מספר Bit, שיוך מוצרים.
-- בטוחה להרצה חוזרת (idempotent) ולא מוחקת ולא משנה נתונים קיימים.
-- הטבלה projects והעמודות project_id נשארות כפי שהן (רק לא מוצגות באפליקציה).

-- ───────────────────────── 1. מספר Bit למשתמש ─────────────────────────
alter table members add column if not exists bit_phone text;
alter table members drop constraint if exists members_bit_phone_chk;
alter table members add constraint members_bit_phone_chk
  check (bit_phone is null or bit_phone ~ '^05[0-9]{8}$');

-- משתמש יכול לעדכן רק את השם ואת מספר ה-Bit של עצמו (לא תפקיד ולא קבוצה)
revoke update on members from anon, authenticated;
grant update (display_name, bit_phone) on members to authenticated;
drop policy if exists members_update_self on members;
create policy members_update_self on members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ───────────────────────── 2. תשלומים חלקיים ─────────────────────────
alter table debts add column if not exists paid_by uuid;

create table if not exists debt_payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  debt_id uuid not null references debts(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 200),
  paid_by uuid,                                   -- מי סימן את התשלום (null = נתון מלפני העדכון)
  created_at timestamptz not null default now()
);
create index if not exists debt_payments_debt_idx on debt_payments (debt_id);
create index if not exists debt_payments_group_idx on debt_payments (group_id, created_at desc);

-- נתונים קיימים: חוב שסומן "שולם" לפני העדכון מקבל תשלום מלא אחד, כדי שהיתרה תישאר נכונה.
insert into debt_payments (group_id, debt_id, amount, note, paid_by, created_at)
select d.group_id, d.id, d.amount, 'נרשם לפני עדכון התשלומים', d.paid_by, coalesce(d.paid_at, d.updated_at)
from debts d
where d.status = 'paid'
  and not exists (select 1 from debt_payments p where p.debt_id = d.id);

alter table debt_payments enable row level security;
drop policy if exists debt_payments_select on debt_payments;
create policy debt_payments_select on debt_payments for select using (is_member(group_id));
-- אין מדיניות כתיבה: רישום ומחיקת תשלום רק דרך הפונקציות למטה
revoke insert, update, delete on debt_payments from anon, authenticated;

create or replace function record_payment(p_debt uuid, p_amount numeric, p_note text default '')
returns debt_payments language plpgsql security definer set search_path = public as $$
declare
  d debts; paid numeric; remaining numeric; amt numeric; pay debt_payments;
begin
  if auth.uid() is null then raise exception 'לא מחובר'; end if;
  select * into d from debts where id = p_debt for update;
  if not found or not is_member(d.group_id) then raise exception 'החוב לא נמצא'; end if;
  amt := round(p_amount, 2);
  if amt is null or amt <= 0 then raise exception 'סכום התשלום חייב להיות חיובי'; end if;
  select coalesce(sum(amount), 0) into paid from debt_payments where debt_id = d.id;
  remaining := d.amount - paid;
  if d.status = 'paid' or remaining <= 0 then raise exception 'החוב כבר שולם במלואו'; end if;
  if amt > remaining then raise exception 'הסכום גבוה מיתרת החוב (%)', remaining; end if;
  insert into debt_payments (group_id, debt_id, amount, note, paid_by)
    values (d.group_id, d.id, amt, left(coalesce(p_note, ''), 200), auth.uid())
    returning * into pay;
  if amt = remaining then
    update debts set status = 'paid', paid_at = now(), paid_by = auth.uid() where id = d.id;
  end if;
  return pay;
end $$;

-- ביטול תשלום: מי שרשם אותו או מנהל הקבוצה. אם החוב היה סגור הוא נפתח מחדש.
create or replace function delete_payment(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  pay debt_payments; d debts; paid numeric;
begin
  if auth.uid() is null then raise exception 'לא מחובר'; end if;
  select * into pay from debt_payments where id = p_payment for update;
  if not found or not is_member(pay.group_id) then raise exception 'התשלום לא נמצא'; end if;
  if pay.paid_by is distinct from auth.uid() and not is_owner(pay.group_id) then
    raise exception 'רק מי שרשם את התשלום או מנהל הקבוצה יכולים לבטל אותו';
  end if;
  delete from debt_payments where id = pay.id;
  select * into d from debts where id = pay.debt_id for update;
  select coalesce(sum(amount), 0) into paid from debt_payments where debt_id = d.id;
  if d.status = 'paid' and paid < d.amount then
    update debts set status = 'open', paid_at = null, paid_by = null where id = d.id;
  end if;
end $$;

revoke execute on function record_payment(uuid, numeric, text) from public, anon;
revoke execute on function delete_payment(uuid) from public, anon;
grant execute on function record_payment(uuid, numeric, text) to authenticated;
grant execute on function delete_payment(uuid) to authenticated;

-- שמירה על עקביות: אי אפשר להוריד את סכום החוב מתחת למה ששולם, ואי אפשר להחליף כיוון/קבוצה אחרי תשלום.
create or replace function debts_guard() returns trigger language plpgsql as $$
declare paid numeric;
begin
  if new.group_id <> old.group_id then raise exception 'אי אפשר להעביר חוב לקבוצה אחרת'; end if;
  select coalesce(sum(amount), 0) into paid from debt_payments where debt_id = old.id;
  if paid > 0 then
    if new.creditor_id <> old.creditor_id or new.debtor_id <> old.debtor_id then
      raise exception 'אי אפשר להחליף את הצדדים בחוב שכבר שולם בו חלק';
    end if;
    if new.amount < paid then
      raise exception 'סכום החוב לא יכול להיות נמוך ממה ששולם כבר (%)', paid;
    end if;
    if new.amount = paid and new.status <> 'paid' then
      new.status := 'paid'; new.paid_at := coalesce(new.paid_at, now()); new.paid_by := coalesce(new.paid_by, auth.uid());
    elsif new.amount > paid and new.status = 'paid' and old.amount = paid then
      new.status := 'open'; new.paid_at := null; new.paid_by := null;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists debts_guard_trg on debts;
create trigger debts_guard_trg before update on debts for each row execute function debts_guard();

-- ───────────────────────── 3. מוצרים: אצל מי ולמי + מי מסר ומתי ─────────────────────────
alter table products add column if not exists holder_id uuid;      -- אצל מי המוצר נמצא
alter table products add column if not exists receiver_id uuid;    -- מי אמור לקבל אותו
alter table products add column if not exists delivered_at timestamptz;
alter table products add column if not exists delivered_by uuid;

create or replace function products_delivery() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.delivered then new.delivered_at := coalesce(new.delivered_at, now()); new.delivered_by := coalesce(new.delivered_by, auth.uid()); end if;
  elsif new.delivered and not old.delivered then
    new.delivered_at := now(); new.delivered_by := auth.uid();
  elsif not new.delivered and old.delivered then
    new.delivered_at := null; new.delivered_by := null;
  end if;
  return new;
end $$;
drop trigger if exists products_delivery_trg on products;
create trigger products_delivery_trg before insert or update on products for each row execute function products_delivery();

-- אצל מי / למי חייבים להיות חברים באותה קבוצה
drop policy if exists products_insert on products;
create policy products_insert on products for insert with check (
  is_member(group_id)
  and (holder_id is null or exists (select 1 from members m where m.group_id = products.group_id and m.user_id = products.holder_id))
  and (receiver_id is null or exists (select 1 from members m where m.group_id = products.group_id and m.user_id = products.receiver_id))
);
drop policy if exists products_update on products;
create policy products_update on products for update
  using (is_member(group_id))
  with check (
    is_member(group_id)
    and (holder_id is null or exists (select 1 from members m where m.group_id = products.group_id and m.user_id = products.holder_id))
    and (receiver_id is null or exists (select 1 from members m where m.group_id = products.group_id and m.user_id = products.receiver_id))
  );

-- ───────────────────────── 4. הודעות אישיות ─────────────────────────
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  sender_id uuid not null default auth.uid(),
  recipient_id uuid not null,
  kind text not null default 'message' check (kind in ('message', 'payment_request')),
  body text not null default '' check (char_length(body) <= 500),
  sticker text check (sticker is null or sticker ~ '^[a-z0-9_]{1,40}$'),
  debt_id uuid references debts(id) on delete set null,
  amount numeric(12, 2),
  push_status text not null default 'pending'
    check (push_status in ('pending', 'sent', 'no_device', 'failed', 'not_configured')),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id),
  check (char_length(body) > 0 or sticker is not null)
);
create index if not exists messages_group_idx on messages (group_id, created_at desc);

alter table messages enable row level security;

-- רק השולח והנמען רואים הודעה
drop policy if exists messages_select on messages;
create policy messages_select on messages for select using (
  is_member(group_id) and (sender_id = auth.uid() or recipient_id = auth.uid())
);

drop policy if exists messages_insert on messages;
create policy messages_insert on messages for insert with check (
  sender_id = auth.uid()
  and is_member(group_id)
  and exists (select 1 from members m where m.group_id = messages.group_id and m.user_id = messages.recipient_id)
  and (debt_id is null or exists (select 1 from debts d where d.id = messages.debt_id and d.group_id = messages.group_id))
  -- בקשת תשלום: רק מהנושה לחייב של אותו חוב
  and (kind <> 'payment_request' or exists (
        select 1 from debts d where d.id = messages.debt_id
          and d.creditor_id = messages.sender_id and d.debtor_id = messages.recipient_id))
);

-- הנמען בלבד יכול לסמן "נקרא"
drop policy if exists messages_update_read on messages;
create policy messages_update_read on messages for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

revoke insert, update, delete on messages from anon, authenticated;
grant insert (group_id, recipient_id, kind, body, sticker, debt_id, amount) on messages to authenticated;
grant update (read_at) on messages to authenticated;

-- ───────────────────────── 5. מכשירים להתראות Push ─────────────────────────
create table if not exists device_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
alter table device_tokens enable row level security;
drop policy if exists device_tokens_select_own on device_tokens;
create policy device_tokens_select_own on device_tokens for select using (user_id = auth.uid());
revoke all on device_tokens from anon, authenticated;
grant select on device_tokens to authenticated;

create or replace function register_device(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'לא מחובר'; end if;
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 1024 then raise exception 'טוקן לא תקין'; end if;
  insert into device_tokens (token, user_id, platform) values (p_token, auth.uid(), 'android')
    on conflict (token) do update set user_id = auth.uid(), updated_at = now();
end $$;

create or replace function unregister_device(p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  delete from device_tokens where token = p_token and user_id = auth.uid();
end $$;

revoke execute on function register_device(text) from public, anon;
revoke execute on function unregister_device(text) from public, anon;
grant execute on function register_device(text) to authenticated;
grant execute on function unregister_device(text) to authenticated;

-- ───────────────────────── 6. סנכרון בזמן אמת ─────────────────────────
alter table debt_payments replica identity full;
alter table messages replica identity full;
do $$
begin
  begin alter publication supabase_realtime add table debt_payments; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table messages; exception when duplicate_object then null; end;
end $$;
