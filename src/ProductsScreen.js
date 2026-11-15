import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Chips, Empty, ErrorBox, Input, Loading, Sheet, Sprite, T, C } from './ui';

const WAITING = ['burger', 'coffee', 'gamepad', 'think_howmuch'];
const DELIVERED = ['drinks', 'split_done', 'cake'];
const pick = (list, id) => list[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % list.length];

export default function ProductsScreen({ ctx }) {
  const { me, projects, isOwner, products: rows, productsState, intent, clearIntent, celebrate } = ctx;
  const { loading, error, reload } = productsState;
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (intent === 'new-product') { setAdding(true); clearIntent(); }
  }, [intent]);

  const upd = async (id, patch) => {
    const { error: e } = await supabase.from('products').update(patch).eq('id', id);
    if (e) Alert.alert('שגיאה', e.message);
    return !e;
  };
  const toggleDelivered = async (p) => {
    const ok = await upd(p.id, { delivered: !p.delivered });
    if (ok && !p.delivered) celebrate({ sprite: 'drinks', title: 'המוצר סופק!', subtitle: p.name });
  };
  const remove = (p) => Alert.alert('מחיקת מוצר', `למחוק את "${p.name}"?`, [
    { text: 'ביטול', style: 'cancel' },
    { text: 'מחיקה', style: 'destructive', onPress: async () => {
      const { error: e, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', p.id);
      if (e) Alert.alert('שגיאה', e.message);
      else if (!count) Alert.alert('אין הרשאה', 'רק יוצר המוצר או מנהל הקבוצה יכולים למחוק.');
    } },
  ]);

  if (loading) return <Loading text="מסנכרנים את המוצרים..." sprite="hoodies" />;
  return (
    <View style={{ flex: 1 }}>
      {error && <View style={{ marginTop: 14 }}><ErrorBox text={error} onRetry={reload} /></View>}
      <FlatList
        data={rows} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 14, paddingBottom: 96 }}
        ListEmptyComponent={<Empty sprite="think_who" title="אין מוצרים עדיין" text="מה מוסיפים ראשון? לחץ על הכפתור למטה." />}
        renderItem={({ item: p }) => (
          <Card accent={p.delivered ? C.green : C.gold} style={{ opacity: p.delivered ? 0.75 : 1 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Sprite name={p.delivered ? pick(DELIVERED, p.id) : pick(WAITING, p.id)} width={70} height={70} cover round={18} enter={false} style={{ marginLeft: 12 }} />
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 19, fontWeight: '900' }}>{p.name}{p.delivered ? ' ✓' : ''}</T>
                <T style={{ color: p.delivered ? C.greenDark : C.gold, fontSize: 13, fontWeight: '700' }}>{p.delivered ? 'סופק' : 'ממתין למסירה'}</T>
                {!!p.project_id && <T style={{ color: C.purple, fontSize: 13 }}>פרויקט: {projects.find((x) => x.id === p.project_id)?.name || ''}</T>}
              </View>
            </View>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <Round label="+" onPress={() => upd(p.id, { quantity: p.quantity + 1 })} />
              <T style={{ fontWeight: '900', minWidth: 30, textAlign: 'center', fontSize: 18 }}>{p.quantity}</T>
              <Round label="−" disabled={p.quantity <= 0} onPress={() => upd(p.id, { quantity: Math.max(0, p.quantity - 1) })} />
              <Btn small kind={p.delivered ? 'ghost' : 'ok'} title={p.delivered ? 'בטל אספקה' : 'סופק'} onPress={() => toggleDelivered(p)} />
              {(p.created_by === me || isOwner) && <Btn small kind="danger" title="מחיקה" onPress={() => remove(p)} />}
            </View>
          </Card>
        )}
      />
      <Btn kind="gold" title="+ מוצר חדש" onPress={() => setAdding(true)} style={{ position: 'absolute', bottom: 14, left: 16, right: 16 }} />
      {adding && <ProductForm ctx={ctx} onClose={() => setAdding(false)} />}
    </View>
  );
}

function Round({ label, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: C.lilac, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] })}>
      <T style={{ fontSize: 22, fontWeight: '900', color: C.deep, textAlign: 'center', lineHeight: 26 }}>{label}</T>
    </Pressable>
  );
}

function ProductForm({ ctx, onClose }) {
  const { group, projects } = ctx;
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [project, setProject] = useState(null);
  const save = async () => {
    const q = parseInt(qty, 10);
    if (!name.trim()) return Alert.alert('שגיאה', 'יש להזין שם מוצר');
    if (!(q >= 0)) return Alert.alert('שגיאה', 'כמות לא תקינה');
    const { error } = await supabase.from('products').insert({ group_id: group.id, name: name.trim(), quantity: q, project_id: project });
    if (error) Alert.alert('שגיאה', error.message); else onClose();
  };
  return (
    <Sheet visible onClose={onClose} title="מוצר חדש" sprite="burger">
      <Input placeholder="שם המוצר" value={name} onChangeText={setName} />
      <Input placeholder="כמות" value={qty} onChangeText={setQty} keyboardType="number-pad" />
      {projects.length > 0 && (<><T style={{ fontWeight: '700' }}>פרויקט (אופציונלי)</T>
        <Chips value={project} onChange={setProject} options={[{ value: null, label: 'ללא' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} /></>)}
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 14 }}>
        <Btn kind="gold" title="שמירה" onPress={save} style={{ flex: 1 }} />
        <Btn kind="ghost" title="ביטול" onPress={onClose} />
      </View>
    </Sheet>
  );
}
