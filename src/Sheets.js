import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Chips, Input, Sheet, Sprite, T, C } from './ui';
import { fmtDateTime, formatPhone, r2, shekel } from './money';
import { copyText, openBit } from './bit';
import { CAT_LABELS, PRESETS, pushNote, sendMessage } from './messaging';
import { STICKERS } from './sprites';

// ───────── העברת תשלום ב-Bit (החייב רואה אותו) ─────────
export function BitSheet({ debt, ctx, onClose, onPay }) {
  const { nameOf, members } = ctx;
  const creditor = members.find((m) => m.user_id === debt.creditor_id);
  const phone = creditor?.bit_phone;
  const name = nameOf(debt.creditor_id);
  const [note, setNote] = useState('');
  const details = `Bit ל${name}\nטלפון: ${formatPhone(phone)}\nסכום: ${shekel(debt.remaining)}${debt.description ? `\nסיבה: ${debt.description}` : ''}`;
  const copy = async (what, text) => { setNote((await copyText(text)) ? `${what} הועתק` : 'ההעתקה לא זמינה במכשיר הזה'); };
  const open = async () => {
    const r = await openBit();
    if (r === 'store') setNote('Bit לא מותקנת. פתחתי את דף ההורדה.');
  };
  return (
    <Sheet visible onClose={onClose} title="העברת תשלום ב-Bit" sprite="transfer_debt">
      <Card accent={C.cyan}>
        <Row k="למי" v={name} />
        <Row k="טלפון ב-Bit" v={phone ? formatPhone(phone) : 'לא הוגדר'} bad={!phone} />
        <Row k="סכום" v={shekel(debt.remaining)} big />
        {!!debt.description && <Row k="סיבה" v={debt.description} />}
      </Card>
      {!phone && <T style={{ color: C.redDark, marginBottom: 10 }}>{name} עוד לא הזין/ה מספר Bit בהגדרות. בקש ממנו/ה, או שלח הודעה.</T>}
      <View style={{ flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' }}>
        {!!phone && <Btn small kind="ghost" title="העתק טלפון" onPress={() => copy('הטלפון', phone)} />}
        <Btn small kind="ghost" title="העתק סכום" onPress={() => copy('הסכום', r2(debt.remaining).toFixed(2))} />
        <Btn small kind="ghost" title="העתק את כל הפרטים" onPress={() => copy('הפרטים', details)} />
      </View>
      <Btn title="פתח את Bit" onPress={open} style={{ marginTop: 12 }} />
      {!!note && <T style={{ color: C.greenDark, textAlign: 'center', marginTop: 8 }}>{note}</T>}
      <T style={{ color: C.muted, fontSize: 13, marginTop: 12 }}>
        Bit לא מאפשרת למלא תשלום מראש מתוך אפליקציה אחרת, לכן מעתיקים את הפרטים ומשלמים ב-Bit. החוב לא נסגר אוטומטית: אחרי שהעברת, לחץ "שילמתי" כדי לעדכן.
      </T>
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 12 }}>
        <Btn kind="ok" title="שילמתי — עדכן חוב" onPress={() => { onClose(); onPay(debt); }} style={{ flex: 1 }} />
        <Btn kind="ghost" title="סגור" onPress={onClose} />
      </View>
    </Sheet>
  );
}

function Row({ k, v, big, bad }) {
  return (
    <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 4 }}>
      <T style={{ color: C.muted }}>{k}</T>
      <T style={{ fontWeight: '900', fontSize: big ? 22 : 16, color: bad ? C.redDark : big ? C.deep : C.ink, flexShrink: 1 }}>{v}</T>
    </View>
  );
}

