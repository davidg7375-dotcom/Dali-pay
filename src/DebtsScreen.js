import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Chips, Empty, ErrorBox, Input, Loading, Sheet, Sprite, T, C, shekel } from './ui';

// דמות קטנה לכל חוב — נבחרת לפי מצב החוב ובאופן יציב לפי המזהה, כדי שלא יחזור אותו פרצוף
const OWED_TO_ME = ['paid_cash', 'money_rain', 'piggy', 'moneybag'];
const I_OWE = ['shrug_a', 'shrug_b', 'receipt', 'facepalm'];
const PAID = ['closed', 'split_done', 'balanced'];
const pick = (list, id) => list[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % list.length];

export default function DebtsScreen({ ctx }) {
  const { me, group, members, projects, nameOf, isOwner, debts: rows, debtsState, intent, clearIntent, celebrate } = ctx;
  const { loading, error, reload } = debtsState;
  const [editing, setEditing] = useState(null); // null | {} (חדש) | חוב קיים
  const others = members.filter((m) => m.user_id !== me);

  useEffect(() => {
    if (intent === 'new-debt') { setEditing({}); clearIntent(); }
  }, [intent]);

  // מאזן: חיובי = חייבים לי, שלילי = אני חייב
  const balances = useMemo(() => {
    const b = {};
    rows.filter((d) => d.status === 'open').forEach((d) => {
      if (d.creditor_id === me) b[d.debtor_id] = (b[d.debtor_id] || 0) + Number(d.amount);
      else if (d.debtor_id === me) b[d.creditor_id] = (b[d.creditor_id] || 0) - Number(d.amount);
    });
    return b;
  }, [rows, me]);

  const markPaid = async (d) => {
    const paid = d.status !== 'paid';
    const { error: e } = await supabase.from('debts').update({ status: paid ? 'paid' : 'open', paid_at: paid ? new Date().toISOString() : null }).eq('id', d.id);
    if (e) Alert.alert('שגיאה', e.message);
    else if (paid) celebrate({ sprite: d.creditor_id === me ? 'paid_cash' : 'closed', title: 'החוב נסגר!', subtitle: shekel(d.amount) });
  };
  const remove = (d) => Alert.alert('מחיקת חוב', 'למחוק את החוב לצמיתות?', [
    { text: 'ביטול', style: 'cancel' },
    { text: 'מחיקה', style: 'destructive', onPress: async () => {
      const { error: e, count } = await supabase.from('debts').delete({ count: 'exact' }).eq('id', d.id);
      if (e) Alert.alert('שגיאה', e.message);
      else if (!count) Alert.alert('אין הרשאה', 'רק יוצר החוב או מנהל הקבוצה יכולים למחוק.');
    } },
  ]);

  if (loading) return <Loading text="מסנכרנים את החובות..." sprite="hoodies" />;
  return (
    <View style={{ flex: 1 }}>
      <Card accent={C.purple} style={{ margin: 14, marginBottom: 4 }}>
        <T style={{ fontWeight: '900', marginBottom: 6, color: C.deep }}>המאזן שלי</T>
        {others.length === 0 && <T style={{ color: C.muted }}>עדיין אין משתמש נוסף. שתף קוד הזמנה (בהגדרות).</T>}
        {others.map((m) => {
          const v = balances[m.user_id] || 0;
          return (
            <T key={m.user_id} style={{ color: v === 0 ? C.muted : v > 0 ? C.greenDark : C.redDark, fontWeight: '800' }}>
              {v === 0 ? `אין חובות מול ${m.display_name}` : v > 0 ? `${m.display_name} חייב לי ${shekel(v)}` : `אני חייב ל${m.display_name} ${shekel(-v)}`}
            </T>
          );
        })}
      </Card>
      {error && <ErrorBox text={error} onRetry={reload} />}
      <FlatList
        data={rows} keyExtractor={(d) => d.id} contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
        ListEmptyComponent={<Empty sprite="relax" title="אין חובות. אפשר לנשום" text="כשיהיה חוב חדש, הוסף אותו ויופיע אצל שניכם מיד." />}
        renderItem={({ item: d }) => {
          const iOwe = d.debtor_id === me;
          const paid = d.status === 'paid';
          const canDelete = d.created_by === me || isOwner;
          const sprite = paid ? pick(PAID, d.id) : iOwe ? pick(I_OWE, d.id) : pick(OWED_TO_ME, d.id);
          return (
            <Card accent={paid ? C.lilac : iOwe ? C.red : C.green} style={{ opacity: paid ? 0.7 : 1 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
                <Sprite name={sprite} width={70} height={70} cover round={18} enter={false} style={{ marginLeft: 12 }} />
                <View style={{ flex: 1 }}>
                  <T style={{ fontSize: 21, fontWeight: '900', color: paid ? C.muted : iOwe ? C.redDark : C.greenDark }}>{shekel(d.amount)}</T>
                  <T style={{ fontWeight: '600' }}>{iOwe ? `אני חייב ל${nameOf(d.creditor_id)}` : `${nameOf(d.debtor_id)} חייב לי`}{paid ? ' • שולם ✓' : ' • ממתין לתשלום'}</T>
                  {!!d.description && <T style={{ color: C.muted, fontSize: 14 }}>{d.description}</T>}
                  {!!d.project_id && <T style={{ color: C.purple, fontSize: 13 }}>פרויקט: {projects.find((p) => p.id === d.project_id)?.name || ''}</T>}
                </View>
              </View>
              <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Btn small kind={paid ? 'ghost' : 'ok'} title={paid ? 'החזר לפתוח' : 'סמן כשולם'} onPress={() => markPaid(d)} />
                <Btn small kind="ghost" title="עריכה" onPress={() => setEditing(d)} />
                {canDelete && <Btn small kind="danger" title="מחיקה" onPress={() => remove(d)} />}
              </View>
            </Card>
          );
        }}
      />
      <Btn title="+ חוב חדש" onPress={() => setEditing({})} style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }} />
      {editing && <DebtForm key={editing.id || 'new'} debt={editing} ctx={ctx} others={others} onClose={() => setEditing(null)} />}
    </View>
  );
}

