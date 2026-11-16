// פתיחת Bit בדרך רשמית בלבד: הפעלת האפליקציה המותקנת לפי שם החבילה, ואם אינה מותקנת, דף Google Play שלה.
// אין קישור/סכימה ששולחים תשלום מוכן מראש — Bit לא מפרסמת כזה, לכן הפרטים מועתקים והמשתמש משלם בעצמו.
import { Alert, Linking, Platform } from 'react-native';

export const BIT_PACKAGE = 'com.bnhp.payments.paymentsapp';
let Clip = null; let IL = null;
try { Clip = require('expo-clipboard'); } catch { Clip = null; }
if (Platform.OS === 'android') { try { IL = require('expo-intent-launcher'); } catch { IL = null; } }

export async function copyText(text) {
  try { if (Clip) { await Clip.setStringAsync(String(text)); return true; } } catch { /* ignore */ }
  return false;
}

export async function openBit() {
  if (IL) {
    try {
      await IL.startActivityAsync('android.intent.action.MAIN', { packageName: BIT_PACKAGE, category: 'android.intent.category.LAUNCHER' });
      return 'opened';
    } catch { /* לא מותקנת */ }
  }
  try { await Linking.openURL(`market://details?id=${BIT_PACKAGE}`); return 'store'; } catch { /* ignore */ }
  try { await Linking.openURL(`https://play.google.com/store/apps/details?id=${BIT_PACKAGE}`); return 'store'; } catch { /* ignore */ }
  Alert.alert('Bit', 'לא הצלחתי לפתוח את Bit. פתח אותה ידנית.');
  return 'failed';
}
