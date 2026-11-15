-- DALI PAY — בדיקת תקינות. להריץ ב-SQL Editor אחרי schema.sql.
-- 1) כל חמש הטבלאות חייבות להופיע עם rls_enabled = true
select tablename, rowsecurity as rls_enabled
from pg_tables
where schemaname = 'public' and tablename in ('groups','members','projects','debts','products')
order by tablename;

-- 2) מדיניות ההרשאות (אמורות להופיע policies לכל טבלה)
select tablename, policyname, cmd
from pg_policies where schemaname = 'public' order by tablename, cmd;

-- 3) טבלאות בסנכרון בזמן אמת (צריך: debts, members, products, projects)
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public' order by tablename;

-- 4) הפונקציות קיימות
select proname from pg_proc
where pronamespace = 'public'::regnamespace and proname in ('create_group','join_group','is_member','is_owner');