function DebtForm({ debt, ctx, others, onClose }) {
  const { me, group, projects } = ctx;
  const isNew = !debt.id;
  const initialOther = isNew ? others[0]?.user_id : (debt.creditor_id === me ? debt.debtor_id : debt.creditor_id);
  const [iOwe, setIOwe] = useState(isNew ? false : debt.debtor_id === me);
  const [other, setOther] = useState(initialOther);
  const [amount, setAmount] = useState(isNew ? '' : String(debt.amount));
  const [desc, setDesc] = useState(debt.description || '');
  const [project, setProject] = useState(debt.project_id || null);

  const save = async () => {
    const n = parseFloat(String(amount).replace(',', '.'));
    if (!other) return Alert.alert('שגיאה', 'אין משתמש נוסף בקבוצה');
    if (!(n > 0)) return Alert.alert('שגיאה', 'יש להזין סכום חיובי');
    const row = { amount: n, description: desc.trim(), project_id: project, creditor_id: iOwe ? other : me, debtor_id: iOwe ? me : other };
    const q = isNew ? supabase.from('debts').insert({ ...row, group_id: group.id }) : supabase.from('debts').update(row).eq('id', debt.id);
    const { error } = await q;
    if (error) Alert.alert('שגיאה', error.message); else onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={isNew ? 'חוב חדש' : 'עריכת חוב'} sprite={isNew ? 'calendar' : 'new_debt'}>
      <Chips value={iOwe} onChange={setIOwe} options={[{ value: false, label: 'חייבים לי' }, { value: true, label: 'אני חייב' }]} />
      <T style={{ marginTop: 8, fontWeight: '700' }}>מול מי</T>
      <Chips value={other} onChange={setOther} options={others.map((m) => ({ value: m.user_id, label: m.display_name }))} />
      <Input placeholder="סכום ב-₪" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ marginTop: 8 }} />
      <Input placeholder="תיאור (אופציונלי)" value={desc} onChangeText={setDesc} />
      {projects.length > 0 && (<><T style={{ fontWeight: '700' }}>פרויקט (אופציונלי)</T>
        <Chips value={project} onChange={setProject} options={[{ value: null, label: 'ללא' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} /></>)}
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 14 }}>
        <Btn title="שמירה" onPress={save} style={{ flex: 1 }} />
        <Btn kind="ghost" title="ביטול" onPress={onClose} />
      </View>
    </Sheet>
  );
}
