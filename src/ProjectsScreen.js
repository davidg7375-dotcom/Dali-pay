import React, { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Empty, Input, Sprite, T, C } from './ui';

const AVATARS = ['hoodies', 'gamepad', 'coffee', 'split_done', 'relax'];
const pick = (id) => AVATARS[[...String(id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATARS.length];

export default function ProjectsScreen({ ctx }) {
  const { me, group, projects, isOwner, nameOf } = ctx;
  const [name, setName] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from('projects').insert({ group_id: group.id, name: name.trim() });
    if (error) Alert.alert('שגיאה', error.message); else setName('');
  };
  const remove = (p) => Alert.alert('מחיקת פרויקט', `למחוק את "${p.name}"? חובות ומוצרים יישארו ללא פרויקט.`, [
    { text: 'ביטול', style: 'cancel' },
    { text: 'מחיקה', style: 'destructive', onPress: async () => {
      const { error, count } = await supabase.from('projects').delete({ count: 'exact' }).eq('id', p.id);
      if (error) Alert.alert('שגיאה', error.message);
      else if (!count) Alert.alert('אין הרשאה', 'רק יוצר הפרויקט או מנהל הקבוצה יכולים למחוק.');
    } },
  ]);

  return (
    <View style={{ flex: 1, padding: 14 }}>
      <Card accent={C.blue}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 }}>
          <Sprite name="new_debt" width={56} height={56} cover round={16} style={{ marginLeft: 12 }} />
          <T style={{ fontWeight: '900', flex: 1, color: C.deep }}>פותחים פרויקט חדש</T>
        </View>
        <Input placeholder="שם הפרויקט" value={name} onChangeText={setName} />
        <Btn title="יצירת פרויקט" onPress={add} />
      </Card>
      <FlatList data={projects} keyExtractor={(p) => p.id}
        ListEmptyComponent={<Empty sprite="binoculars" title="אין פרויקטים עדיין" text="פרויקט עוזר לקבץ חובות ומוצרים. פתח את הראשון למעלה." />}
        renderItem={({ item: p }) => (
          <Card accent={C.cyan}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
              <Sprite name={pick(p.id)} width={72} height={60} cover round={16} enter={false} style={{ marginLeft: 12 }} />
              <View style={{ flex: 1 }}>
                <T style={{ fontSize: 18, fontWeight: '900' }}>{p.name}</T>
                <T style={{ color: C.muted, fontSize: 13 }}>נוצר ע״י {nameOf(p.created_by)}</T>
              </View>
            </View>
            {(p.created_by === me || isOwner) && <Btn small kind="danger" title="מחיקה" style={{ marginTop: 10, alignSelf: 'flex-end' }} onPress={() => remove(p)} />}
          </Card>
        )} />
    </View>
  );
}
