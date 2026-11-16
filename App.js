import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, I18nManager, Pressable, StatusBar, View } from 'react-native';
import { configured, supabase } from './src/supabase';
import { useTable } from './src/useTable';
import AuthScreen from './src/AuthScreen';
import GroupSetup from './src/GroupSetup';
import HomeScreen from './src/HomeScreen';
import DebtsScreen from './src/DebtsScreen';
import ProductsScreen from './src/ProductsScreen';
import MessagesScreen from './src/MessagesScreen';
import { BitSheet, ComposeSheet, MessageView, PaySheet } from './src/Sheets';
import { debtViews } from './src/money';
import { listenForTaps, registerForPush, setupNotifications } from './src/notifications';
import SettingsScreen from './src/SettingsScreen';
import { C, Celebrate, FadeIn, Header, Loading, Sprite, T } from './src/ui';

// הממשק בנוי עם row-reverse ויישור לימין במפורש, לכן מכבים RTL אוטומטי של המערכת
// כדי שהמראה יהיה זהה בכל מכשיר (גם כשהשפה בטלפון היא עברית וגם אנגלית).
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);
setupNotifications();

const TABS = [
  { key: 'home', label: 'בית', icon: '🏠', color: C.purple },
  { key: 'debts', label: 'חובות', icon: '💸', color: C.pink },
  { key: 'products', label: 'מוצרים', icon: '📦', color: C.gold },
  { key: 'messages', label: 'הודעות', icon: '💬', color: C.blue },
  { key: 'settings', label: 'הגדרות', icon: '⚙️', color: C.magenta },
];

const TITLES = {
  home: ['DALI PAY', 'שני אידיוטים. מאזן אחד.', 'think_who'],
  debts: ['חובות', 'מי חייב למי', 'paid_cash'],
  products: ['מוצרים', 'מה יש ומה סופק', 'burger'],
  messages: ['הודעות', 'תזכורות, מדבקות ובקשות תשלום', 'reminder_sent'],
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
      <Intro />
      {session === undefined ? <Loading text="פותחים את DALI PAY..." sprite="sleeping" /> : !session ? <AuthScreen /> : <Authed userId={session.user.id} />}
    </View>
  );
}

