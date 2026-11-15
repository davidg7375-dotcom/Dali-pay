import React, { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { Btn, Card, Sprite, T, C, shekel } from './ui';

// מסך הבית: הדמות והמשפט משתנים לפי מצב המאזן האמיתי.
export default function HomeScreen({ ctx }) {
  const { me, members, debts, products, projects, nameOf, go } = ctx;
  const others = members.filter((m) => m.user_id !== me);

  const { owedToMe, iOwe, openCount } = useMemo(() => {
    let a = 0; let b = 0; let n = 0;
    debts.filter((d) => d.status === 'open').forEach((d) => {
      n += 1;
      if (d.creditor_id === me) a += Number(d.amount);
      else if (d.debtor_id === me) b += Number(d.amount);
    });
    return { owedToMe: a, iOwe: b, openCount: n };
  }, [debts, me]);

  let mood;
  if (others.length === 0) mood = { sprite: 'waiting', title: 'מחכים לשותף שלך', text: 'שתף את קוד ההזמנה מההגדרות, וברגע שהוא מצטרף הכול מתחיל להסתנכרן.', color: C.cyan };
  else if (debts.length === 0) mood = { sprite: 'relax', title: 'אין חובות. אפשר לנשום', text: 'כשיהיה חוב חדש, תוסיף אותו וזה יופיע אצל שניכם מיד.', color: C.green };
  else if (openCount === 0) mood = { sprite: 'closed', title: 'כל החובות נסגרו!', text: 'עבודה יפה. אין שום דבר פתוח.', color: C.green };
  else if (owedToMe === iOwe) mood = { sprite: 'balanced', title: 'המאזן מאוזן!', text: 'מה שחייבים לך שווה למה שאתה חייב.', color: C.blue };
  else if (owedToMe > iOwe) mood = { sprite: 'moneybag', title: 'מגיע לך כסף', text: `בסך הכול חייבים לך ${shekel(owedToMe - iOwe)} יותר ממה שאתה חייב.`, color: C.gold };
  else mood = { sprite: 'shrug_b', title: 'כדאי להסדיר', text: `בסך הכול אתה חייב ${shekel(iOwe - owedToMe)} יותר ממה שחייבים לך.`, color: C.pink };

  const waiting = products.filter((p) => !p.delivered).length;
  const recent = debts.filter((d) => d.status === 'open').slice(0, 3);

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
      <Card accent={mood.color} style={{ alignItems: 'center', paddingVertical: 18 }}>
        <Sprite name={mood.sprite} width={mood.sprite === 'moneybag' || mood.sprite === 'relax' ? 240 : 190} float />
        <T style={{ fontSize: 22, fontWeight: '900', color: C.deep, textAlign: 'center', marginTop: 12 }}>{mood.title}</T>
        <T style={{ color: C.muted, textAlign: 'center', marginTop: 4 }}>{mood.text}</T>
      </Card>

      <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 12 }}>
        <Stat label="חייבים לי" value={shekel(owedToMe)} color={C.green} bg="#E8FBF3" />
        <Stat label="אני חייב" value={shekel(iOwe)} color={C.red} bg="#FFEDF1" />
      </View>
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 14 }}>
        <Stat label="חובות פתוחים" value={String(openCount)} color={C.purple} bg="#F1EAFF" />
        <Stat label="מוצרים שממתינים" value={String(waiting)} color={C.gold} bg="#FFF6DB" />
        <Stat label="פרויקטים" value={String(projects.length)} color={C.blue} bg="#E6EFFF" />
      </View>

      <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 14 }}>
        <Btn title="+ חוב חדש" style={{ flex: 1 }} onPress={() => go('debts', 'new-debt')} />
        <Btn kind="gold" title="+ מוצר חדש" style={{ flex: 1 }} onPress={() => go('products', 'new-product')} />
      </View>

      {recent.length > 0 && (
        <View>
          <T style={{ fontSize: 18, fontWeight: '900', color: C.deep, marginBottom: 8 }}>החובות הפתוחים האחרונים</T>
          {recent.map((d) => {
            const iOweThis = d.debtor_id === me;
            return (
              <Card key={d.id} accent={iOweThis ? C.red : C.green} style={{ paddingVertical: 10 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '800' }}>{iOweThis ? `אני חייב ל${nameOf(d.creditor_id)}` : `${nameOf(d.debtor_id)} חייב לי`}</T>
                    {!!d.description && <T style={{ color: C.muted, fontSize: 13 }}>{d.description}</T>}
                  </View>
                  <T style={{ fontSize: 18, fontWeight: '900', color: iOweThis ? C.red : C.green }}>{shekel(d.amount)}</T>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, color, bg }) {
  return (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' }}>
      <T style={{ color: C.muted, fontSize: 12 }}>{label}</T>
      <T style={{ color, fontSize: 18, fontWeight: '900', marginTop: 2 }}>{value}</T>
    </View>
  );
}
