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

async function user(browser, label) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  const bridge = createBridge(server.clientFor(), { emit: (o) => page.evaluate((m) => window.__fromNative(m), o).catch(() => {}), share: async () => {}, exit: () => { page.__exited = true; } });
  await page.exposeFunction('__host', async (s) => { const r = await bridge.handle(JSON.parse(s)); await page.evaluate((m) => window.__fromNative(m), r).catch(() => {}); });
  await page.addInitScript(() => { window.DP_SPLASH_MS = 300; window.ReactNativeWebView = { postMessage: (s) => window.__host(s) }; });
  await page.route(BASE + '**', (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: html }));
  await page.goto(BASE);
  return { page, ctx, errs, label };
}
const txt = (p, sel) => p.inner_text ? p.inner_text(sel) : p.locator(sel).innerText();
const wait = (p, ms = 500) => p.waitForTimeout(ms);

const browser = await chromium.launch();
const D = await user(browser, 'david'), E = await user(browser, 'eli');
const [d, e] = [D.page, E.page];

// ── כניסה והקמת קבוצה
await wait(d, 900);
ok('דוד: מסך כניסה', await d.locator('#gate.on #gEmail').count() === 1);
await d.screenshot({ path: OUT + '01-auth.png' });
await d.click('#gSw'); await d.fill('#gEmail', 'david@test.com'); await d.fill('#gPass', 'secret1'); await d.click('#gGo'); await wait(d, 700);
ok('דוד: מסך הקמת קבוצה', await d.locator('#gNew').count() === 1);
await d.fill('#gName', 'דוד'); await d.click('#gNew'); await wait(d, 900);
ok('דוד: נכנס למסך הבית', !(await d.locator('#gate').evaluate((n) => n.classList.contains('on'))));
ok('דוד: מוצג שם', (await txt(d, '#whoBtn')).includes('דוד'));
ok('דוד: כרטיס הזמנה (אין עוד משתמש)', await d.locator('#inviteCard').count() === 1);
const code = await d.evaluate(() => document.querySelector('#inviteCard b').textContent);
await d.screenshot({ path: OUT + '02-david-invite.png' });
ok('דוד: חוב נחסם בלי שותף', await (async () => { await d.click('#bDebt'); await wait(d, 300); return !(await d.locator('#sheet').evaluate((n) => n.classList.contains('on'))); })());

await wait(e, 900);
await e.click('#gSw'); await e.fill('#gEmail', 'eli@test.com'); await e.fill('#gPass', 'secret2'); await e.click('#gGo'); await wait(e, 700);
await e.fill('#gName', 'אלי'); await e.fill('#gCode', code.toUpperCase()); await e.click('#gJoin'); await wait(e, 900);
ok('אלי: הצטרף ורואה שם', (await txt(e, '#whoBtn')).includes('אלי'));
await wait(d, 600);
ok('דוד: כרטיס ההזמנה נעלם אחרי שאלי הצטרף (סנכרון)', await d.locator('#inviteCard').count() === 0);

// ── חוב: דוד יוצר "אלי חייב לי 120", אלי רואה
await d.click('#bDebt'); await wait(d, 400);
await d.fill('#fAmt', '120'); await d.click('#fDir button[data-v="0"]'); await d.fill('#fWhy', 'מטען'); await d.fill('#fDate', '2026-11-10'); await d.click('#fSave'); await wait(d, 900);
ok('דוד: חייבים לי 120', (await txt(d, '#sOwed')).includes('120'));
await wait(e, 700);
ok('אלי: אני חייב 120 (אותם נתונים)', (await txt(e, '#sIowe')).includes('120'), await txt(e, '#sIowe'));
ok('אלי: כרטיס החוב בטקסט נכון', (await txt(e, '#debts')).includes('אני חייב לדוד'));
ok('אלי: תאריך החוב נשמר (10/11/26)', (await txt(e, '#debts')).includes('10/11/26'));
await e.screenshot({ path: OUT + '03-eli-debt.png' });

// ── תשלום חלקי אצל אלי, ודוד רואה את היתרה
await e.locator('[data-debt]').first().click(); await wait(e, 400);
await e.fill('#pAmt', '30'); await e.click('#pGo'); await wait(e, 900);
ok('אלי: יתרה 90 אחרי תשלום חלקי', (await txt(e, '#sIowe')).includes('90'), await txt(e, '#sIowe'));
await wait(d, 600);
ok('דוד: רואה 90 (סנכרון בזמן אמת)', (await txt(d, '#sOwed')).includes('90'), await txt(d, '#sOwed'));
ok('דוד: מוצג "שולם ₪30"', (await txt(d, '#debts')).includes('30'));

// ── חוב נגדי: אלי יוצר "אני חייב לדוד 50"; יתרה כוללת
await e.click('#bDebt'); await wait(e, 400);
await e.fill('#fAmt', '50'); await e.fill('#fWhy', 'פיצה'); await e.click('#fSave'); await wait(e, 900);
ok('אלי: אני חייב 140 (90+50)', (await txt(e, '#sIowe')).includes('140'), await txt(e, '#sIowe'));
ok('אלי: יתרה שלילית', (await txt(e, '#sBal')).includes('−'), await txt(e, '#sBal'));
await wait(d, 600);
ok('דוד: חייבים לי 140 ויתרה חיובית', (await txt(d, '#sOwed')).includes('140') && (await txt(d, '#sBal')).includes('+'));
await d.screenshot({ path: OUT + '04-david-home.png' });

