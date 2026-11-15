import React from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Sprite, T, C } from './ui';

const BADGES = [C.purple, C.pink, C.blue, C.gold];

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
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
      <Card accent={C.purple}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
          <Sprite name="drinks" width={96} height={72} cover round={18} float style={{ marginLeft: 12 }} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '900', color: C.deep }}>קבוצה: {group.name}</T>
            <T style={{ color: C.muted, fontSize: 14 }}>קוד הזמנה למשתמש נוסף:</T>
          </View>
        </View>
        <T selectable style={{ fontSize: 28, fontWeight: '900', color: C.purple, textAlign: 'center', marginVertical: 10, letterSpacing: 2 }}>{group.invite_code}</T>
        <Btn kind="ghost" title="שיתוף קוד" onPress={() => Share.share({ message: `הצטרף ל-DALI PAY עם קוד ההזמנה: ${group.invite_code}` })} />
      </Card>

      <Card accent={C.cyan}>
        <T style={{ fontWeight: '900', marginBottom: 8, color: C.deep }}>מי בקבוצה</T>
        {members.map((m, i) => (
          <View key={m.user_id} style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: BADGES[i % BADGES.length], alignItems: 'center', justifyContent: 'center', marginLeft: 10 }}>
              <T style={{ color: '#fff', fontWeight: '900', textAlign: 'center' }}>{(m.display_name || '?').slice(0, 1)}</T>
            </View>
            <T style={{ fontWeight: '700' }}>{m.display_name}{m.user_id === me ? ' (אני)' : ''}{m.role === 'owner' ? ' — מנהל' : ''}</T>
          </View>
        ))}
      </Card>

      <Card accent={C.gold}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8 }}>
          <Sprite name="piggy" width={88} height={64} cover round={16} style={{ marginLeft: 12 }} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '900', color: C.deep }}>גיבוי</T>
            <T style={{ color: C.muted, fontSize: 14 }}>כל הנתונים נשמרים בענן. אפשר גם לייצא עותק מקומי.</T>
          </View>
        </View>
        <Btn kind="gold" title="ייצוא נתונים (JSON)" onPress={exportData} />
      </Card>

      <Btn kind="ghost" title="התנתקות" onPress={() => supabase.auth.signOut()} />
      <T style={{ color: C.muted, textAlign: 'center', marginTop: 16 }}>DALI PAY v1.1.0</T>
    </ScrollView>
  );
}
