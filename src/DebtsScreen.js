import React, { useEffect, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Chips, Empty, ErrorBox, Input, Loading, Sheet, Sprite, T, C } from './ui';
import { fmtDate, fmtDateTime, moneySummary, paymentHistory, shekel } from './money';
import { paymentRequestText, pushNote, sendMessage } from './messaging';

const OWED_TO_ME = ['paid_cash', 'money_rain', 'piggy', 'moneybag'];
const I_OWE = ['shrug_a', 'shrug_b', 'receipt', 'facepalm'];
const PAID = ['closed', 'split_done', 'balanced'];
const pick = (list, id) => list[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % list.length];

export default function DebtsScreen({ ctx }) {
  const { me, members, nameOf, isOwner, debtViewsAll: views, debtsState, intent, clearIntent, openBit, openPay } = ctx;
  const { loading, error, reload } = debtsState;
  const [mode, setMode] = useState('open');
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const others = members.filter((m) => m.user_id !== me);

  useEffect(() => { if (intent === 'new-debt') { setEditing({}); clearIntent(); } }, [intent]);

  const sum = moneySummary(views, me);
  const open = views.filter((v) => !v.isPaid);
  const history = paymentHistory(views);

  const ask = async (d) => {
    const r = await sendMessage({ group: ctx.group, to: d.debtor_id, kind: 'payment_request', body: paymentRequestText(d.remaining, d.description), sticker: 'reminder_sent', debt: d.id, amount: d.remaining });
    if (!r.ok) return Alert.alert('שגיאה', r.error);
    ctx.messagesState.reload();
    Alert.alert('בקשת התשלום נשלחה', pushNote(r.push) || `${nameOf(d.debtor_id)} קיבל/ה התראה עם הסכום והסיבה.`);
  };
  const remove = (d) => Alert.alert('מחיקת חוב', 'למחוק את החוב ואת תשלומיו לצמיתות?', [
    { text: 'ביטול', style: 'cancel' },
    { text: 'מחיקה', style: 'destructive', onPress: async () => {
      const { error: e, count } = await supabase.from('debts').delete({ count: 'exact' }).eq('id', d.id);
      if (e) Alert.alert('שגיאה', e.message);
      else if (!count) Alert.alert('אין הרשאה', 'רק יוצר החוב או מנהל הקבוצה יכולים למחוק.');
    } },
  ]);
  const removePayment = (p) => Alert.alert('ביטול תשלום', 'לבטל את התשלום הזה? היתרה תחזור.', [
    { text: 'לא', style: 'cancel' },
    { text: 'בטל תשלום', style: 'destructive', onPress: async () => {
      const { error: e } = await supabase.rpc('delete_payment', { p_payment: p.id });
      if (e) Alert.alert('שגיאה', e.message); else ctx.reloadMoney();
    } },
  ]);
  const reopenLegacy = async (d) => {
    const { error: e } = await supabase.from('debts').update({ status: 'open', paid_at: null, paid_by: null }).eq('id', d.id);
    if (e) Alert.alert('שגיאה', e.message); else ctx.reloadMoney();
  };

  if (loading) return <Loading text="מסנכרנים את החובות..." sprite="hoodies" />;
  return (
    <View style={{ flex: 1 }}>
      <Card accent={C.purple} style={{ margin: 14, marginBottom: 4 }}>
        {others.length === 0 && <T style={{ color: C.muted }}>עדיין אין משתמש נוסף. שתף קוד הזמנה (בהגדרות).</T>}
        {others.map((m) => {
          const v = sum.byPerson[m.user_id] || 0;
          return (
            <T key={m.user_id} style={{ color: v === 0 ? C.muted : v > 0 ? C.greenDark : C.redDark, fontWeight: '900', fontSize: 17 }}>
              {v === 0 ? `אין חובות פתוחים מול ${m.display_name}` : v > 0 ? `${m.display_name} חייב לי ${shekel(v)}` : `אני חייב ל${m.display_name} ${shekel(-v)}`}
            </T>
          );
        })}
      </Card>
      <View style={{ paddingHorizontal: 14 }}>
        <Chips value={mode} onChange={setMode} options={[{ value: 'open', label: `פתוחים (${open.length})` }, { value: 'history', label: `היסטוריית תשלומים (${history.length})` }]} />
      </View>
      {error && <ErrorBox text={error} onRetry={reload} />}

      {mode === 'open' ? (
        <FlatList
          data={open} keyExtractor={(d) => d.id} contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
          ListEmptyComponent={<Empty sprite="relax" title="אין חובות פתוחים" text="כשיהיה חוב חדש, הוסף אותו ויופיע אצל שניכם מיד." />}
          renderItem={({ item: d }) => {
            const iOwe = d.debtor_id === me;
            const canDelete = d.created_by === me || isOwner;
            return (
              <Card accent={iOwe ? C.red : C.green}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                  <Sprite name={iOwe ? pick(I_OWE, d.id) : pick(OWED_TO_ME, d.id)} width={70} height={70} cover round={18} enter={false} style={{ marginLeft: 12 }} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontSize: 22, fontWeight: '900', color: iOwe ? C.redDark : C.greenDark }}>{shekel(d.remaining)}</T>
                    {d.isPartial && <T style={{ color: C.muted, fontSize: 13 }}>מתוך {shekel(d.amount)} • שולם {shekel(d.paid)}</T>}
                    <T style={{ fontWeight: '700' }}>{iOwe ? `אני חייב ל${nameOf(d.creditor_id)}` : `${nameOf(d.debtor_id)} חייב לי`}</T>
                    {!!d.description && <T style={{ color: C.ink, fontSize: 14 }}>סיבה: {d.description}</T>}
                    <T style={{ color: C.muted, fontSize: 12 }}>נוצר ב-{fmtDate(d.created_at)} • {d.isPartial ? 'שולם חלקית' : 'ממתין לתשלום'}</T>
                  </View>
                </View>
                <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  {iOwe && <Btn small title="העבר תשלום ב-Bit" onPress={() => openBit(d)} />}
                  {!iOwe && <Btn small kind="gold" title="בקש תשלום" onPress={() => ask(d)} />}
                  <Btn small kind="ok" title="סמן תשלום" onPress={() => openPay(d)} />
                  {d.payments.length > 0 && <Btn small kind="ghost" title={expanded === d.id ? 'הסתר תשלומים' : `תשלומים (${d.payments.length})`} onPress={() => setExpanded(expanded === d.id ? null : d.id)} />}
                  <Btn small kind="ghost" title="עריכה" onPress={() => setEditing(d)} />
                  {canDelete && <Btn small kind="danger" title="מחיקה" onPress={() => remove(d)} />}
                </View>
                {expanded === d.id && d.payments.map((p) => (
                  <PayRow key={p.id} p={p} nameOf={nameOf} canUndo={p.paid_by === me || isOwner} onUndo={() => removePayment(p)} />
                ))}
              </Card>
            );
          }}
        />
      ) : (
        <FlatList
          data={history} keyExtractor={(h) => h.id} contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
          ListEmptyComponent={<Empty sprite="sleeping" title="עוד אין תשלומים" text="כשתסמנו תשלום הוא יופיע כאן עם מי סימן ומתי." />}
          renderItem={({ item: h }) => (
            <Card accent={C.green}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                <Sprite name={pick(PAID, h.id)} width={58} height={58} cover round={16} enter={false} style={{ marginLeft: 12 }} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 19, fontWeight: '900', color: C.greenDark }}>{shekel(h.amount)}</T>
                  <T style={{ fontWeight: '700' }}>{nameOf(h.debt.debtor_id)} ל{nameOf(h.debt.creditor_id)}{h.debt.isPaid ? ' • החוב נסגר ✓' : ` • נותר ${shekel(h.debt.remaining)}`}</T>
                  {!!h.debt.description && <T style={{ color: C.muted, fontSize: 13 }}>{h.debt.description}</T>}
                  <T style={{ color: C.muted, fontSize: 12 }}>
                    {h.by ? `סומן ע"י ${nameOf(h.by)}` : 'סומן בגרסה קודמת'}{h.at ? ` • ${fmtDateTime(h.at)}` : ''}{h.note ? ` • ${h.note}` : ''}
                  </T>
                </View>
              </View>
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 8 }}>
                {h.legacy ? <Btn small kind="ghost" title="החזר לפתוח" onPress={() => reopenLegacy(h.debt)} />
                  : (h.by === me || isOwner) && <Btn small kind="ghost" title="בטל תשלום" onPress={() => removePayment(h.payment)} />}
              </View>
            </Card>
          )}
        />
      )}
      <Btn title="+ חוב חדש" onPress={() => setEditing({})} style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }} />
      {editing && <DebtForm key={editing.id || 'new'} debt={editing} ctx={ctx} others={others} onClose={() => setEditing(null)} />}
    </View>
  );
}

