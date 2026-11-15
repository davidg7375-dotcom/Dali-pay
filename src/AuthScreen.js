import React, { useState } from 'react';
import { View, Alert, ScrollView } from 'react-native';
import { supabase } from './supabase';
import { Btn, Card, Input, Sprite, T, C, TOP } from './ui';

export default function AuthScreen() {
  const [mode, setMode] = useState('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 6) return Alert.alert('שגיאה', 'יש להזין אימייל וסיסמה (לפחות 6 תווים)');
    setBusy(true);
    const creds = { email: email.trim(), password };
    const { data, error } = mode === 'in'
      ? await supabase.auth.signInWithPassword(creds)
      : await supabase.auth.signUp(creds);
    setBusy(false);
    if (error) {
      const m = /email not confirmed/i.test(error.message) ? 'החשבון הזה נוצר כשאימות מייל היה פעיל ולא אושר. יש להירשם מחדש עם אימייל אחר.' : /invalid login/i.test(error.message) ? 'אימייל או סיסמה שגויים' : /already registered/i.test(error.message) ? 'המשתמש כבר קיים — עבור להתחברות' : error.message;
      return Alert.alert('שגיאה', m);
    }
    // ההרשמה אמורה להחזיר כניסה מיידית. אם לא — השרת עדיין דורש אימות מייל.
    if (mode === 'up' && !data?.session) {
      Alert.alert('ההרשמה לא הושלמה', 'השרת עדיין מוגדר לדרוש אימות מייל. יש לכבות את "Confirm email" ב-Supabase.');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 22, paddingTop: TOP + 16 }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <Sprite name="hero" width={250} float />
      </View>
      <Card style={{ padding: 18 }}>
        <T style={{ fontSize: 20, fontWeight: '900', color: C.deep, marginBottom: 12 }}>{mode === 'in' ? 'ברוכים השבים' : 'פותחים משתמש חדש'}</T>
        <Input placeholder="אימייל" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <Input placeholder="סיסמה" value={password} onChangeText={setPassword} secureTextEntry />
        <Btn title={mode === 'in' ? 'התחברות' : 'הרשמה'} onPress={submit} disabled={busy} />
        <Btn kind="ghost" style={{ marginTop: 12 }} title={mode === 'in' ? 'אין לי משתמש — הרשמה' : 'יש לי משתמש — התחברות'}
          onPress={() => setMode(mode === 'in' ? 'up' : 'in')} />
      </Card>
    </ScrollView>
  );
}
