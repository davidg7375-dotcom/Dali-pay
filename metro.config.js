// הגדרת Metro. במצב רגיל (כולל בניית ה-APK) זו ברירת המחדל של Expo בלי שום שינוי.
// רק כש-DALI_PREVIEW=1 (תצוגה מקדימה לבדיקות ב-CI) מוחלף חיבור Supabase בנתוני דמה מקומיים.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

if (process.env.DALI_PREVIEW === '1') {
  const fake = path.resolve(__dirname, 'preview/fakeSupabase.js');
  const original = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, name, platform) => {
    if (name.startsWith('.') && /(^|\/)supabase$/.test(name)) return { type: 'sourceFile', filePath: fake };
    return original ? original(context, name, platform) : context.resolveRequest(context, name, platform);
  };
}

module.exports = config;