// תמונת פתיחה קצרה עם הפוסטר של המותג, מתחלפת בהדרגה במסך הראשי
function Intro() {
  const [gone, setGone] = useState(false);
  const op = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => setGone(true)), 1700);
    return () => clearTimeout(t);
  }, []);
  if (gone) return null;
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, opacity: op, backgroundColor: '#4C1D95', alignItems: 'center', justifyContent: 'center' }}>
      <Sprite name="hero" width={320} />
    </Animated.View>
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
  const debts = useTable('debts', group.id);
  const payments = useTable('debt_payments', group.id);
  const products = useTable('products', group.id);
  const messages = useTable('messages', group.id);
  const debtViewsAll = useMemo(() => debtViews(debts.rows, payments.rows), [debts.rows, payments.rows]);
  const unread = messages.rows.filter((m) => m.recipient_id === userId && !m.read_at).length;

  const [viewMsg, setViewMsg] = useState(null);
  const [bitDebt, setBitDebt] = useState(null);
  const [payDebt, setPayDebt] = useState(null);
  const [compose, setCompose] = useState(null);
  const [pendingTap, setPendingTap] = useState(null);

  // התראות: רישום המכשיר, ולחיצה על התראה (גם כשהאפליקציה הייתה סגורה)
  useEffect(() => { registerForPush(); }, []);
  useEffect(() => listenForTaps((d) => setPendingTap(d)), []);
  useEffect(() => {
    if (!pendingTap) return;
    if (pendingTap.type === 'payment_request' && pendingTap.debt_id) {
      if (debts.loading || payments.loading) return;
      const v = debtViewsAll.find((x) => x.id === pendingTap.debt_id);
      if (pendingTap.message_id) setViewMsg(pendingTap.message_id);
      else if (v && !v.isPaid) setBitDebt(v);
    } else if (pendingTap.message_id) setViewMsg(pendingTap.message_id);
    setPendingTap(null);
  }, [pendingTap, debts.loading, payments.loading, debtViewsAll]);

  // הודעה חדשה שמגיעה בזמן שהאפליקציה פתוחה: חלון הודעה מיד
  const seen = useRef(null);
  useEffect(() => {
    if (messages.loading) return;
    const ids = new Set(messages.rows.map((m) => m.id));
    if (seen.current === null) { seen.current = ids; return; }
    const fresh = messages.rows.find((m) => !seen.current.has(m.id) && m.recipient_id === userId);
    seen.current = ids;
    if (fresh) setViewMsg(fresh.id);
  }, [messages.rows, messages.loading]);

  const ctx = useMemo(() => ({
    me: userId, group, isOwner: membership.role === 'owner',
    members: members.rows,
    debts: debts.rows, debtsState: debts, payments: payments.rows, debtViewsAll,
    products: products.rows, productsState: products,
    messages: messages.rows, messagesState: messages, unread,
    reloadMoney: () => { debts.reload(); payments.reload(); },
    openMessage: setViewMsg, openBit: setBitDebt, openPay: setPayDebt, openCompose: (o) => setCompose(o || {}),
    nameOf: (id) => members.rows.find((m) => m.user_id === id)?.display_name || '—',
    go: (t, i) => { setIntent(i || null); setTab(t); },
    intent, clearIntent: () => setIntent(null),
    celebrate: setCelebration,
  }), [userId, group, membership.role, members.rows, debts, payments.rows, debtViewsAll, products, messages, unread, intent]);

  const [title, subtitle, sprite] = TITLES[tab];
  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Header title={title} subtitle={subtitle} sprite={sprite} />
      <FadeIn key={tab}>
        {tab === 'home' && <HomeScreen ctx={ctx} />}
        {tab === 'debts' && <DebtsScreen ctx={ctx} />}
        {tab === 'products' && <ProductsScreen ctx={ctx} />}
        {tab === 'messages' && <MessagesScreen ctx={ctx} />}
        {tab === 'settings' && <SettingsScreen ctx={ctx} />}
      </FadeIn>
      <View style={{ flexDirection: 'row-reverse', backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.border, paddingBottom: 14, paddingTop: 6, paddingHorizontal: 6 }}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => { setIntent(null); setTab(t.key); }} style={{ flex: 1, alignItems: 'center' }}>
              <View style={{ backgroundColor: on ? t.color : 'transparent', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 }}>
                <T style={{ fontSize: 20, textAlign: 'center' }}>{t.icon}</T>
                {t.key === 'messages' && unread > 0 && (
                  <View style={{ position: 'absolute', top: -2, right: 0, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: 'center', justifyContent: 'center' }}>
                    <T style={{ color: '#fff', fontSize: 11, fontWeight: '900', textAlign: 'center' }}>{unread}</T>
                  </View>
                )}
              </View>
              <T style={{ fontSize: 12, textAlign: 'center', fontWeight: on ? '900' : '500', color: on ? t.color : C.muted, marginTop: 2 }}>{t.label}</T>
            </Pressable>
          );
        })}
      </View>
      {bitDebt && <BitSheet debt={bitDebt} ctx={ctx} onClose={() => setBitDebt(null)} onPay={(d) => setPayDebt(d)} />}
      {payDebt && <PaySheet debt={payDebt} ctx={ctx} onClose={() => setPayDebt(null)} />}
      {compose && <ComposeSheet ctx={ctx} initial={compose} onClose={() => setCompose(null)} />}
      {viewMsg && <MessageView id={viewMsg} ctx={ctx} onClose={() => setViewMsg(null)} onBit={(d) => setBitDebt(d)} onReply={(to) => setCompose({ to })} />}
      <Celebrate data={celebration} onDone={() => setCelebration(null)} />
    </View>
  );
}
