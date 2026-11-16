#!/usr/bin/env bash
# בדיקות הרשאות והתנהגות למיגרציה 1.2. דורש Postgres עם סכמת Supabase (ראה README של הבדיקות).
# שימוש: PGHOST=... PGPORT=... PGUSER=postgres bash supabase/tests/rls_test.sh dali
DB=${1:-dali}
U1=11111111-1111-1111-1111-111111111111   # דוד (מנהל)
U2=22222222-2222-2222-2222-222222222222   # אלי
U3=33333333-3333-3333-3333-333333333333   # זר (קבוצה אחרת)
G=aaaaaaaa-0000-0000-0000-000000000001
D1=dddddddd-0000-0000-0000-000000000001   # דוד נושה, אלי חייב, 100, פתוח
pass=0; fail=0
run() { # run <role> <uid> <sql>
  local role=$1 uid=$2 sql=$3
  local pre="set local role $role;"; [ -n "$uid" ] && pre="$pre set local request.jwt.claim.sub='$uid';"
  psql -d "$DB" -X -q -t -A -v ON_ERROR_STOP=1 -c "begin; $pre $sql; commit;" 2>&1
}
ok()   { # ok <name> <role> <uid> <sql> [expected-substring]
  local out; out=$(run "$2" "$3" "$4")
  if echo "$out" | grep -qiE "ERROR|permission denied|violates"; then echo "FAIL  $1  -> $out"; fail=$((fail+1));
  elif [ -n "$5" ] && ! echo "$out" | grep -q "$5"; then echo "FAIL  $1  -> expected '$5' got: $out"; fail=$((fail+1));
  else echo "PASS  $1"; pass=$((pass+1)); fi
}
bad()  { # bad <name> <role> <uid> <sql> <expected-error-substring>
  local out; out=$(run "$2" "$3" "$4")
  if echo "$out" | grep -q "$5"; then echo "PASS  $1 (נחסם: $5)"; pass=$((pass+1)); else echo "FAIL  $1  -> expected error '$5' got: $out"; fail=$((fail+1)); fi
}
q() { psql -d "$DB" -X -q -t -A -c "$1"; }

echo "== תשלומים חלקיים =="
ok  "אלי משלם 40 מתוך 100"            authenticated $U2 "select amount from record_payment('$D1', 40, 'Bit')" "40.00"
[ "$(q "select status from debts where id='$D1'")" = open ] && { echo "PASS  החוב נשאר פתוח אחרי תשלום חלקי"; pass=$((pass+1)); } || { echo "FAIL  סטטוס אחרי חלקי"; fail=$((fail+1)); }
bad "תשלום גבוה מהיתרה (70>60)"       authenticated $U2 "select record_payment('$D1', 70)" "גבוה מיתרת"
bad "תשלום אפס"                        authenticated $U2 "select record_payment('$D1', 0)" "חיובי"
bad "תשלום שלילי"                      authenticated $U2 "select record_payment('$D1', -5)" "חיובי"
bad "זר מנסה לשלם חוב של אחרים"       authenticated $U3 "select record_payment('$D1', 10)" "החוב לא נמצא"
bad "משתמש לא מחובר"                   authenticated ""  "select record_payment('$D1', 10)" "לא מחובר"
bad "anon לא יכול לקרוא לפונקציה"     anon ""           "select record_payment('$D1', 10)" "permission denied"
ok  "דוד משלים את ה-60 הנותרים"        authenticated $U1 "select amount from record_payment('$D1', 60)" "60.00"
[ "$(q "select status||'|'||(paid_by='$U1')||'|'||(paid_at is not null) from debts where id='$D1'")" = "paid|true|true" ] && { echo "PASS  החוב נסגר ונשמר מי סימן ומתי"; pass=$((pass+1)); } || { echo "FAIL  סגירת חוב"; fail=$((fail+1)); }
bad "תשלום על חוב סגור"                authenticated $U2 "select record_payment('$D1', 1)" "כבר שולם"
bad "הורדת סכום מתחת למשולם"          authenticated $U1 "update debts set amount=50 where id='$D1'" "נמוך ממה ששולם"
bad "החלפת צדדים אחרי תשלום"          authenticated $U1 "update debts set creditor_id='$U2', debtor_id='$U1' where id='$D1'" "להחליף את הצדדים"
ok  "הגדלת סכום פותחת מחדש"            authenticated $U1 "update debts set amount=150 where id='$D1'"
[ "$(q "select status from debts where id='$D1'")" = open ] && { echo "PASS  חוב שהוגדל חזר להיות פתוח"; pass=$((pass+1)); } || { echo "FAIL  פתיחה מחדש"; fail=$((fail+1)); }
bad "אלי (לא מנהל) מנסה לבטל תשלום של דוד" authenticated $U2 "select delete_payment((select id from debt_payments where paid_by='$U1' limit 1))" "רק מי שרשם"
ok  "דוד מבטל תשלום שרשם"              authenticated $U1 "select delete_payment((select id from debt_payments where paid_by='$U1' limit 1))"
[ "$(q "select coalesce(sum(amount),0) from debt_payments where debt_id='$D1'")" = "40.00" ] && { echo "PASS  יתרת תשלומים נכונה אחרי ביטול (40)"; pass=$((pass+1)); } || { echo "FAIL  יתרה אחרי ביטול"; fail=$((fail+1)); }
bad "כתיבה ישירה לטבלת התשלומים"      authenticated $U1 "insert into debt_payments(group_id,debt_id,amount) values ('$G','$D1',5)" "permission denied"
bad "מחיקה ישירה מטבלת התשלומים"      authenticated $U1 "delete from debt_payments" "permission denied"
ok  "קריאת תשלומים לחברי הקבוצה"       authenticated $U2 "select count(*) from debt_payments" ""
[ "$(run authenticated $U3 "select count(*) from debt_payments")" = 0 ] && { echo "PASS  זר לא רואה תשלומים"; pass=$((pass+1)); } || { echo "FAIL  זר רואה תשלומים"; fail=$((fail+1)); }