function PayRow({ p, nameOf, canUndo, onUndo }) {
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: C.border }}>
      <View style={{ flex: 1 }}>
        <T style={{ fontWeight: '800' }}>{shekel(p.amount)} • {nameOf(p.paid_by)}</T>
        <T style={{ color: C.muted, fontSize: 12 }}>{fmtDateTime(p.created_at)}{p.note ? ` • ${p.note}` : ''}</T>
      </View>
      {canUndo && <Btn small kind="ghost" title="בטל" onPress={onUndo} />}
    </View>
  );
}

function DebtForm({ debt, ctx, others, onClose }) {
  const { me, group } = ctx;
  const isNew = !debt.id;
  const locked = !isNew && debt.payments && debt.payments.length > 0; // אחרי תשלום אי אפשר להחליף צדדים
  const initialOther = isNew ? others[0]?.user_id : (debt.creditor_id === me ? debt.debtor_id : debt.creditor_id);
  const [iOwe, setIOwe] = useState(isNew ? false : debt.debtor_id === me);
  const [other, setOther] = useState(initialOther);
  const [amount, setAmount] = useState(isNew ? '' : String(debt.amount));
  const [desc, setDesc] = useState(debt.description || '');

  const save = async () => {
    const n = parseFloat(String(amount).replace(',', '.'));
    if (!other) return Alert.alert('שגיאה', 'אין משתמש נוסף בקבוצה');
    if (!(n > 0)) return Alert.alert('שגיאה', 'יש להזין סכום חיובי');
    const row = { amount: n, description: desc.trim(), creditor_id: iOwe ? other : me, debtor_id: iOwe ? me : other };
    if (locked) { delete row.creditor_id; delete row.debtor_id; }
    const q = isNew ? supabase.from('debts').insert({ ...row, group_id: group.id }) : supabase.from('debts').update(row).eq('id', debt.id);
    const { error } = await q;
    if (error) Alert.alert('שגיאה', error.message); else { ctx.reloadMoney(); onClose(); }
  };

  return (
    <Sheet visible onClose={onClose} title={isNew ? 'חוב חדש' : 'עריכת חוב'} sprite={isNew ? 'calendar' : 'new_debt'}>
      {!locked && <Chips value={iOwe} onChange={setIOwe} options={[{ value: false, label: 'חייבים לי' }, { value: true, label: 'אני חייב' }]} />}
      {!locked && <><T style={{ marginTop: 8, fontWeight: '700' }}>מול מי</T>
        <Chips value={other} onChange={setOther} options={others.map((m) => ({ value: m.user_id, label: m.display_name }))} /></>}
      {locked && <T style={{ color: C.muted, marginBottom: 8 }}>כבר נרשמו תשלומים, לכן אי אפשר להחליף את הצדדים. אפשר לשנות סכום (לא מתחת למה ששולם) וסיבה.</T>}
      <Input placeholder="סכום ב-₪" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ marginTop: 8 }} />
      <Input placeholder="סיבה / תיאור" value={desc} onChangeText={setDesc} />
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 14 }}>
        <Btn title="שמירה" onPress={save} style={{ flex: 1 }} />
        <Btn kind="ghost" title="ביטול" onPress={onClose} />
      </View>
    </Sheet>
  );
}
