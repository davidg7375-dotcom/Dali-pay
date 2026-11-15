import React from 'react';
import { Alert, ScrollView, Share } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, T, C } from './ui';

export default function SettingsScreen({ ctx }) {
  const { group, members, me } = ctx;

  // ייצוא כל נתוני הקבוצה לקובץ JSON (שיתוף/שמירה דרך חלון השיתוף של Android)
  const exportData = async () => {
    try {
      const out = { exportedAt: new Date().toISOString(), group, members };
      for (const t of ['projects', 'debts', 'products']) {
        const { data, error } = await supabase.from(t).select('*').eq('group_id', group.id);
        if (error) throw error;
        out[t] = data;
      }
      await Share.share({ title: 'DALI PAY — גיבוי', message: JSON.stringify(out, null, 2) });
    } catch (e) {
      Alert.alert('שגיאה בייצוא', String(e.message || e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 14 }}>
      <Card>
        <T style={{ fontWeight: '800' }}>קבוצה: {group.name}</T>
        <T style={{ marginTop: 8 }}>קוד הזמנה למשתמש נוסף:</T>
        <T selectable style={{ fontSize: 26, fontWeight: '900', color: C.primary, textAlign: 'center', marginVertical: 8 }}>{group.invite_code}</T>
        <Btn kind="ghost" title="שיתוף קוד" onPress={() => Share.share({ message: `הצטרף ל-DALI PAY עם קוד ההזמנה: ${group.invite_code}` })} />
      </Card>
      <Card>
        <T style={{ fontWeight: '800', marginBottom: 6 }}>משתמשים בקבוצה</T>
        {members.map((m) => <T key={m.user_id}>• {m.display_name}{m.user_id === me ? ' (אני)' : ''}{m.role === 'owner' ? ' — מנהל' : ''}</T>)}
      </Card>
      <Card>
        <T style={{ fontWeight: '800', marginBottom: 6 }}>גיבוי</T>
        <T style={{ color: C.muted, marginBottom: 8 }}>כל הנתונים נשמרים בענן. אפשר גם לייצא עותק מקומי.</T>
        <Btn title="ייצוא נתונים (JSON)" onPress={exportData} />
      </Card>
      <Btn kind="ghost" title="התנתקות" onPress={() => supabase.auth.signOut()} />
      <T style={{ color: C.muted, textAlign: 'center', marginTop: 16 }}>DALI PAY v1.0.0</T>
    </ScrollView>
  );
}