echo "== הודעות =="
ok  "דוד שולח הודעה לאלי"               authenticated $U1 "insert into messages(group_id,recipient_id,body,sticker) values ('$G','$U2','נו, מה עם הכסף שלי?','paid_cash')"
bad "זיוף שולח"                         authenticated $U1 "insert into messages(group_id,sender_id,recipient_id,body) values ('$G','$U2','$U1','זיוף')" "permission denied"
bad "הודעה ללא טקסט וללא איור"          authenticated $U1 "insert into messages(group_id,recipient_id) values ('$G','$U2')" "violates check"
bad "הודעה לנמען מחוץ לקבוצה"           authenticated $U1 "insert into messages(group_id,recipient_id,body) values ('$G','$U3','היי')" "row-level security"
bad "הודעה מזר לקבוצה אחרת"             authenticated $U3 "insert into messages(group_id,recipient_id,body) values ('$G','$U1','היי')" "row-level security"
bad "קביעת push_status מהלקוח"          authenticated $U1 "insert into messages(group_id,recipient_id,body,push_status) values ('$G','$U2','x','sent')" "permission denied"
bad "מפתח איור לא תקין"                 authenticated $U1 "insert into messages(group_id,recipient_id,sticker) values ('$G','$U2','../etc')" "violates check"
ok  "בקשת תשלום מהנושה לחייב"           authenticated $U1 "insert into messages(group_id,recipient_id,kind,body,debt_id,amount) values ('$G','$U2','payment_request','בקשת תשלום','$D1',110)"
bad "בקשת תשלום מהחייב לנושה"           authenticated $U2 "insert into messages(group_id,recipient_id,kind,body,debt_id,amount) values ('$G','$U1','payment_request','x','$D1',10)" "row-level security"
bad "בקשת תשלום בלי חוב"                authenticated $U1 "insert into messages(group_id,recipient_id,kind,body) values ('$G','$U2','payment_request','x')" "row-level security"
[ "$(run authenticated $U2 "select count(*) from messages")" = 2 ] && { echo "PASS  הנמען רואה את ההודעות"; pass=$((pass+1)); } || { echo "FAIL  נמען לא רואה"; fail=$((fail+1)); }
[ "$(run authenticated $U3 "select count(*) from messages")" = 0 ] && { echo "PASS  זר לא רואה הודעות"; pass=$((pass+1)); } || { echo "FAIL  זר רואה הודעות"; fail=$((fail+1)); }
ok  "הנמען מסמן 'נקרא'"                authenticated $U2 "update messages set read_at=now() where recipient_id='$U2'"
[ "$(q "select count(*) from messages where read_at is not null")" = 2 ] && { echo "PASS  read_at נשמר"; pass=$((pass+1)); } || { echo "FAIL  read_at"; fail=$((fail+1)); }
bad "הנמען מנסה לערוך טקסט"            authenticated $U2 "update messages set body='שינוי'" "permission denied"
[ "$(run authenticated $U1 "update messages set read_at=null returning 1" | grep -c 1)" = 0 ] && { echo "PASS  השולח לא יכול לשנות 'נקרא'"; pass=$((pass+1)); } || { echo "FAIL  שולח שינה read_at"; fail=$((fail+1)); }
bad "מחיקת הודעה"                       authenticated $U1 "delete from messages" "permission denied"

