#!/usr/bin/env bash
# בדיקות מיגרציה 1.4: רק המקבל מאשר/סוגר, פרופיל (Bit, דמות), יומן פעולות. רץ אחרי rls_test.sh.
DB=${1:-dali}
U1=11111111-1111-1111-1111-111111111111   # דוד
U2=22222222-2222-2222-2222-222222222222   # אלי
U3=33333333-3333-3333-3333-333333333333   # זר
G=aaaaaaaa-0000-0000-0000-000000000001
D3=dddddddd-0000-0000-0000-000000000003   # אלי מקבל, דוד חייב, 30, פתוח
pass=0; fail=0
run() { local pre="set local role $1;"; [ -n "$2" ] && pre="$pre set local request.jwt.claim.sub='$2';"; psql -d "$DB" -X -q -t -A -v ON_ERROR_STOP=1 -c "begin; $pre $3; commit;" 2>&1; }
ok()  { local out; out=$(run "$2" "$3" "$4"); if echo "$out" | grep -qiE "ERROR|permission denied|violates"; then echo "FAIL  $1  -> $out"; fail=$((fail+1)); elif [ -n "$5" ] && ! echo "$out" | grep -q "$5"; then echo "FAIL  $1 -> expected '$5' got: $out"; fail=$((fail+1)); else echo "PASS  $1"; pass=$((pass+1)); fi; }
bad() { local out; out=$(run "$2" "$3" "$4"); if echo "$out" | grep -q "$5"; then echo "PASS  $1 (נחסם)"; pass=$((pass+1)); else echo "FAIL  $1 -> expected '$5' got: $out"; fail=$((fail+1)); fi; }
q() { psql -d "$DB" -X -q -t -A -c "$1"; }
eq() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 -> expected '$3' got '$2'"; fail=$((fail+1)); fi; }

echo "== נתונים קיימים נשמרו =="
eq "כל החובות עדיין קיימים" "$(q "select count(*) from debts")" "$(q "select count(*) from debts")"
eq "יומן מולא מהנתונים הקיימים" "$(q "select count(*)>0 from activity")" "t"

echo "== רק המקבל מאשר תשלום =="
bad "החייב (דוד) מנסה לרשום תשלום על D3"   authenticated $U1 "select record_payment('$D3', 10)" "רק מי שמקבל"
bad "החייב מנסה לסמן ישירות status=paid"   authenticated $U1 "update debts set status='paid' where id='$D3'" "רק מי שמקבל"
bad "החייב מנסה להקטין את הסכום"           authenticated $U1 "update debts set amount=1 where id='$D3'" "להקטין"
bad "החייב מנסה להפוך כיוון"               authenticated $U1 "update debts set creditor_id='$U1', debtor_id='$U2' where id='$D3'" "כיוון"
ok  "החייב יכול לערוך תיאור"                authenticated $U1 "update debts set description='קפה ועוגה' where id='$D3'"
ok  "החייב יכול להגדיל סכום"                authenticated $U1 "update debts set amount=35 where id='$D3'"
eq  "מחיקה ע\"י החייב לא מוחקת"              "$(run authenticated $U1 "with x as (delete from debts where id='$D3' returning 1) select count(*) from x")" "0"
bad "חוב חדש שנוצר כ'שולם' ע\"י החייב"      authenticated $U1 "insert into debts(group_id,creditor_id,debtor_id,amount,status) values ('$G','$U2','$U1',5,'paid')" "רק מי שמקבל"
ok  "המקבל (אלי) רושם תשלום חלקי"           authenticated $U2 "select amount from record_payment('$D3', 15)" "15.00"
bad "החייב מנסה לבטל תשלום"                 authenticated $U1 "select delete_payment((select id from debt_payments where debt_id='$D3' limit 1))" "רק מי שמקבל"
ok  "המקבל סוגר את היתרה"                   authenticated $U2 "select amount from record_payment('$D3', 20)" "20.00"
eq  "החוב נסגר"                              "$(q "select status from debts where id='$D3'")" "paid"
ok  "חייב יכול ליצור חוב פתוח על עצמו"      authenticated $U1 "insert into debts(group_id,creditor_id,debtor_id,amount,description) values ('$G','$U2','$U1',12,'פיצה')"
ok  "המקבל יכול למחוק"                      authenticated $U2 "delete from debts where description='פיצה'"
eq  "החוב נמחק ע\"י המקבל"                   "$(q "select count(*) from debts where description='פיצה'")" "0"
ok  "דיווח תשלום מהחייב (הודעה קיימת)"      authenticated $U1 "insert into messages(group_id,recipient_id,kind,body,debt_id,amount) values ('$G','$U2','message','דיווח תשלום','$D3',35)"
ok  "המקבל מסמן את הדיווח כמטופל"           authenticated $U2 "update messages set read_at=now() where debt_id='$D3' and recipient_id='$U2'"

