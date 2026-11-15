import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { I18nManager, Pressable, StatusBar, View } from 'react-native';
import { configured, supabase } from './src/supabase';
import { useTable } from './src/useTable';
import AuthScreen from './src/AuthScreen';
import GroupSetup from './src/GroupSetup';
import HomeScreen from './src/HomeScreen';
import DebtsScreen from './src/DebtsScreen';
import ProductsScreen from './src/ProductsScreen';
import ProjectsScreen from './src/ProjectsScreen';
import SettingsScreen from './src/SettingsScreen';
import { C, Celebrate, FadeIn, Header, Loading, T } from './src/ui';

// הממשק בנוי עם row-reverse ויישור לימין במפורש, לכן מכבים RTL אוטומטי של המערכת
// כדי שהמראה יהיה זהה בכל מכשיר (גם כשהשפה בטלפון היא עברית וגם אנגלית).
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

const TABS = [
  { key: 'home', label: 'בית', icon: '🏠', color: C.purple },
  { key: 'debts', label: 'חובות', icon: '💸', color: C.pink },
  { key: 'products', label: 'מוצרים', icon: '📦', color: C.gold },
  { key: 'projects', label: 'פרויקטים', icon: '📁', color: C.blue },
  { key: 'settings', label: 'הגדרות', icon: '⚙️', color: C.magenta },
];

const TITLES = {
  home: ['DALI PAY', 'שני אידיוטים. מאזן אחד.', 'think_who'],
  debts: ['חובות', 'מי חייב למי', 'paid_cash'],
  products: ['מוצרים', 'מה יש ומה סופק', 'burger'],
  projects: ['פרויקטים', 'מסדרים הכול במקום אחד', 'binoculars'],
  settings: ['הגדרות', 'הזמנות, גיבוי וחשבון', 'coffee'],
};

export default function App() {
  if (!configured) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: C.bg }}>
        <T style={{ fontSize: 20, fontWeight: '800', textAlign: 'center' }}>האפליקציה לא מחוברת לענן</T>
        <T style={{ textAlign: 'center', marginTop: 8 }}>חסרים EXPO_PUBLIC_SUPABASE_URL ו-EXPO_PUBLIC_SUPABASE_ANON_KEY. ראה README.</T>
      </View>
    );
  }
  return <Root />;
}

function Root() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      {session === undefined ? <Loading text="פותחים את DALI PAY..." sprite="sleeping" /> : !session ? <AuthScreen /> : <Authed userId={session.user.id} />}
    </View>
  );
}

function Authed({ userId }) {
  const [membership, setMembership] = useState(undefined);

  const loadMembership = useCallback(async () => {
    const { data: mem } = await supabase.from('members').select('group_id, role').eq('user_id', userId).limit(1);
    if (!mem || !mem.length) return setMembership(null);
    const { data: g } = await supabase.from('groups').select('*').eq('id', mem[0].group_id).single();
    setMembership({ group: g, role: mem[0].role });
  }, [userId]);
  useEffect(() => { loadMembership(); }, [loadMembership]);

  if (membership === undefined) return <Loading text="מסנכרנים את החשבון שלך..." sprite="hoodies" />;
  if (membership === null) return <GroupSetup onDone={loadMembership} />;
  return <Main userId={userId} membership={membership} />;
}

function Main({ userId, membership }) {
  const group = membership.group;
  const [tab, setTab] = useState('home');
  const [intent, setIntent] = useState(null);
  const [celebration, setCelebration] = useState(null);

  // כל הטבלאות נטענות כאן ומסונכרנות בזמן אמת — המסכים רק מציגים
  const members = useTable('members', group.id);
  const projects = useTable('projects', group.id);
  const debts = useTable('debts', group.id);
  const products = useTable('products', group.id);

  const ctx = useMemo(() => ({
    me: userId, group, isOwner: membership.role === 'owner',
    members: members.rows, projects: projects.rows,
    debts: debts.rows, debtsState: debts,
    products: products.rows, productsState: products,
    nameOf: (id) => members.rows.find((m) => m.user_id === id)?.display_name || '—',
    go: (t, i) => { setIntent(i || null); setTab(t); },
    intent, clearIntent: () => setIntent(null),
    celebrate: setCelebration,
  }), [userId, group, membership.role, members.rows, projects.rows, debts, products, intent]);

  const [title, subtitle, sprite] = TITLES[tab];
  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Header title={title} subtitle={subtitle} sprite={sprite} />
      <FadeIn key={tab}>
        {tab === 'home' && <HomeScreen ctx={ctx} />}
        {tab === 'debts' && <DebtsScreen ctx={ctx} />}
        {tab === 'products' && <ProductsScreen ctx={ctx} />}
        {tab === 'projects' && <ProjectsScreen ctx={ctx} />}
        {tab === 'settings' && <SettingsScreen ctx={ctx} />}
      </FadeIn>
      <View style={{ flexDirection: 'row-reverse', backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.border, paddingBottom: 14, paddingTop: 6, paddingHorizontal: 6 }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => { setIntent(null); setTab(t.key); }} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ backgroundColor: on ? t.color : 'transparent', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 }}>
                <T style={{ fontSize: 20, textAlign: 'center' }}>{t.icon}</T>
              </View>
              <T style={{ fontSize: 12, textAlign: 'center', fontWeight: on ? '900' : '500', color: on ? t.color : C.muted, marginTop: 2 }}>{t.label}</T>
            </Pressable>
          );
        })}
      </View>
      <Celebrate data={celebration} onDone={() => setCelebration(null)} />
    </View>
  );
}
