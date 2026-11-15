import React, { useState } from 'react';
import { View, Alert, ScrollView, Image } from 'react-native';
import { supabase } from './supabase';
import { AUTH_REDIRECT } from './authLink';
import { Btn, Input, T, C } from './ui';

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
      : await supabase.auth.signUp({ ...creds, options: { emailRedirectTo: AUTH_REDIRECT } });
    setBusy(false);
    if (error) {
      const m = /email not confirmed/i.test(error.message) ? 'האימייל עדיין לא אושר. לחץ על הקישור במייל, או בקש מייל חדש למטה.' : /invalid login/i.test(error.message) ? 'אימייל או סיסמה שגויים' : /already registered/i.test(error.message) ? 'המשתמש כבר קיים — עבור להתחברות' : error.message;
      return Alert.alert('שגיאה', m);
    }
    // כשאישור אימייל מופעל ב-Supabase, ההרשמה לא מחזירה session עד לאישור במייל
    if (mode === 'up' && !data?.session) Alert.alert('כמעט סיימנו', 'נשלח אליך אימייל אישור. אשר אותו ואז התחבר.');
  };

  const resend = async () => {
    if (!email.trim()) return Alert.alert('שגיאה', 'יש להזין אימייל');
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: AUTH_REDIRECT } });
    Alert.alert(error ? 'שגיאה' : 'נשלח', error ? error.message : 'נשלח מייל אישור חדש.');
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} keyboardShouldPersistTaps="handled">
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <Image source={require('../assets/icon.png')} style={{ width: 110, height: 110, borderRadius: 26 }} />
        <T style={{ fontSize: 28, fontWeight: '900', color: C.primaryDark, marginTop: 12, textAlign: 'center' }}>DALI PAY</T>
        <T style={{ color: C.muted, textAlign: 'center' }}>שני אידיוטים. מאזן אחד.</T>
      </View>
      <Input placeholder="אימייל" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Input placeholder="סיסמה" value={password} onChangeText={setPassword} secureTextEntry />
      <Btn title={mode === 'in' ? 'התחברות' : 'הרשמה'} onPress={submit} disabled={busy} />
      <Btn kind="ghost" style={{ marginTop: 10 }} title={mode === 'in' ? 'אין לי משתמש — הרשמה' : 'יש לי משתמש — התחברות'}
        onPress={() => setMode(mode === 'in' ? 'up' : 'in')} />
      <Btn kind="ghost" style={{ marginTop: 10 }} title="שלח שוב מייל אישור" onPress={resend} />
    </ScrollView>
  );
}
