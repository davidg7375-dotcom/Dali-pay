import { Linking } from 'react-native';
import { supabase } from './supabase';

// הכתובת שאליה Supabase מחזיר את המשתמש אחרי לחיצה על קישור האישור במייל.
// חייבת להופיע ב-Supabase תחת Authentication ← URL Configuration ← Redirect URLs.
export const AUTH_REDIRECT = 'dalipay://auth-callback';

// מפענח קישור חזרה מ-Supabase ומשלים התחברות. מחזיר { handled, error }.
export async function handleAuthUrl(url) {
  if (!url || !url.startsWith('dalipay://')) return { handled: false };
  const qIndex = url.indexOf('?');
  const hIndex = url.indexOf('#');
  const params = new URLSearchParams();
  [hIndex >= 0 ? url.slice(hIndex + 1) : '', qIndex >= 0 ? url.slice(qIndex + 1, hIndex > qIndex ? hIndex : undefined) : '']
    .forEach((part) => new URLSearchParams(part).forEach((v, k) => params.set(k, v)));

  const errDesc = params.get('error_description') || params.get('error');
  if (errDesc) {
    const msg = /expired|invalid/i.test(errDesc)
      ? 'קישור האישור פג תוקף או כבר נוצל. אם כבר אישרת — פשוט התחבר. אחרת בקש מייל חדש.'
      : errDesc.replace(/\+/g, ' ');
    return { handled: true, error: msg };
  }
  try {
    if (params.get('code')) {
      const { error } = await supabase.auth.exchangeCodeForSession(params.get('code'));
      return { handled: true, error: error?.message };
    }
    if (params.get('access_token') && params.get('refresh_token')) {
      const { error } = await supabase.auth.setSession({
        access_token: params.get('access_token'),
        refresh_token: params.get('refresh_token'),
      });
      return { handled: true, error: error?.message };
    }
  } catch (e) {
    return { handled: true, error: String(e.message || e) };
  }
  return { handled: true };
}

// מאזין לקישורים: גם כשהאפליקציה נפתחת מהקישור וגם כשהיא כבר פתוחה ברקע.
export function listenForAuthLinks(onResult) {
  const run = (url) => handleAuthUrl(url).then((r) => { if (r.handled) onResult(r); });
  Linking.getInitialURL().then((u) => u && run(u)).catch(() => {});
  const sub = Linking.addEventListener('url', ({ url }) => run(url));
  return () => sub.remove();
}