echo "== מכשירי Push =="
TOK=tokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
ok  "דוד רושם מכשיר"                    authenticated $U1 "select register_device('$TOK')"
bad "כתיבה ישירה לטבלת מכשירים"        authenticated $U1 "insert into device_tokens(token,user_id) values ('x','$U1')" "permission denied"
bad "טוקן קצר לא תקין"                  authenticated $U1 "select register_device('abc')" "לא תקין"
ok  "אלי מתחבר באותו מכשיר (הטוקן עובר אליו)" authenticated $U2 "select register_device('$TOK')"
[ "$(q "select user_id from device_tokens where token='$TOK'")" = "$U2" ] && { echo "PASS  הטוקן שויך לאלי"; pass=$((pass+1)); } || { echo "FAIL  שיוך טוקן"; fail=$((fail+1)); }
[ "$(run authenticated $U1 "select count(*) from device_tokens")" = 0 ] && { echo "PASS  דוד לא רואה טוקנים של אלי"; pass=$((pass+1)); } || { echo "FAIL  חשיפת טוקן"; fail=$((fail+1)); }
[ "$(run service_role "" "select count(*) from device_tokens")" = 1 ] && { echo "PASS  שרת (service_role) קורא טוקנים"; pass=$((pass+1)); } || { echo "FAIL  service_role"; fail=$((fail+1)); }
ok  "אלי מנתק את המכשיר"                authenticated $U2 "select unregister_device('$TOK')"
[ "$(q "select count(*) from device_tokens")" = 0 ] && { echo "PASS  הטוקן נמחק"; pass=$((pass+1)); } || { echo "FAIL  מחיקת טוקן"; fail=$((fail+1)); }

echo "== Bit וחברים =="
ok  "אלי מעדכן מספר Bit של עצמו"       authenticated $U2 "update members set bit_phone='0501234567' where user_id='$U2'"
bad "מספר Bit לא תקין"                  authenticated $U2 "update members set bit_phone='123' where user_id='$U2'" "violates check"
bad "שינוי תפקיד עצמי"                  authenticated $U2 "update members set role='owner' where user_id='$U2'" "permission denied"
[ "$(run authenticated $U2 "update members set bit_phone='0509999999' where user_id='$U1' returning 1" | grep -c 1)" = 0 ] && { echo "PASS  אי אפשר לשנות מספר של אחר"; pass=$((pass+1)); } || { echo "FAIL  שינוי מספר של אחר"; fail=$((fail+1)); }
[ "$(run authenticated $U1 "select bit_phone from members where user_id='$U2'")" = "0501234567" ] && { echo "PASS  חבר קבוצה רואה את מספר ה-Bit"; pass=$((pass+1)); } || { echo "FAIL  קריאת מספר"; fail=$((fail+1)); }
[ "$(run authenticated $U3 "select count(*) from members where user_id='$U2'")" = 0 ] && { echo "PASS  זר לא רואה את המספר"; pass=$((pass+1)); } || { echo "FAIL  זר רואה מספר"; fail=$((fail+1)); }

echo "== מוצרים =="
P=eeeeeeee-0000-0000-0000-000000000002
ok  "מוצר עם 'אצל מי' ו'למי'"           authenticated $U1 "insert into products(group_id,name,quantity,holder_id,receiver_id) values ('$G','מקרר',1,'$U1','$U2')"
bad "החזקה אצל זר"                      authenticated $U1 "insert into products(group_id,name,holder_id) values ('$G','x','$U3')" "row-level security"
ok  "אלי מסמן 'נמסר'"                   authenticated $U2 "update products set delivered=true where id='$P'"
[ "$(q "select (delivered_by='$U2')||'|'||(delivered_at is not null) from products where id='$P'")" = "true|true" ] || [ "$(q "select (delivered_by='$U2')||'|'||(delivered_at is not null) from products where id='$P'")" = "t|t" ] && { echo "PASS  נשמר מי מסר ומתי"; pass=$((pass+1)); } || { echo "FAIL  delivered_by/at"; fail=$((fail+1)); }
ok  "ביטול 'נמסר'"                      authenticated $U2 "update products set delivered=false where id='$P'"
[ "$(q "select delivered_at is null and delivered_by is null from products where id='$P'")" = t ] && { echo "PASS  ביטול ניקה את פרטי המסירה"; pass=$((pass+1)); } || { echo "FAIL  ניקוי מסירה"; fail=$((fail+1)); }

echo "== נתונים קיימים =="
[ "$(q "select count(*) from projects")" = 1 ] && { echo "PASS  פרויקטים נשמרו"; pass=$((pass+1)); } || { echo "FAIL  פרויקטים"; fail=$((fail+1)); }
[ "$(q "select count(*) from debt_payments where note like 'נרשם לפני%'")" = 1 ] && { echo "PASS  חוב ישן ששולם קיבל תשלום מלא אחד"; pass=$((pass+1)); } || { echo "FAIL  backfill"; fail=$((fail+1)); }

echo; echo "סיכום: $pass עברו, $fail נכשלו"; [ "$fail" = 0 ]
