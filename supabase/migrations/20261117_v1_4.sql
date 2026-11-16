-- DALI PAY — מיגרציה 1.4: קישור Bit אישי, בחירת דמות, אישור תשלום רק ע"י המקבל, יומן פעולות.
-- תוספת בלבד: לא מוחקת טבלאות, עמודות או נתונים. בטוחה להרצה חוזרת (idempotent).
-- להריץ פעם אחת ב-Supabase: SQL Editor -> New query -> הדבקה -> Run.

-- ───────────────────────── 1. פרופיל: קישור Bit ודמות ─────────────────────────
alter table members add column if not exists bit_link text;
alter table members add column if not exists avatar text;
alter table members drop constraint if exists members_bit_link_chk;
alter table members add constraint members_bit_link_chk
  check (bit_link is null or (bit_link ~ '^https://[^\s<>"'']+$' and char_length(bit_link) <= 300));
alter table members drop constraint if exists members_avatar_chk;
alter table members add constraint members_avatar_chk check (avatar is null or avatar in ('a', 'b'));
-- כל משתמש מעדכן רק את השורה של עצמו (המדיניות members_update_self קיימת מ-1.2)
grant update (display_name, bit_phone, bit_link, avatar) on members to authenticated;

-- ───────────────────────── 2. רק המקבל מאשר תשלום ─────────────────────────
create or replace function record_payment(p_debt uuid, p_amount numeric, p_note text default '')
returns debt_payments language plpgsql security definer set search_path = public as $$
declare
  d debts; paid numeric; remaining numeric; amt numeric; pay debt_payments;
begin
  if auth.uid() is null then raise exception 'לא מחובר'; end if;
  select * into d from debts where id = p_debt for update;
  if not found or not is_member(d.group_id) then raise exception 'החוב לא נמצא'; end if;
  if d.creditor_id <> auth.uid() then
    raise exception 'רק מי שמקבל את הכסף יכול לאשר תשלום ולסגור את החוב';
  end if;
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

