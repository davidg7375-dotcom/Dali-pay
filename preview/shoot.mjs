// מצלם את כל מסכי האפליקציה (גרסת web עם נתוני דמה) ורושם שגיאות קונסול.
import { chromium } from 'playwright';
import fs from 'fs';
const [base, out] = [process.argv[2], process.argv[3]];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL' });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push('PAGEERROR ' + e));
p.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
p.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url().slice(0, 120)));
const shot = async (name, wait = 1100) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${out}/${name}.png` }); };
const tab = (label) => p.locator(`text="${label}"`).last().click();
const tryClick = async (sel) => { try { await p.locator(sel).first().click({ timeout: 3000 }); return true; } catch (e) { errors.push('CLICKFAIL ' + sel); return false; } };

await p.goto(base + '?s=login'); await shot('01-login');
await tryClick('text="אין לי משתמש — הרשמה"'); await shot('02-signup', 500);
await p.goto(base + '?s=nogroup'); await shot('03-group-setup');

await p.goto(base + '?s=app'); await shot('04-home');
await tab('חובות'); await shot('05-debts');
await tryClick('text="+ חוב חדש"'); await shot('06-debt-form', 700);
await tryClick('text="ביטול"');
await tryClick('text="העבר תשלום ב-Bit"'); await shot('07-bit-sheet', 700);
await tryClick('text="העתק את כל הפרטים"'); await shot('07b-bit-copied', 500);
await tryClick('text="סגור"');
await tryClick('text="סמן תשלום"'); await shot('08-pay-sheet', 700);
await tryClick('text="הכול"'); await tryClick('text="רשום תשלום"'); await shot('09-celebrate-paid', 800);
await p.waitForTimeout(2600);
await tryClick('text=/היסטוריית תשלומים/'); await shot('10-payment-history');
await tab('מוצרים'); await shot('11-products');
await tryClick('text="+ מוצר חדש"'); await shot('12-product-form', 700);
await tryClick('text="ביטול"');
await tryClick('text="נמסר"'); await shot('13-celebrate-delivered', 700);
await p.waitForTimeout(2600);
await tab('הודעות'); await shot('14-messages');
await tryClick('text="שלח הודעה"'); await shot('15-compose', 700);
await tryClick('text="תביא כסף כבר 💸"'); await shot('15b-compose-preset', 400);
await tryClick('text="שלח עכשיו"'); await shot('16-message-sent', 900);
await tryClick('text=/מאת אלי/'); await shot('17-message-view', 900);
await tryClick('text="סגור"');
await tab('הגדרות'); await shot('18-settings');
await tab('בית'); await shot('19-home-after');

await p.goto(base + '?s=app&data=empty'); await shot('14-home-empty');
await tab('חובות'); await shot('15-debts-empty');
await tab('מוצרים'); await shot('16-products-empty');
await tab('הודעות'); await shot('17-messages-empty');

fs.writeFileSync(`${out}/errors.txt`, errors.length ? errors.join('\n') : 'NO ERRORS');
console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
await browser.close();
