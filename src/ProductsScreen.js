import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Chips, Empty, ErrorBox, Input, Loading, Sheet, Sprite, T, C } from './ui';
import { fmtDateTime } from './money';

const WAITING = ['burger', 'coffee', 'gamepad', 'think_howmuch'];
const DELIVERED = ['drinks', 'split_done', 'cake'];
const pick = (list, id) => list[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % list.length];

// התחשבנות מוצרים: מי מחזיק, למי הוא אמור להגיע, כמה, ומה הסטטוס. נפרד לגמרי מכסף.
export default function ProductsScreen({ ctx }) {
  const { me, nameOf, isOwner, products: rows, productsState, intent, clearIntent, celebrate } = ctx;
  const { loading, error, reload } = productsState;
  const [form, setForm] = useState(null); // null | {} חדש | מוצר
  const [filter, setFilter] = useState('waiting');

  useEffect(() => { if (intent === 'new-product') { setForm({}); clearIntent(); } }, [intent]);

  const upd = async (id, patch) => {
    const { error: e } = await supabase.from('products').update(patch).eq('id', id);
    if (e) Alert.alert('שגיאה', e.message);
    return !e;
  };
  const toggleDelivered = async (p) => {
    const ok = await upd(p.id, { delivered: !p.delivered });
    if (ok && !p.delivered) celebrate({ sprite: 'drinks', title: 'המוצר נמסר!', subtitle: p.name });
  };
  const remove = (p) => Alert.alert('מחיקת מוצר', `למחוק את "${p.name}"?`, [
    { text: 'ביטול', style: 'cancel' },
    { text: 'מחיקה', style: 'destructive', onPress: async () => {
      const { error: e, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', p.id);
      if (e) Alert.alert('שגיאה', e.message);
      else if (!count) Alert.alert('אין הרשאה', 'רק יוצר המוצר או מנהל הקבוצה יכולים למחוק.');
    } },
  ]);

  const shown = rows.filter((p) => filter === 'all' || (filter === 'waiting' ? !p.delivered : p.delivered));
  if (loading) return <Loading text="מסנכרנים את המוצרים..." sprite="hoodies" />;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 14, paddingTop: 10 }}>
        <Chips value={filter} onChange={setFilter} options={[
          { value: 'waiting', label: `ממתינים (${rows.filter((p) => !p.delivered).length})` },
          { value: 'done', label: `נמסרו (${rows.filter((p) => p.delivered).length})` },
          { value: 'all', label: 'הכול' }]} />
      </View>
      {error && <View style={{ marginTop: 10 }}><ErrorBox text={error} onRetry={reload} /></View>}
      <FlatList
        data={shown} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
        ListEmptyComponent={<Empty sprite="think_who" title={filter === 'done' ? 'עוד לא נמסר כלום' : 'אין מוצרים ממתינים'} text="מוסיפים מוצר עם הכפתור למטה." />}
        renderItem={({ item: p }) => (
          <Card accent={p.delivered ? C.green : C.gold} style={{ opacity: p.delivered ? 0.8 : 1 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Sprite name={p.delivered ? pick(DELIVERED, p.id) : pick(WAITING, p.id)} width={64} height={64} cover round={18} enter={false} style={{ marginLeft: 12 }} />
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 19, fontWeight: '900' }}>{p.name} × {p.quantity}</T>
                <T style={{ fontSize: 14 }}>אצל: <T style={{ fontWeight: '800' }}>{p.holder_id ? nameOf(p.holder_id) : 'לא הוגדר'}</T></T>
                <T style={{ fontSize: 14 }}>צריך להגיע ל: <T style={{ fontWeight: '800' }}>{p.receiver_id ? nameOf(p.receiver_id) : 'לא הוגדר'}</T></T>
                <T style={{ color: p.delivered ? C.greenDark : '#B45309', fontSize: 13, fontWeight: '800' }}>
                  {p.delivered ? `נמסר ✓${p.delivered_by ? ` • סומן ע"י ${nameOf(p.delivered_by)}` : ''}${p.delivered_at ? ` • ${fmtDateTime(p.delivered_at)}` : ''}` : 'ממתין למסירה'}
                </T>
              </View>
            </View>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Btn small kind={p.delivered ? 'ghost' : 'ok'} title={p.delivered ? 'בטל מסירה' : 'נמסר'} onPress={() => toggleDelivered(p)} />
              <Btn small kind="ghost" title="עריכה" onPress={() => setForm(p)} />
              {(p.created_by === me || isOwner) && <Btn small kind="danger" title="מחיקה" onPress={() => remove(p)} />}
            </View>
          </Card>
        )}
      />
      <Btn kind="gold" title="+ מוצר חדש" onPress={() => setForm({})} style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }} />
      {form && <ProductForm key={form.id || 'new'} product={form} ctx={ctx} onClose={() => setForm(null)} />}
    </View>
  );
}

function ProductForm({ product, ctx, onClose }) {
  const { group, members, me } = ctx;
  const isNew = !product.id;
  const others = members.filter((m) => m.user_id !== me);
  const [name, setName] = useState(product.name || '');
  const [qty, setQty] = useState(String(product.quantity ?? 1));
  const [holder, setHolder] = useState(product.holder_id ?? me);
  const [receiver, setReceiver] = useState(product.receiver_id ?? others[0]?.user_id ?? null);
  const opts = members.map((m) => ({ value: m.user_id, label: m.user_id === me ? `${m.display_name} (אני)` : m.display_name }));
  const save = async () => {
    const q = parseInt(qty, 10);
    if (!name.trim()) return Alert.alert('שגיאה', 'יש להזין שם מוצר');
    if (!(q >= 0)) return Alert.alert('שגיאה', 'כמות לא תקינה');
    const row = { name: name.trim(), quantity: q, holder_id: holder, receiver_id: receiver };
    const { error } = isNew ? await supabase.from('products').insert({ ...row, group_id: group.id }) : await supabase.from('products').update(row).eq('id', product.id);
    if (error) Alert.alert('שגיאה', error.message); else onClose();
  };
  return (
    <Sheet visible onClose={onClose} title={isNew ? 'מוצר חדש' : 'עריכת מוצר'} sprite={isNew ? 'add_product' : 'product'}>
      <Input placeholder="שם המוצר" value={name} onChangeText={setName} />
      <Input placeholder="כמות" value={qty} onChangeText={setQty} keyboardType="number-pad" />
      <T style={{ fontWeight: '700' }}>אצל מי המוצר עכשיו</T>
      <Chips value={holder} onChange={setHolder} options={opts} />
      <T style={{ fontWeight: '700', marginTop: 6 }}>למי הוא צריך להגיע</T>
      <Chips value={receiver} onChange={setReceiver} options={opts} />
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 14 }}>
        <Btn kind="gold" title="שמירה" onPress={save} style={{ flex: 1 }} />
        <Btn kind="ghost" title="ביטול" onPress={onClose} />
      </View>
    </Sheet>
  );
}