// ───────── רישום תשלום (מלא או חלקי) ─────────
export function PaySheet({ debt, ctx, onClose }) {
  const { celebrate, nameOf } = ctx;
  const [amount, setAmount] = useState(String(r2(debt.remaining)));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    const n = parseFloat(String(amount).replace(',', '.'));
    if (!(n > 0)) return Alert.alert('שגיאה', 'יש להזין סכום חיובי');
    if (n > debt.remaining + 0.0001) return Alert.alert('שגיאה', `הסכום גדול מהיתרה (${shekel(debt.remaining)})`);
    setBusy(true);
    const { data, error } = await supabase.rpc('record_payment', { p_debt: debt.id, p_amount: r2(n), p_note: note.trim() });
    setBusy(false);
    if (error) return Alert.alert('שגיאה', error.message);
    ctx.reloadMoney();
    onClose();
    const left = r2(debt.remaining - n);
    if (left <= 0) celebrate({ sprite: debt.creditor_id === ctx.me ? 'paid_cash' : 'closed', title: 'החוב נסגר!', subtitle: `${shekel(debt.amount)} • ${nameOf(debt.debtor_id)} ל${nameOf(debt.creditor_id)}` });
    else Alert.alert('התשלום נרשם', `נשארו ${shekel(left)}`);
  };
  return (
    <Sheet visible onClose={onClose} title="רישום תשלום" sprite="paid_cash">
      <T style={{ color: C.muted, marginBottom: 6 }}>יתרה לתשלום: {shekel(debt.remaining)}{debt.isPartial ? ` (שולם עד כה ${shekel(debt.paid)})` : ''}</T>
      <Input placeholder="סכום ששולם ב-₪" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <View style={{ flexDirection: 'row-reverse', gap: 8, marginBottom: 8 }}>
        <Btn small kind="ghost" title="הכול" onPress={() => setAmount(String(r2(debt.remaining)))} />
        <Btn small kind="ghost" title="חצי" onPress={() => setAmount(String(r2(debt.remaining / 2)))} />
      </View>
      <Input placeholder="הערה (אופציונלי)" value={note} onChangeText={setNote} maxLength={200} />
      <T style={{ color: C.muted, fontSize: 13 }}>נשמר מי סימן ומתי. היתרה מתעדכנת אצל שניכם.</T>
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 12 }}>
        <Btn kind="ok" title={busy ? 'שומר...' : 'רשום תשלום'} disabled={busy} onPress={pay} style={{ flex: 1 }} />
        <Btn kind="ghost" title="ביטול" onPress={onClose} />
      </View>
    </Sheet>
  );
}

// ───────── כתיבת הודעה: טקסט חופשי, הודעות מוכנות וגלריית איורים ─────────
export function ComposeSheet({ ctx, onClose, initial }) {
  const { me, members, group, messagesState } = ctx;
  const others = members.filter((m) => m.user_id !== me);
  const [to, setTo] = useState(initial?.to || others[0]?.user_id);
  const [text, setText] = useState(initial?.text || '');
  const [sticker, setSticker] = useState(initial?.sticker || null);
  const [cat, setCat] = useState('all');
  const [busy, setBusy] = useState(false);
  const gallery = STICKERS.filter((s) => s.gallery && (cat === 'all' || s.cat === cat));

  const send = async () => {
    if (!to) return Alert.alert('שגיאה', 'אין למי לשלוח. השותף עוד לא הצטרף.');
    setBusy(true);
    const r = await sendMessage({ group, to, body: text, sticker });
    setBusy(false);
    if (!r.ok) return Alert.alert('שגיאה', r.error);
    messagesState.reload();
    onClose();
    const n = pushNote(r.push);
    if (n) Alert.alert('נשלח', n);
  };

  return (
    <Sheet visible onClose={onClose} title="שלח הודעה" sprite="reminder_sent">
      {others.length > 1 && <Chips value={to} onChange={setTo} options={others.map((m) => ({ value: m.user_id, label: m.display_name }))} />}
      <Input placeholder="מה רוצים להגיד?" value={text} onChangeText={setText} multiline maxLength={500} style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <T style={{ fontWeight: '800', marginBottom: 4 }}>הודעות מוכנות</T>
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {PRESETS.map((p) => (
          <Pressable key={p} onPress={() => setText(p)} style={{ backgroundColor: text === p ? C.purple : '#fff', borderColor: C.border, borderWidth: 2, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7 }}>
            <T style={{ color: text === p ? '#fff' : C.ink, fontSize: 14, fontWeight: '700' }}>{p}</T>
          </Pressable>
        ))}
      </View>
      <T style={{ fontWeight: '800' }}>איור (אופציונלי)</T>
      <Chips value={cat} onChange={setCat} options={[{ value: 'all', label: 'הכול' }, ...Object.entries(CAT_LABELS).map(([value, label]) => ({ value, label }))]} />
      <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginVertical: 8 }}>
        {gallery.map((st) => (
          <Pressable key={st.key} onPress={() => setSticker(sticker === st.key ? null : st.key)} accessibilityLabel={st.label}
            style={{ borderWidth: 3, borderColor: sticker === st.key ? C.purple : 'transparent', borderRadius: 18, padding: 2 }}>
            <Sprite name={st.key} width={72} height={72} cover round={14} enter={false} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 6 }}>
        <Btn title={busy ? 'שולח...' : 'שלח עכשיו'} disabled={busy || (!text.trim() && !sticker)} onPress={send} style={{ flex: 1 }} />
        <Btn kind="ghost" title="ביטול" onPress={onClose} />
      </View>
    </Sheet>
  );
}

