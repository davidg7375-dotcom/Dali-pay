import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, I18nManager, Platform, Pressable, StatusBar, View } from 'react-native';
import { configured, supabase } from './src/supabase';
import { useTable } from './src/useTable';
import { listenForAuthLinks } from './src/authLink';
import AuthScreen from './src/AuthScreen';
import GroupSetup from './src/GroupSetup';
import DebtsScreen from './src/DebtsScreen';
import ProductsScreen from './src/ProductsScreen';
import ProjectsScreen from './src/ProjectsScreen';
import SettingsScreen from './src/SettingsScreen';
import { C, Loading, T } from './src/ui';

// הממשק בנוי עם row-reverse ויישור לימין במפורש, לכן מכבים RTL אוטומטי של המערכת
// כדי שהמראה יהיה זהה בכל מכשיר (גם כשהשפה בטלפון היא עברית וגם אנגלית).
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

const TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 44;
const Screen = ({ children, style }) => <View style={[{ flex: 1, backgroundColor: C.bg, paddingTop: TOP }, style]}>{children}</View>;

const TABS = [
  { key: 'debts', label: 'חובות', icon: '₪' },
  { key: 'products', label: 'מוצרים', icon: '📦' },
  { key: 'projects', label: 'פרויקטים', icon: '📁' },
  { key: 'settings', label: 'הגדרות', icon: '⚙️' },
];

export default function App() {
  if (!configured) {
    return (
      <Screen style={{ justifyContent: 'center', padding: 24 }}>
        <T style={{ fontSize: 20, fontWeight: '800', textAlign: 'center' }}>האפליקציה לא מחוברת לענן</T>
        <T style={{ textAlign: 'center', marginTop: 8 }}>חסרים EXPO_PUBLIC_SUPABASE_URL ו-EXPO_PUBLIC_SUPABASE_ANON_KEY. ראה README.</T>
      </Screen>
    );
  }
  return <Root />;
}

function Root() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    const stop = listenForAuthLinks((r) => { if (r.error) Alert.alert('אימות', r.error); });
    return () => { data.subscription.unsubscribe(); stop(); };
  }, []);

  return (
    <Screen>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      {session === undefined ? <Loading /> : !session ? <AuthScreen /> : <Authed userId={session.user.id} />}
    </Screen>
  );
}

function Authed({ userId }) {
  const [membership, setMembership] = useState(undefined);
  const [tab, setTab] = useState('debts');

  const loadMembership = useCallback(async () => {
    const { data: mem } = await supabase.from('members').select('group_id, role').eq('user_id', userId).limit(1);
    if (!mem || !mem.length) return setMembership(null);
    const { data: g } = await supabase.from('groups').select('*').eq('id', mem[0].group_id).single();
    setMembership({ group: g, role: mem[0].role });
  }, [userId]);
  useEffect(() => { loadMembership(); }, [loadMembership]);

  if (membership === undefined) return <Loading />;
  if (membership === null) return <GroupSetup onDone={loadMembership} />;

  return <Main userId={userId} membership={membership} tab={tab} setTab={setTab} />;
}

function Main({ userId, membership, tab, setTab }) {
  const group = membership.group;
  const { rows: members } = useTable('members', group.id);
  const { rows: projects } = useTable('projects', group.id);
  const ctx = useMemo(() => ({
    me: userId, group, members, projects, isOwner: membership.role === 'owner',
    nameOf: (id) => members.find((m) => m.user_id === id)?.display_name || '—',
  }), [userId, group, members, projects, membership.role]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingVertical: 12, backgroundColor: C.primary }}>
        <T style={{ color: '#fff', textAlign: 'center', fontSize: 20, fontWeight: '900' }}>DALI PAY</T>
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'debts' && <DebtsScreen ctx={ctx} />}
        {tab === 'products' && <ProductsScreen ctx={ctx} />}
        {tab === 'projects' && <ProjectsScreen ctx={ctx} />}
        {tab === 'settings' && <SettingsScreen ctx={ctx} />}
      </View>
      <View style={{ flexDirection: 'row-reverse', backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.border, paddingBottom: 16 }}>
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8 }}>
            <T style={{ fontSize: 20, textAlign: 'center' }}>{t.icon}</T>
            <T style={{ fontSize: 12, textAlign: 'center', fontWeight: tab === t.key ? '800' : '400', color: tab === t.key ? C.primary : C.muted }}>{t.label}</T>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
