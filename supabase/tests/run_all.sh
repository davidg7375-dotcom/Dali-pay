#!/usr/bin/env bash
# בונה מסד נתונים נקי ב-Postgres (עם תחליפי Supabase), מריץ schema + מיגרציות + בדיקות.
# שימוש: PGHOST=... PGPORT=... PGUSER=postgres bash supabase/tests/run_all.sh
set -e
DB=dali_test
dropdb --if-exists "$DB"; createdb "$DB"
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/stub.sql 2>&1 | grep -v -E "WARNING|HINT" || true
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/schema.sql 2>&1 | grep -iE "error" || true
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/seed.sql
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/migrations/20261116_v1_2.sql 2>&1 | grep -iE "error" || true
echo ">> הרצה שנייה (בדיקת הרצה חוזרת)"; psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/migrations/20261116_v1_2.sql 2>&1 | grep -iE "error" || true
bash supabase/tests/rls_test.sh "$DB"
echo ">> מיגרציה 1.4"; psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/migrations/20261117_v1_4.sql 2>&1 | grep -iE "error" || true
bash supabase/tests/rls_test_v14.sh "$DB"
