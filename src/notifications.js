// התראות Push (FCM דרך expo-notifications). פועל רק באנדרואיד; בכל סביבה אחרת (תצוגה מקדימה) הכול no-op.
import { Platform } from 'react-native';
import { supabase } from './supabase';

let N = null;
if (Platform.OS === 'android') {
  try { N = require('expo-notifications'); } catch { N = null; }
}
export const CHANNEL = 'dalipay';
export const pushSupported = !!N;

export function setupNotifications() {
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
  N.setNotificationChannelAsync(CHANNEL, {
    name: 'הודעות DALI PAY', importance: N.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#6D28D9',
  }).catch(() => {});
}

// מחזיר {status: 'ok'|'denied'|'unavailable'|'error', detail?}
export async function registerForPush() {
  if (!N) return { status: 'unavailable' };
  try {
    let perm = await N.getPermissionsAsync();
    if (perm.status !== 'granted') perm = await N.requestPermissionsAsync();
    if (perm.status !== 'granted') return { status: 'denied' };
    const tok = await N.getDevicePushTokenAsync();
    const token = String(tok?.data || '');
    if (!token) return { status: 'error', detail: 'no token' };
    const { error } = await supabase.rpc('register_device', { p_token: token });
    if (error) return { status: 'error', detail: error.message };
    return { status: 'ok' };
  } catch (e) {
    return { status: 'error', detail: String(e?.message || e) };
  }
}

export async function unregisterPush() {
  if (!N) return;
  try {
    const tok = await N.getDevicePushTokenAsync();
    if (tok?.data) await supabase.rpc('unregister_device', { p_token: String(tok.data) });
  } catch { /* ignore */ }
}

// הנתונים של התראה: גם מ-content.data (התראה מקומית) וגם מ-trigger.remoteMessage.data (FCM כשהאפליקציה סגורה)
export function extractData(resp) {
  const req = resp?.notification?.request;
  return { ...(req?.trigger?.remoteMessage?.data || {}), ...(req?.content?.data || {}) };
}

// מאזין ללחיצות על התראות, כולל התראה שפתחה את האפליקציה מסגורה.
export function listenForTaps(cb) {
  if (!N) return () => {};
  const seen = new Set();
  const handle = (r) => {
    const key = `${r?.notification?.request?.identifier}:${r?.notification?.date}`;
    if (seen.has(key)) return;
    seen.add(key);
    const d = extractData(r);
    if (d && (d.message_id || d.debt_id)) cb(d);
  };
  N.getLastNotificationResponseAsync().then((r) => r && handle(r)).catch(() => {});
  const sub = N.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