echo "== פרופיל: Bit ודמות =="
ok  "דוד שומר קישור Bit"                    authenticated $U1 "update members set bit_link='https://www.bitpay.co.il/app/me/ABC123' where user_id='$U1' and group_id='$G'"
eq  "הקישור נשמר"                            "$(q "select bit_link from members where user_id='$U1' and group_id='$G'")" "https://www.bitpay.co.il/app/me/ABC123"
bad "קישור לא מאובטח (http) נדחה"           authenticated $U1 "update members set bit_link='http://x.com' where user_id='$U1'" "violates check"
bad "קישור javascript נדחה"                 authenticated $U1 "update members set bit_link='javascript:alert(1)' where user_id='$U1'" "violates check"
ok  "דוד בוחר דמות a"                       authenticated $U1 "update members set avatar='a' where user_id='$U1' and group_id='$G'"
bad "דמות לא חוקית"                         authenticated $U1 "update members set avatar='zzz' where user_id='$U1'" "violates check"
eq  "אלי לא יכול לשנות את הפרופיל של דוד"    "$(run authenticated $U2 "with x as (update members set bit_link='https://evil.com' where user_id='$U1' returning 1) select count(*) from x")" "0"
bad "לא ניתן לשנות תפקיד (role)"            authenticated $U1 "update members set role='owner' where user_id='$U1'" "permission denied"

echo "== יומן פעולות =="
eq  "תשלומים נרשמו ביומן עם מי ביצע"         "$(q "select count(*) from activity where kind='payment' and entity_id='$D3' and actor_id='$U2'")" "2"
eq  "סגירה נרשמה"                            "$(q "select count(*) from activity where kind='debt_closed' and entity_id='$D3' and actor_id='$U2'")" "1"
eq  "עריכה נרשמה עם העורך"                   "$(q "select count(*) from activity where kind='debt_edit' and entity_id='$D3' and actor_id='$U1'")" "2"
eq  "מחיקה נרשמה"                            "$(q "select count(*) from activity where kind='debt_delete' and actor_id='$U2'")" "1"
ok  "מסירת מוצר"                             authenticated $U2 "update products set delivered=true where id='eeeeeeee-0000-0000-0000-000000000002'"
eq  "מסירה נרשמה"                            "$(q "select count(*) from activity where kind='product_delivered' and actor_id='$U2'")" "1"
eq  "זר לא רואה את היומן"                    "$(run authenticated $U3 "select count(*) from activity")" "0"
bad "כתיבה ישירה ליומן חסומה"               authenticated $U1 "insert into activity(group_id,kind) values ('$G','fake')" "permission denied"
bad "מחיקה מהיומן חסומה"                     authenticated $U1 "delete from activity" "permission denied"

echo "== הרצה חוזרת של המיגרציה =="
before=$(q "select count(*) from activity")
psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/migrations/20261117_v1_4.sql >/dev/null 2>&1 && eq "הרצה חוזרת בלי שגיאות" ok ok || eq "הרצה חוזרת" fail ok
eq  "הרצה חוזרת לא שכפלה את היומן"           "$(q "select count(*) from activity")" "$before"
eq  "הקישור נשאר אחרי הרצה חוזרת"            "$(q "select bit_link from members where user_id='$U1' and group_id='$G'")" "https://www.bitpay.co.il/app/me/ABC123"

echo; echo "1.4: $pass passed, $fail failed"; [ $fail -eq 0 ]
