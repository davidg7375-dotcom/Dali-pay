import React, { useState } from 'react';
import { Alert, FlatList, View } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Empty, Input, T, C } from './ui';

// הפרויקטים נטענים ב-App (useTable) ומועברים ב-ctx כדי שיהיו זמינים גם בטפסים.
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
      <Card>
        <Input placeholder="שם פרויקט חדש" value={name} onChangeText={setName} />
        <Btn title="יצירת פרויקט" onPress={add} />
      </Card>
      <FlatList data={projects} keyExtractor={(p) => p.id} ListEmptyComponent={<Empty text="אין פרויקטים עדיין." />}
        renderItem={({ item: p }) => (
          <Card>
            <T style={{ fontSize: 18, fontWeight: '800' }}>{p.name}</T>
            <T style={{ color: C.muted, fontSize: 13 }}>נוצר ע״י {nameOf(p.created_by)}</T>
            {(p.created_by === me || isOwner) && <Btn small kind="danger" title="מחיקה" style={{ marginTop: 8, alignSelf: 'flex-end' }} onPress={() => remove(p)} />}
          </Card>
        )} />
    </View>
  );
}