// ── סגירה מלאה
await d.locator('[data-debt]').filter({ hasText: 'פיצה' }).click(); await wait(d, 400);
await d.click('#aPaid'); await wait(d, 900);
ok('דוד: חוב נסגר (נשאר אחד פתוח)', await d.locator('[data-debt]').count() === 1);
await wait(e, 600);
ok('אלי: רואה שהחוב נסגר', await e.locator('[data-debt]').count() === 1 && (await txt(e, '#sIowe')).includes('90'));

// ── מוצר
await d.click('#bProd'); await wait(d, 400);
await d.fill('#mName', 'מצלמה'); await d.fill('#mQty', '2'); await d.click('#mSave'); await wait(d, 900);
await wait(e, 600);
const pt = await txt(e, '#prods');
ok('אלי: רואה את המוצר אצל דוד ← אל אלי', pt.includes('מצלמה') && pt.includes('אצל דוד') && pt.includes('אלי'), pt.replace(/\n/g, ' | '));
await e.locator('[data-prod]').click(); await wait(e, 400); await e.click('#xDone'); await wait(e, 900);
ok('אלי: סימן נמסר', (await txt(e, '#prods')).includes('אין מוצרים בדרך'));
await wait(d, 600);
ok('דוד: רואה שנמסר', (await txt(d, '#prods')).includes('אין מוצרים בדרך'));

// ── פתק
await d.click('#bNote'); await wait(d, 400);
await d.fill('#nTxt', 'תודה על הקפה ☕'); await d.click('#nSave'); await wait(d, 900);
await wait(e, 600);
ok('אלי: הפתק מופיע במסך הבית', (await txt(e, '#notesWrap')).includes('תודה על הקפה'));
ok('דוד: הפתק מופיע גם אצלו', (await txt(d, '#notesWrap')).includes('תודה על הקפה'));
await wait(e, 2500);
await e.screenshot({ path: OUT + '05-eli-full.png', fullPage: true });

// ── עריכה ומחיקה
await d.locator('[data-debt]').first().click(); await wait(d, 400); await d.click('#aEdit'); await wait(d, 400);
await d.fill('#fAmt', '200'); await d.click('#fSave'); await wait(d, 900);
ok('דוד: עריכת סכום ל-200 (נותר 170)', (await txt(d, '#sOwed')).includes('170'), await txt(d, '#sOwed'));
await d.locator('[data-debt]').first().click(); await wait(d, 400); await d.click('#aEdit'); await wait(d, 400);
await d.fill('#fAmt', '10'); await d.click('#fSave'); await wait(d, 700);
ok('עריכה מתחת למה ששולם נדחית ומוצגת הודעה', (await txt(d, '#toast')).includes('נמוך ממה ששולם'), await txt(d, '#toast'));
await d.click('#scrim', { position: { x: 5, y: 5 } }); await wait(d, 400);
await d.locator('[data-debt]').first().click(); await wait(d, 400); await d.click('#aDel'); await d.click('#aDel'); await wait(d, 900);
ok('דוד: מחק את החוב', await d.locator('[data-debt]').count() === 0);
await wait(e, 600);
ok('אלי: החוב נעלם גם אצלו', await e.locator('[data-debt]').count() === 0);

// ── שמירה בין הפעלות: רענון = סגירה ופתיחה של האפליקציה
await e.reload(); await wait(e, 1500);
ok('אלי: אחרי פתיחה מחדש נכנס ישר (בלי מסך כניסה)', !(await e.locator('#gate').evaluate((n) => n.classList.contains('on'))) && (await txt(e, '#whoBtn')).includes('אלי'));
ok('אלי: הפתק עדיין שם אחרי פתיחה מחדש', (await txt(e, '#notesWrap')).includes('תודה על הקפה'));

// ── חזרה (כפתור Back) וסיום
await d.click('#bDebt'); await wait(d, 400);
await d.evaluate(() => window.__fromNative({ event: 'back' })); await wait(d, 400);
ok('Back סוגר חלון', !(await d.locator('#sheet').evaluate((n) => n.classList.contains('on'))) && !d.__exited);
await d.evaluate(() => window.__fromNative({ event: 'back' })); await wait(d, 400);
ok('Back במסך הבית יוצא מהאפליקציה', d.__exited === true);

// ── התנתקות
await d.click('#whoBtn'); await wait(d, 400); await d.click('#aOut'); await wait(d, 700);
ok('דוד: התנתקות מחזירה למסך כניסה', await d.locator('#gEmail').count() === 1);
await d.fill('#gEmail', 'david@test.com'); await d.fill('#gPass', 'WRONGPW'); await d.click('#gGo'); await wait(d, 700);
ok('סיסמה שגויה: הודעה ידידותית', (await txt(d, '#toast')).includes('שגויים'), await txt(d, '#toast'));

ok('אין שגיאות JS', D.errs.length + E.errs.length === 0, [...D.errs, ...E.errs].join(' || '));
await browser.close();
console.log(fails ? `\nFAILED: ${fails}` : '\nכל הבדיקות עברו');
process.exit(fails ? 1 : 0);