create or replace function delete_payment(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  pay debt_payments; d debts; paid numeric;
begin
  if auth.uid() is null then raise exception 'לא מחובר'; end if;
  select * into pay from debt_payments where id = p_payment for update;
  if not found or not is_member(pay.group_id) then raise exception 'התשלום לא נמצא'; end if;
  select * into d from debts where id = pay.debt_id for update;
  if d.creditor_id <> auth.uid() then
    raise exception 'רק מי שמקבל את הכסף יכול לבטל תשלום';
  end if;
  delete from debt_payments where id = pay.id;
  select coalesce(sum(amount), 0) into paid from debt_payments where debt_id = d.id;
  if d.status = 'paid' and paid < d.amount then
    update debts set status = 'open', paid_at = null, paid_by = null where id = d.id;
  end if;
end $$;

revoke execute on function record_payment(uuid, numeric, text) from public, anon;
revoke execute on function delete_payment(uuid) from public, anon;
grant execute on function record_payment(uuid, numeric, text) to authenticated;
grant execute on function delete_payment(uuid) to authenticated;

-- חוב: החייב לא יכול לסגור, להקטין סכום או להחליף צדדים. רק המקבל.
-- (auth.uid() ריק = הרצה מה-SQL Editor / שרת, ואז אין הגבלה)
create or replace function debts_perm() returns trigger language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    if new.status = 'paid' and new.creditor_id <> auth.uid() then
      raise exception 'רק מי שמקבל את הכסף יכול לסמן חוב כשולם';
    end if;
    return new;
  end if;
  if old.creditor_id <> auth.uid() then
    if new.status = 'paid' and old.status <> 'paid' then
      raise exception 'רק מי שמקבל את הכסף יכול לסמן חוב כשולם';
    end if;
    if new.amount < old.amount then
      raise exception 'רק מי שמקבל את הכסף יכול להקטין את סכום החוב';
    end if;
    if new.creditor_id <> old.creditor_id or new.debtor_id <> old.debtor_id then
      raise exception 'רק מי שמקבל את הכסף יכול לשנות את כיוון החוב';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists debts_perm_trg on debts;
-- השם מתחיל ב-a כדי לרוץ לפני debts_guard_trg (טריגרים רצים לפי סדר אלפביתי)
drop trigger if exists a_debts_perm_trg on debts;
create trigger a_debts_perm_trg before insert or update on debts for each row execute function debts_perm();

-- מחיקת חוב = ויתור עליו, לכן רק המקבל
drop policy if exists debts_delete on debts;
create policy debts_delete on debts for delete using (is_member(group_id) and creditor_id = auth.uid());

-- ───────────────────────── 3. יומן פעולות (להיסטוריה) ─────────────────────────
create table if not exists activity (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  actor_id uuid,                     -- מי ביצע (null = מערכת / נתון ישן)
  kind text not null,                -- debt_add, debt_edit, debt_closed, debt_reopened, debt_delete, payment, payment_cancel, product_add, product_edit, product_delivered, product_delete
  entity_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_group_idx on activity (group_id, created_at desc);
alter table activity enable row level security;
drop policy if exists activity_select on activity;
create policy activity_select on activity for select using (is_member(group_id));
-- כתיבה רק מטריגרים (security definer). אין כתיבה ישירה מהאפליקציה.
revoke insert, update, delete on activity from anon, authenticated;

create or replace function log_debt() returns trigger language plpgsql security definer set search_path = public as $$
declare k text; r debts;
begin
  if tg_op = 'DELETE' then r := old; k := 'debt_delete';
  elsif tg_op = 'INSERT' then r := new; k := 'debt_add';
  else
    r := new;
    if new.status = 'paid' and old.status <> 'paid' then k := 'debt_closed';
    elsif new.status = 'open' and old.status = 'paid' then k := 'debt_reopened';
    elsif new.amount is distinct from old.amount or new.description is distinct from old.description
       or new.creditor_id is distinct from old.creditor_id or new.debtor_id is distinct from old.debtor_id
       or new.created_at is distinct from old.created_at then k := 'debt_edit';
    else return null; end if;
  end if;
  insert into activity (group_id, actor_id, kind, entity_id, data) values (r.group_id, auth.uid(), k, r.id,
    jsonb_build_object('amount', r.amount, 'description', r.description, 'creditor_id', r.creditor_id, 'debtor_id', r.debtor_id)
    || case when tg_op = 'UPDATE' and new.amount is distinct from old.amount then jsonb_build_object('old_amount', old.amount) else '{}'::jsonb end);
  return null;
end $$;
drop trigger if exists log_debt_trg on debts;
create trigger log_debt_trg after insert or update or delete on debts for each row execute function log_debt();

create or replace function log_payment() returns trigger language plpgsql security definer set search_path = public as $$
declare r debt_payments; d debts;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;
  select * into d from debts where id = r.debt_id;
  insert into activity (group_id, actor_id, kind, entity_id, data) values (r.group_id, auth.uid(),
    case when tg_op = 'DELETE' then 'payment_cancel' else 'payment' end, r.debt_id,
    jsonb_build_object('amount', r.amount, 'description', coalesce(d.description, ''), 'creditor_id', d.creditor_id, 'debtor_id', d.debtor_id, 'debt_amount', d.amount));
  return null;
end $$;
drop trigger if exists log_payment_trg on debt_payments;
create trigger log_payment_trg after insert or delete on debt_payments for each row execute function log_payment();

create or replace function log_product() returns trigger language plpgsql security definer set search_path = public as $$
declare k text; r products;
begin
  if tg_op = 'DELETE' then r := old; k := 'product_delete';
  elsif tg_op = 'INSERT' then r := new; k := 'product_add';
  else
    r := new;
    if new.delivered and not old.delivered then k := 'product_delivered';
    elsif new.name is distinct from old.name or new.quantity is distinct from old.quantity
       or new.holder_id is distinct from old.holder_id or new.receiver_id is distinct from old.receiver_id then k := 'product_edit';
    else return null; end if;
  end if;
  insert into activity (group_id, actor_id, kind, entity_id, data) values (r.group_id, auth.uid(), k, r.id,
    jsonb_build_object('name', r.name, 'quantity', r.quantity, 'holder_id', r.holder_id, 'receiver_id', r.receiver_id));
  return null;
end $$;
drop trigger if exists log_product_trg on products;
create trigger log_product_trg after insert or update or delete on products for each row execute function log_product();

-- מילוי ראשוני מהנתונים הקיימים (פעם אחת בלבד, רק אם היומן ריק)
do $$
begin
  if not exists (select 1 from activity) then
    insert into activity (group_id, actor_id, kind, entity_id, data, created_at)
      select group_id, created_by, 'debt_add', id,
             jsonb_build_object('amount', amount, 'description', description, 'creditor_id', creditor_id, 'debtor_id', debtor_id), created_at
      from debts;
    insert into activity (group_id, actor_id, kind, entity_id, data, created_at)
      select p.group_id, p.paid_by, 'payment', p.debt_id,
             jsonb_build_object('amount', p.amount, 'description', d.description, 'creditor_id', d.creditor_id, 'debtor_id', d.debtor_id, 'debt_amount', d.amount), p.created_at
      from debt_payments p join debts d on d.id = p.debt_id;
    insert into activity (group_id, actor_id, kind, entity_id, data, created_at)
      select group_id, paid_by, 'debt_closed', id,
             jsonb_build_object('amount', amount, 'description', description, 'creditor_id', creditor_id, 'debtor_id', debtor_id), coalesce(paid_at, updated_at)
      from debts where status = 'paid';
    insert into activity (group_id, actor_id, kind, entity_id, data, created_at)
      select group_id, created_by, 'product_add', id,
             jsonb_build_object('name', name, 'quantity', quantity, 'holder_id', holder_id, 'receiver_id', receiver_id), created_at
      from products;
    insert into activity (group_id, actor_id, kind, entity_id, data, created_at)
      select group_id, delivered_by, 'product_delivered', id,
             jsonb_build_object('name', name, 'quantity', quantity, 'holder_id', holder_id, 'receiver_id', receiver_id), coalesce(delivered_at, updated_at)
      from products where delivered;
  end if;
end $$;

-- ───────────────────────── 4. סנכרון בזמן אמת ─────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table activity; exception when duplicate_object then null; end;
end $$;
