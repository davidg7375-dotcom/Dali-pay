import React, { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Input, T, C } from './ui';

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
    <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <T style={{ fontSize: 24, fontWeight: '800', color: C.primaryDark, marginBottom: 12 }}>הגדרה ראשונית</T>
      <T style={{ marginBottom: 6 }}>השם שלך באפליקציה</T>
      <Input value={display} onChangeText={setDisplay} placeholder="דוד / אלי" />
      <Card>
        <T style={{ fontWeight: '700', marginBottom: 8 }}>אני הראשון — יצירת קבוצה חדשה</T>
        <Input value={groupName} onChangeText={setGroupName} placeholder="שם הקבוצה" />
        <Btn title="יצירת קבוצה" disabled={busy} onPress={() => run('create_group', { p_name: groupName.trim() || 'DALI PAY', p_display: display.trim() })} />
      </Card>
      <Card>
        <T style={{ fontWeight: '700', marginBottom: 8 }}>יש לי קוד הזמנה מהשני</T>
        <Input value={code} onChangeText={setCode} placeholder="קוד הזמנה" autoCapitalize="none" />
        <Btn kind="ghost" title="הצטרפות" disabled={busy} onPress={() => run('join_group', { p_code: code, p_display: display.trim() })} />
      </Card>
      <Btn kind="ghost" title="התנתקות" onPress={() => supabase.auth.signOut()} />
    </ScrollView>
  );
}
