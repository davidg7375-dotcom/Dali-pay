import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Input, Sprite, T, C, TOP } from './ui';

export default function GroupSetup({ onDone }) {
  const [display, setDisplay] = useState('');
  const [groupName, setGroupName] = useState('דוד ואלי');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn, args) => {
    if (!display.trim()) return Alert.alert('שגיאה', 'יש להזין את השם שלך (למשל: דוד)');
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) Alert.alert('שגיאה', error.message); else onDone();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: TOP + 16 }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginBottom: 6 }}>
        <Sprite name="new_debt" width={150} float />
      </View>
      <T style={{ fontSize: 26, fontWeight: '900', color: C.deep, textAlign: 'center' }}>בואו נתחיל</T>
      <T style={{ color: C.muted, textAlign: 'center', marginBottom: 14 }}>איך קוראים לך? כך יראו אותך באפליקציה.</T>
      <Input value={display} onChangeText={setDisplay} placeholder="דוד / אלי" />
      <Card accent={C.purple}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 }}>
          <Sprite name="cake" width={84} height={56} cover round={14} style={{ marginLeft: 12 }} />
          <T style={{ fontWeight: '800', flex: 1 }}>אני הראשון — פותחים קבוצה חדשה</T>
        </View>
        <Input value={groupName} onChangeText={setGroupName} placeholder="שם הקבוצה" />
        <Btn title="יצירת קבוצה" disabled={busy} onPress={() => run('create_group', { p_name: groupName.trim() || 'DALI PAY', p_display: display.trim() })} />
      </Card>
      <Card accent={C.cyan}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10 }}>
          <Sprite name="reminder_sent" width={56} height={56} cover round={14} style={{ marginLeft: 12 }} />
          <T style={{ fontWeight: '800', flex: 1 }}>קיבלתי קוד הזמנה מהשני</T>
        </View>
        <Input value={code} onChangeText={setCode} placeholder="קוד הזמנה" autoCapitalize="none" />
        <Btn kind="ghost" title="הצטרפות" disabled={busy} onPress={() => run('join_group', { p_code: code, p_display: display.trim() })} />
      </Card>
      <Btn kind="ghost" title="התנתקות" onPress={() => supabase.auth.signOut()} />
    </ScrollView>
  );
}