// ───────── מסך הודעה מעוצב (נפתח מלחיצה על התראה או מהיסטוריה) ─────────
export function MessageView({ id, ctx, onClose, onBit, onReply }) {
  const { messages, me, nameOf, debtViewsAll, messagesState } = ctx;
  const m = messages.find((x) => x.id === id);
  const [tried, setTried] = useState(false);
  React.useEffect(() => {
    if (!m && !tried) { setTried(true); messagesState.reload(); }
    if (m && m.recipient_id === me && !m.read_at) supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', m.id).then(() => messagesState.reload());
  }, [m?.id, m?.read_at]);
  const mine = m && m.sender_id === me;
  const debt = m?.debt_id ? debtViewsAll.find((d) => d.id === m.debt_id) : null;
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 56, alignItems: 'center' }}>
          {!m ? <T style={{ color: C.muted }}>טוענים את ההודעה...</T> : (
            <>
              <T style={{ color: C.muted }}>{mine ? `נשלח ל${nameOf(m.recipient_id)}` : `מאת ${nameOf(m.sender_id)}`} • {fmtDateTime(m.created_at)}</T>
              <Sprite name={m.sticker || 'reminder_sent'} width={280} float style={{ marginVertical: 18 }} />
              {!!m.body && (
                <Card accent={m.kind === 'payment_request' ? C.gold : C.purple} style={{ alignSelf: 'stretch' }}>
                  <T style={{ fontSize: 22, fontWeight: '900', color: C.deep, textAlign: 'center' }}>{m.body}</T>
                </Card>
              )}
              {m.kind === 'payment_request' && debt && !debt.isPaid && !mine && (
                <Btn title={`העבר תשלום ב-Bit (${shekel(debt.remaining)})`} onPress={() => { onClose(); onBit(debt); }} style={{ alignSelf: 'stretch', marginTop: 6 }} />
              )}
              {m.kind === 'payment_request' && debt?.isPaid && <T style={{ color: C.greenDark, fontWeight: '800' }}>החוב הזה כבר שולם ✓</T>}
            </>
          )}
        </ScrollView>
        <View style={{ flexDirection: 'row-reverse', gap: 10, padding: 16, paddingBottom: 28 }}>
          {m && !mine && <Btn title="השב" onPress={() => { onClose(); onReply(m.sender_id); }} style={{ flex: 1 }} />}
          <Btn kind="ghost" title="סגור" onPress={onClose} style={m && !mine ? undefined : { flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}
