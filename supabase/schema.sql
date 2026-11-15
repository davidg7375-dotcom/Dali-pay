-- DALI PAY — סכמת בסיס הנתונים (Supabase / PostgreSQL)
-- להריץ פעם אחת ב-Supabase: SQL Editor -> New query -> Run

create extension if not exists pgcrypto;

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  created_at timestamptz not null default now()
);

create table if not exists members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  creditor_id uuid not null,
  debtor_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  description text not null default '',
  status text not null default 'open' check (status in ('open', 'paid')),
  paid_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (creditor_id <> debtor_id)
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  name text not null,
  quantity integer not null default 1 check (quantity >= 0),
  delivered boolean not null default false,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists debts_touch on debts;
create trigger debts_touch before update on debts for each row execute function touch_updated_at();
drop trigger if exists products_touch on products;
create trigger products_touch before update on products for each row execute function touch_updated_at();

-- פונקציות עזר להרשאות
create or replace function is_member(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where group_id = g and user_id = auth.uid())
$$;

create or replace function is_owner(g uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from members where group_id = g and user_id = auth.uid() and role = 'owner')
$$;

-- יצירת קבוצה והצטרפות עם קוד הזמנה
create or replace function create_group(p_name text, p_display text) returns groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'לא מחובר'; end if;
  insert into groups (name) values (p_name) returning * into g;
  insert into members (group_id, user_id, display_name, role) values (g.id, auth.uid(), p_display, 'owner');
  return g;
end $$;

create or replace function join_group(p_code text, p_display text) returns groups
language plpgsql security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then raise exception 'לא מחובר'; end if;
  select * into g from groups where invite_code = lower(trim(p_code));
  if not found then raise exception 'קוד הזמנה לא תקין'; end if;
  insert into members (group_id, user_id, display_name) values (g.id, auth.uid(), p_display)
    on conflict (group_id, user_id) do update set display_name = excluded.display_name;
  return g;
end $$;

-- אבטחה ברמת שורה (RLS)
alter table groups enable row level security;
alter table members enable row level security;
alter table projects enable row level security;
alter table debts enable row level security;
alter table products enable row level security;

drop policy if exists groups_select on groups;
create policy groups_select on groups for select using (is_member(id));

drop policy if exists members_select on members;
create policy members_select on members for select using (is_member(group_id));

drop policy if exists projects_select on projects;
create policy projects_select on projects for select using (is_member(group_id));
drop policy if exists projects_insert on projects;
create policy projects_insert on projects for insert with check (is_member(group_id));
drop policy if exists projects_update on projects;
create policy projects_update on projects for update using (is_member(group_id));
drop policy if exists projects_delete on projects;
create policy projects_delete on projects for delete using (created_by = auth.uid() or is_owner(group_id));

drop policy if exists debts_select on debts;
create policy debts_select on debts for select using (is_member(group_id));
drop policy if exists debts_insert on debts;
create policy debts_insert on debts for insert with check (
  is_member(group_id)
  and exists (select 1 from members where group_id = debts.group_id and user_id = debts.creditor_id)
  and exists (select 1 from members where group_id = debts.group_id and user_id = debts.debtor_id)
);
drop policy if exists debts_update on debts;
create policy debts_update on debts for update using (is_member(group_id));
drop policy if exists debts_delete on debts;
create policy debts_delete on debts for delete using (created_by = auth.uid() or is_owner(group_id));

drop policy if exists products_select on products;
create policy products_select on products for select using (is_member(group_id));
drop policy if exists products_insert on products;
create policy products_insert on products for insert with check (is_member(group_id));
drop policy if exists products_update on products;
create policy products_update on products for update using (is_member(group_id));
drop policy if exists products_delete on products;
create policy products_delete on products for delete using (created_by = auth.uid() or is_owner(group_id));

-- סנכרון בזמן אמת
alter table debts replica identity full;
alter table products replica identity full;
alter table projects replica identity full;
alter table members replica identity full;

do $$
begin
  begin alter publication supabase_realtime add table debts; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table products; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table projects; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table members; exception when duplicate_object then null; end;
end $$;

-- הקשחה: הפונקציות זמינות רק למשתמשים מחוברים (לא לאורחים)
revoke execute on function create_group(text, text) from public, anon;
revoke execute on function join_group(text, text) from public, anon;
grant execute on function create_group(text, text) to authenticated;
grant execute on function join_group(text, text) to authenticated;
