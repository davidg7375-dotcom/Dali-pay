import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Btn, Card, Sprite, T, C } from './ui';
import { moneySummary, productsSummary, shekel } from './money';

// מסך הבית: אני חייב / חייבים לי / יתרה כללית, ובנפרד מצב המוצרים.
export default function HomeScreen({ ctx }) {
  const { me, members, debtViewsAll, products, nameOf, go, unread, openMessage, messages } = ctx;
  const others = members.filter((m) => m.user_id !== me);
  const sum = moneySummary(debtViewsAll, me);
  const ps = productsSummary(products, me);

  let mood;
  if (others.length === 0) mood = { sprite: 'waiting', title: 'מחכים לשותף שלך', text: 'שתף את קוד ההזמנה מההגדרות.', color: C.cyan };
  else if (sum.openCount === 0) mood = { sprite: 'relax', title: 'הכול מסודר', text: 'אין חובות פתוחים.', color: C.green };
  else if (sum.net === 0) mood = { sprite: 'balanced', title: 'המאזן מאוזן!', text: 'מה שחייבים לך שווה למה שאתה חייב.', color: C.blue };
  else if (sum.net > 0) mood = { sprite: 'moneybag', title: 'מגיע לך כסף', text: `יתרה לטובתך: ${shekel(sum.net)}`, color: C.gold };
  else mood = { sprite: 'shrug_b', title: 'כדאי להסדיר', text: `יתרה לחובתך: ${shekel(-sum.net)}`, color: C.pink };

  const lastUnread = messages.find((m) => m.recipient_id === me && !m.read_at);

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
      {!!lastUnread && (
        <Card accent={C.magenta} style={{ paddingVertical: 10 }}>
          <T style={{ fontWeight: '900', color: C.deep }}>הודעה חדשה מ{nameOf(lastUnread.sender_id)}{unread > 1 ? ` (+${unread - 1})` : ''}</T>
          <Btn small kind="ghost" title="פתח" onPress={() => openMessage(lastUnread.id)} style={{ alignSelf: 'flex-end', marginTop: 6 }} />
        </Card>
      )}
      <Card accent={mood.color} style={{ alignItems: 'center', paddingVertical: 14 }}>
        <Sprite name={mood.sprite} width={170} float />
        <T style={{ fontSize: 22, fontWeight: '900', color: C.deep, textAlign: 'center', marginTop: 8 }}>{mood.title}</T>
        <T style={{ color: C.muted, textAlign: 'center' }}>{mood.text}</T>
      </Card>

      <T style={{ fontSize: 18, fontWeight: '900', color: C.deep, marginBottom: 8 }}>💸 כסף</T>
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginBottom: 10 }}>
        <Stat label="אני חייב" value={shekel(sum.iOwe)} color={C.redDark} bg="#FFEDF1" />
        <Stat label="חייבים לי" value={shekel(sum.owedToMe)} color={C.greenDark} bg="#E8FBF3" />
      </View>
      <Stat label="יתרה כללית" value={shekel(Math.abs(sum.net))} color={sum.net < 0 ? C.redDark : sum.net > 0 ? C.greenDark : C.deep} bg="#F1EAFF" wide hint={sum.net > 0 ? 'לטובתך' : sum.net < 0 ? 'לחובתך' : 'מאוזן'} onPress={() => go('debts')} />

      <T style={{ fontSize: 18, fontWeight: '900', color: C.deep, marginTop: 14, marginBottom: 8 }}>📦 מוצרים</T>
      <View style={{ flexDirection: 'row-reverse', gap: 10 }}>
        <Stat label="אצלי, למסור" value={String(ps.toDeliver)} color={C.gold} bg="#FFF6DB" onPress={() => go('products')} />
        <Stat label="בדרך אליי" value={String(ps.toReceive)} color={C.purple} bg="#F1EAFF" onPress={() => go('products')} />
        <Stat label="נמסרו" value={String(ps.delivered)} color={C.greenDark} bg="#E8FBF3" onPress={() => go('products')} />
      </View>

      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 16 }}>
        <Btn title="+ חוב" style={{ flex: 1 }} onPress={() => go('debts', 'new-debt')} />
        <Btn kind="gold" title="+ מוצר" style={{ flex: 1 }} onPress={() => go('products', 'new-product')} />
        <Btn kind="ghost" title="הודעה" style={{ flex: 1 }} onPress={() => go('messages', 'compose')} />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, color, bg, wide, hint, onPress }) {
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap onPress={onPress} style={{ flex: wide ? undefined : 1, backgroundColor: bg, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' }}>
      <T style={{ color: C.muted, fontSize: 12 }}>{label}</T>
      <T style={{ color, fontSize: wide ? 26 : 18, fontWeight: '900', marginTop: 2 }}>{value}</T>
      {!!hint && <T style={{ color: C.muted, fontSize: 12 }}>{hint}</T>}
    </Wrap>
  );
}
