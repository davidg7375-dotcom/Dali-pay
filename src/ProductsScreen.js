import React, { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { supabase } from './supabase';
import { useTable } from './useTable';
import { Btn, Card, Chips, Empty, Input, Loading, Sheet, T, C } from './ui';

export default function ProductsScreen({ ctx }) {
  const { me, group, projects, isOwner } = ctx;
  const { rows, loading, error } = useTable('products', group.id);
  const [adding, setAdding] = useState(false);

  const upd = async (id, patch) => {
    const { error: e } = await supabase.from('products').update(patch).eq('id', id);
    if (e) Alert.alert('שגיאה', e.message);
  };
  const remove = (p) => Alert.alert('מחיקת מוצר', `למחוק את "${p.name}"?`, [
    { text: 'ביטול', style: 'cancel' },
    { text: 'מחיקה', style: 'destructive', onPress: async () => {
      const { error: e, count } = await supabase.from('products').delete({ count: 'exact' }).eq('id', p.id);
      if (e) Alert.alert('שגיאה', e.message);
      else if (!count) Alert.alert('אין הרשאה', 'רק יוצר המוצר או מנהל הקבוצה יכולים למחוק.');
    } },
  ]);

  if (loading) return <Loading />;
  return (
    <View style={{ flex: 1 }}>
      {error && <T style={{ color: C.red, margin: 14 }}>{error}</T>}
      <FlatList
        data={rows} keyExtractor={(p) => p.id} contentContainerStyle={{ padding: 14, paddingBottom: 90 }}
        ListEmptyComponent={<Empty text="אין מוצרים. הוסף ראשון!" />}
        renderItem={({ item: p }) => (
          <Card style={{ opacity: p.delivered ? 0.65 : 1 }}>
            <T style={{ fontSize: 18, fontWeight: '800' }}>{p.name}{p.delivered ? ' ✓' : ''}</T>
            {!!p.project_id && <T style={{ color: C.primary, fontSize: 13 }}>פרויקט: {projects.find((x) => x.id === p.project_id)?.name || ''}</T>}
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <Btn small kind="ghost" title="+" onPress={() => upd(p.id, { quantity: p.quantity + 1 })} />
              <T style={{ fontWeight: '800', minWidth: 28, textAlign: 'center' }}>{p.quantity}</T>
              <Btn small kind="ghost" title="−" disabled={p.quantity <= 0} onPress={() => upd(p.id, { quantity: Math.max(0, p.quantity - 1) })} />
              <Btn small kind={p.delivered ? 'ghost' : 'ok'} title={p.delivered ? 'בטל אספקה' : 'סופק'} onPress={() => upd(p.id, { delivered: !p.delivered })} />
              {(p.created_by === me || isOwner) && <Btn small kind="danger" title="מחיקה" onPress={() => remove(p)} />}
            </View>
          </Card>
        )}
      />
      <Btn title="+ מוצר חדש" onPress={() => setAdding(true)} style={{ position: 'absolute', bottom: 16, left: 16, right: 16 }} />
      {adding && <ProductForm ctx={ctx} onClose={() => setAdding(false)} />}
    </View>
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
    <Sheet visible onClose={onClose} title="מוצר חדש">
      <Input placeholder="שם המוצר" value={name} onChangeText={setName} />
      <Input placeholder="כמות" value={qty} onChangeText={setQty} keyboardType="number-pad" />
      {projects.length > 0 && (<><T>פרויקט (אופציונלי)</T>
        <Chips value={project} onChange={setProject} options={[{ value: null, label: 'ללא' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} /></>)}
      <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 14 }}>
        <Btn title="שמירה" onPress={save} style={{ flex: 1 }} />
        <Btn kind="ghost" title="ביטול" onPress={onClose} />
      </View>
    </Sheet>
  );
}
