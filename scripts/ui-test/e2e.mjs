// בדיקת קצה-לקצה: הממשק האמיתי (webui/dist/index.html) בשני הקשרי דפדפן, דרך הגשר האמיתי, מול שרת מדומה משותף.
// מריצים: node scripts/build-webui.mjs && NODE_PATH=$(npm root -g) node scripts/ui-test/e2e.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBridge } from '../../src/bridge.js';
import { createFakeServer } from '../unit-tests/fake-supabase.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = fs.readFileSync(path.join(root, 'webui/dist/index.html'), 'utf8');
const OUT = process.env.SHOTS || '/tmp/dalipay-shots/'; fs.mkdirSync(OUT, { recursive: true });
const BASE = 'https://dalipay.app.local/';
const server = createFakeServer();
let fails = 0;
const ok = (name, cond, info = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fails++; };

async function user(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  const opened = [], notes = [], installs = [];
  const upd = { info: { available: false } };
  const update = { check: async () => upd.info, install: async (u) => { installs.push(u); }, settings: async () => { installs.push('settings'); } };
  const bridge = createBridge(server.clientFor(), { emit: (o) => page.evaluate((m) => window.__fromNative(m), o).catch(() => {}), share: async () => {}, exit: () => { page.__exited = true; }, open: async (u) => opened.push(u), notify: (t) => notes.push(t), update });
  await page.exposeFunction('__host', async (s) => { const r = await bridge.handle(JSON.parse(s)); await page.evaluate((m) => window.__fromNative(m), r).catch(() => {}); });
  await page.addInitScript(() => { window.DP_SPLASH_MS = 300; window.ReactNativeWebView = { postMessage: (s) => window.__host(s) }; });
  await page.route(BASE + '**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(BASE);
  return { page, errs, opened, bridge, notes, installs, upd };
}
const txt = (p, sel) => p.locator(sel).innerText();
const wait = (p, ms = 500) => p.waitForTimeout(ms);
const isOn = (p, sel) => p.locator(sel).evaluate((n) => n.classList.contains('on'));
const bg = (p, sel) => p.locator(sel).evaluate((n) => n.style.backgroundImage);

const browser = await chromium.launch();
const D = await user(browser), E = await user(browser);
const [d, e] = [D.page, E.page];

// ── כניסה, קבוצה ובחירת דמות
await wait(d, 900);
ok('דוד: מסך כניסה', await d.locator('#gate.on #gEmail').count() === 1);
await d.click('#gSw'); await d.fill('#gEmail', 'david@test.com'); await d.fill('#gPass', 'secret1'); await d.click('#gGo'); await wait(d, 700);
await d.fill('#gName', 'דוד'); await d.click('#gNew'); await wait(d, 1000);
ok('דוד: מסך בחירת דמות מופיע', await isOn(d, '#pick'));
await d.screenshot({ path: OUT + 'e01-pick.png' });
await d.click('#pick .opt[data-av="a"]'); await wait(d, 1100);
ok('דוד: הבחירה נסגרה', !(await isOn(d, '#pick')));
ok('דוד: הדמות שלו (a) בכרטיס "אני חייב"', (await bg(d, '#avMe')).includes('face_a'));
ok('דוד: הדמות השנייה (b) בכרטיס "חייבים לי"', (await bg(d, '#avOther')).includes('face_b'));
const code = await d.evaluate(() => document.querySelector('#inviteCard b').textContent);

await wait(e, 900);
await e.click('#gSw'); await e.fill('#gEmail', 'eli@test.com'); await e.fill('#gPass', 'secret2'); await e.click('#gGo'); await wait(e, 700);
await e.fill('#gName', 'אלי'); await e.fill('#gCode', code); await e.click('#gJoin'); await wait(e, 1300);
ok('אלי: לא נשאל (קיבל אוטומטית את הדמות השנייה)', !(await isOn(e, '#pick')));
ok('אלי: הדמות שלו (b) בכרטיס "אני חייב" — הפוך מדוד', (await bg(e, '#avMe')).includes('face_b'));
ok('אלי: דוד (a) בכרטיס "חייבים לי"', (await bg(e, '#avOther')).includes('face_a'));
await e.reload(); await wait(e, 1500);
ok('אלי: הבחירה נשמרה אחרי פתיחה מחדש', !(await isOn(e, '#pick')) && (await bg(e, '#avMe')).includes('face_b'));

// ── דוד שומר קישור Bit
await d.click('#whoBtn'); await wait(d, 400);
await d.fill('#bLink', 'https://www.bitpay.co.il/app/me/DAVID123'); await d.click('#bSave'); await wait(d, 900);
ok('דוד: קישור Bit נשמר', server.db.members.find((m) => m.display_name === 'דוד').bit_link === 'https://www.bitpay.co.il/app/me/DAVID123');

// ── חוב: דוד יוצר "אלי חייב לי 120"
await d.click('#bDebt'); await wait(d, 400);
await d.fill('#fAmt', '120'); await d.click('#fDir button[data-v="0"]'); await d.fill('#fWhy', 'מטען'); await d.click('#fSave'); await wait(d, 1100);
await wait(e, 700);
ok('אלי: אני חייב 120 (סנכרון)', (await txt(e, '#sIowe')).includes('120'), await txt(e, '#sIowe'));
ok('אלי: באנר "שלם עכשיו ב-Bit" ליד החוב', (await txt(e, '[data-bit]')).includes('שלם עכשיו ב-Bit') && (await txt(e, '[data-bit]')).includes('120'));
await e.locator('[data-debt]').first().scrollIntoViewIfNeeded(); await wait(e, 2600); await e.screenshot({ path: OUT + 'e015-bitbar.png' });
await e.click('[data-bit]'); await wait(e, 500);
ok('באנר Bit פותח ישירות את הקישור של דוד (בלי לפתוח את חלון החוב)', E.opened.length === 1 && E.opened[0].includes('DAVID123') && !(await isOn(e, '#sheet')), E.opened.join());
ok('בכרטיס של דוד (המקבל) אין באנר Bit', await (async () => { await wait(d, 300); return (await d.locator('[data-bit]').count()) === 0; })());
E.opened.length = 0;

// ── אלי (חייב): אין כפתור סגירה, יש Bit ודיווח
await e.locator('[data-debt] .row').first().click(); await wait(e, 500);
ok('אלי: אין "סגור חוב" / תשלום חלקי לחייב', await e.locator('#aPaid').count() === 0 && await e.locator('#pGo').count() === 0);
ok('אלי: אין מחיקה לחייב', await e.locator('#aDel').count() === 0);
ok('אלי: מוצג סכום ומקבל', (await txt(e, '.paybox')).includes('120') && (await txt(e, '.paybox')).includes('דוד'));
await e.screenshot({ path: OUT + 'e02-debtor-sheet.png' });
await e.click('#aBit'); await wait(e, 400);
ok('אלי: כפתור Bit פותח את הקישור של דוד', E.opened[0] === 'https://www.bitpay.co.il/app/me/DAVID123', E.opened.join());
ok('פתיחת Bit לא סגרה ולא שינתה את החוב', (await txt(e, '#sIowe')).includes('120') && server.db.debt_payments.length === 0);
const forced = await E.bridge.handle({ id: 99, op: 'recordPayment', args: { debtId: server.db.debts[0].id, amount: 120 } });
ok('עקיפת הממשק: החייב לא יכול לרשום תשלום בשרת', !forced.ok && /רק מי שמקבל/.test(forced.error), forced.error);
const forced2 = await E.bridge.handle({ id: 98, op: 'updateDebt', args: { id: server.db.debts[0].id, patch: { amount: 1 } } });
ok('עקיפת הממשק: החייב לא יכול להקטין סכום', !forced2.ok, forced2.error);
await e.fill('#rAmt', '50'); await e.click('#rGo'); await wait(e, 1000);
ok('אלי: דיווח נשלח ומוצג "ממתין לאישור"', (await txt(e, '#debts')).includes('ממתין לאישור'));
ok('אלי: החוב לא השתנה עד אישור', (await txt(e, '#sIowe')).includes('120'));
await wait(d, 900);
ok('דוד: מקבל הודעת מערכת על הדיווח', D.notes.some((t) => t.includes('דיווח ששילם')), D.notes.join(' | '));
ok('דוד: כרטיס החוב מסומן "לאישור שלך"', (await txt(d, '#debts')).includes('לאישור שלך'));
await d.locator('[data-debt] .row').first().click(); await wait(d, 500);
await d.screenshot({ path: OUT + 'e03-creditor-sheet.png' });
await d.locator('[data-ok]').first().click(); await wait(d, 1200);
ok('דוד: אישר — נותר 70', (await txt(d, '#sOwed')).includes('70'), await txt(d, '#sOwed'));
await wait(e, 900);
ok('אלי: רואה 70 והדיווח נעלם', (await txt(e, '#sIowe')).includes('70') && !(await txt(e, '#debts')).includes('ממתין לאישור'));

// ── דיווח שנדחה
await e.locator('[data-debt] .row').first().click(); await wait(e, 500); await e.fill('#rAmt', '70'); await e.click('#rGo'); await wait(e, 900);
await wait(d, 700); await d.locator('[data-debt] .row').first().click(); await wait(d, 500);
await d.locator('[data-no]').first().click(); await wait(d, 1000);
ok('דוד: דחה דיווח — החוב נשאר 70', (await txt(d, '#sOwed')).includes('70'));

// ── חייב עורך: הקטנה נחסמת, הגדלה מותרת
await e.locator('[data-debt] .row').first().click(); await wait(e, 500); await e.click('#aEdit'); await wait(e, 400);
ok('אלי: אין בחירת כיוון בעריכה', await e.locator('#fDir').count() === 0);
await e.fill('#fAmt', '100'); await e.click('#fSave'); await wait(e, 600);
ok('אלי: הקטנת סכום נחסמה (הודעת מערכת)', E.notes.some((t) => t.includes('להקטין')), E.notes.join(' | '));
await e.click('#scrim', { position: { x: 5, y: 5 } }); await wait(e, 400);

// ── סגירה מלאה ע"י המקבל
await d.locator('[data-debt] .row').first().click(); await wait(d, 500); await d.click('#aPaid'); await wait(d, 600);
await d.screenshot({ path: OUT + 'e04-celebrate.png' });
await wait(d, 800);
ok('דוד: החוב נסגר', await d.locator('[data-debt]').count() === 0);
await wait(e, 700);
ok('אלי: רואה שנסגר', await e.locator('[data-debt]').count() === 0);

// ── מוצר ופתק
await d.click('#bProd'); await wait(d, 400); await d.fill('#mName', 'מצלמה'); await d.fill('#mQty', '2'); await d.click('#mSave'); await wait(d, 1000);
await wait(e, 700); await e.locator('[data-prod]').click(); await wait(e, 400); await e.click('#xDone'); await wait(e, 1000);
ok('מוצר נמסר ומסונכרן', (await txt(d, '#prods')).includes('אין מוצרים בדרך') || (await wait(d, 700), (await txt(d, '#prods')).includes('אין מוצרים בדרך')));
await d.click('#bNote'); await wait(d, 400); await d.fill('#nTxt', 'תודה על הקפה ☕'); await d.click('#nSave'); await wait(d, 1000);
await wait(e, 700);
ok('פתק נעוץ אצל שניהם, ודיווחי תשלום לא מוצגים כפתקים', (await txt(e, '#notesWrap')).includes('תודה על הקפה') && !(await txt(e, '#notesWrap')).includes('דיווח'));

// ── החלונית הלבנה העליונה הוסרה
ok('אין יותר חלונית לבנה עליונה (#toast)', await d.locator('#toast').count() === 0 && await e.locator('#toast').count() === 0);
ok('פעולות מוצלחות לא מציגות חלונית/הודעה', !D.notes.some((t) => /נוסף|נמחק|ננעץ|הוסר/.test(t)), D.notes.join(' | '));

// ── עדכון מתוך האפליקציה
E.upd.info = { available: true, current: 11, latest: 12, tag: 'v1.2.12', size: 36 * 1048576, url: 'https://github.com/davidg7375-dotcom/Dali-pay/releases/download/v1.2.12/dali-pay.apk' };
await e.evaluate(() => window.__fromNative({ event: 'resume' })); await wait(e, 700);
ok('עדכון: לא נבדק שוב לפני שעה (אין הצפה)', !(await isOn(e, '#upd')));
await e.reload(); await wait(e, 1700);
ok('עדכון: מופיעה הודעה עם "עדכן עכשיו"', await isOn(e, '#upd') && (await txt(e, '#upd')).includes('עדכן עכשיו') && (await txt(e, '#uVer')).includes('v1.2.12'));
await e.screenshot({ path: OUT + 'e06-update.png' });
await e.click('#uGo'); await wait(e, 700);
ok('עדכון: הורדה והתקנה הופעלו עם הקישור הנכון', E.installs[0] === E.upd.info.url, E.installs.join());
ok('עדכון: מוצגות הנחיות הרשאת התקנה', (await txt(e, '#uHelp')).includes('אפשר מהמקור הזה'));
await e.click('#uSet'); await wait(e, 300);
ok('עדכון: כפתור פתיחת הגדרות ההתקנה', E.installs.includes('settings'));
const evil = await E.bridge.handle({ id: 77, op: 'installUpdate', args: { url: 'https://evil.com/x.apk' } });
ok('עדכון: קישור זר נחסם', !evil.ok, evil.error);
await e.click('#uLater'); await wait(e, 300);
ok('עדכון: "אחר כך" סוגר', !(await isOn(e, '#upd')));
await e.evaluate(() => window.__fromNative({ event: 'resume' })); await wait(e, 500);
ok('עדכון: אחרי "אחר כך" לא קופץ שוב באותה הפעלה', !(await isOn(e, '#upd')));
E.upd.info = { available: false };

// ── היסטוריה
await e.click('#histBtn'); await wait(e, 900);
const h = await txt(e, '#hList');
await e.screenshot({ path: OUT + 'e05-history.png' });
for (const [label, re] of [['הוספת חוב', /דוד הוסיף חוב/], ['תשלום חלקי', /דוד אישר תשלום חלקי/], ['סגירה', /החוב נסגר/], ['עריכה', /ערך|הוסיף/], ['מסירת מוצר', /אלי סימן שנמסר/]]) ok('היסטוריה: ' + label, re.test(h));
await e.click('#scrim', { position: { x: 5, y: 5 } }); await wait(e, 400);

// ── שמירה בין הפעלות + Back + התנתקות
await d.reload(); await wait(d, 1500);
ok('דוד: פתיחה מחדש נכנסת ישר עם אותן דמויות', !(await isOn(d, '#gate')) && (await bg(d, '#avMe')).includes('face_a'));
await d.click('#bDebt'); await wait(d, 400); await d.evaluate(() => window.__fromNative({ event: 'back' })); await wait(d, 400);
ok('Back סוגר חלון', !(await isOn(d, '#sheet')));
await d.click('#whoBtn'); await wait(d, 400); await d.click('#aOut'); await wait(d, 700);
ok('התנתקות מחזירה למסך כניסה', await d.locator('#gEmail').count() === 1);

ok('אין שגיאות JS', D.errs.length + E.errs.length === 0, [...D.errs, ...E.errs].join(' || '));
await browser.close();
console.log(fails ? `\nFAILED: ${fails}` : '\nכל הבדיקות עברו');
process.exit(fails ? 1 : 0);
