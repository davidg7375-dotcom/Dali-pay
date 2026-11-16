// עדכון מתוך האפליקציה: בדיקה מול GitHub Releases של הריפו, הורדת ה-APK והפעלת מתקין Android.
// בטיחות: רק קבצים מה-Releases של הריפו הזה; Android עצמו מתקין עדכון רק אם הוא חתום באותו מפתח ובאותו מזהה אפליקציה.
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as FS from 'expo-file-system';

export const REPO = 'davidg7375-dotcom/Dali-pay';
export const ASSET_PREFIX = `https://github.com/${REPO}/releases/download/`;

let legacy = null;
try { legacy = require('expo-file-system/legacy'); } catch (e) { legacy = null; }

export function currentBuild() {
  return parseInt(Application.nativeBuildVersion || '0', 10) || 0;
}

// תג גרסה בפורמט v1.2.<מספר בנייה>; מספר הבנייה הוא ה-versionCode של ה-APK
export function buildOfTag(tag) {
  const m = /^v\d+\.\d+\.(\d+)$/.exec(String(tag || ''));
  return m ? parseInt(m[1], 10) : 0;
}

export async function checkUpdate() {
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (!r.ok) throw new Error('בדיקת עדכון נכשלה (' + r.status + ')');
  const j = await r.json();
  const asset = (j.assets || []).find((a) => a.name === 'dali-pay.apk');
  const current = currentBuild();
  const latest = buildOfTag(j.tag_name);
  return {
    current, latest, tag: j.tag_name || '',
    available: !!asset && latest > current && current > 0,
    url: asset ? asset.browser_download_url : null,
    size: asset ? asset.size : 0,
  };
}

async function download(url) {
  const name = 'dali-pay-update.apk';
  if (FS.File && FS.Paths && typeof FS.File.downloadFileAsync === 'function') {
    const dest = new FS.File(FS.Paths.cache, name);
    try { if (dest.exists) dest.delete(); } catch (e) { /* ignore */ }
    const file = await FS.File.downloadFileAsync(url, dest);
    let uri = file && file.contentUri;
    if (!uri && legacy && legacy.getContentUriAsync) uri = await legacy.getContentUriAsync(file.uri);
    if (!uri) throw new Error('לא ניתן לפתוח את קובץ העדכון');
    return uri;
  }
  const L = legacy && legacy.downloadAsync ? legacy : FS;
  if (!L.downloadAsync) throw new Error('הורדה לא נתמכת במכשיר');
  const target = L.cacheDirectory + name;
  try { await L.deleteAsync(target, { idempotent: true }); } catch (e) { /* ignore */ }
  const res = await L.downloadAsync(url, target);
  if (!res || res.status !== 200) throw new Error('הורדת העדכון נכשלה');
  return L.getContentUriAsync(res.uri);
}

export async function installUpdate(url) {
  if (!String(url).startsWith(ASSET_PREFIX) || !/\.apk$/.test(url)) throw new Error('קישור עדכון לא מורשה');
  const contentUri = await download(url);
  // FLAG_GRANT_READ_URI_PERMISSION = 1. לא מחכים לסיום ההתקנה (המתקין מחליף את האפליקציה).
  IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri, type: 'application/vnd.android.package-archive', flags: 1,
  }).catch(() => {});
  return true;
}

export async function openInstallSettings() {
  await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', { data: 'package:' + (Application.applicationId || 'com.dalipay.app') });
  return true;
}
