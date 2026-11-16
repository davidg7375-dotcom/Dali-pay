// בדיקות הגשר (src/bridge.js) מול שרת מדומה עם שני משתמשים. מריצים: node scripts/unit-tests/bridge.mjs
import assert from 'node:assert/strict';
import { createBridge, friendly } from '../../src/bridge.js';
import { createFakeServer } from './fake-supabase.mjs';

let passed = 0, failed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('PASS ', name); } catch (e) { failed++; console.log('FAIL ', name, '\n     ', e.stack); } };

const server = createFakeServer();
const mk = () => { const events = []; const b = createBridge(server.clientFor(), { emit: (e) => events.push(e) }); const call = async (op, args) => { const r = await b.handle({ id: 1, op, args }); if (!r.ok) throw new Error(r.error); return r.result; }; return { call, events, handle: b.handle }; };
const david = mk(), eli = mk();
let gid, dUid, eUid;

await t('הרשמה וכניסה', async () => {
  const a = await david.call('signUp', { email: 'd@x.com', password: 'secret1' }); dUid = a.uid;
  const b = await eli.call('signUp', { email: 'e@x.com', password: 'secret2' }); eUid = b.uid;
  assert.notEqual(dUid, eUid);
  await assert.rejects(() => david.call('signIn', { email: 'd@x.com', password: 'bad' }), /אימייל או סיסמה שגויים/);
  assert.equal((await eli.call('session')).uid, eUid);
});
await t('אין קבוצה בהתחלה', async () => { assert.equal(await david.call('membership'), null); });
await t('דוד פותח קבוצה, אלי מצטרף עם קוד', async () => {
  const m = await david.call('createGroup', { name: 'דוד ואלי', display: 'דוד' });
  gid = m.group.id; assert.equal(m.role, 'owner'); assert.equal(m.members.length, 1);
  const j = await eli.call('joinGroup', { code: m.group.invite_code.toUpperCase(), display: 'אלי' });
  assert.equal(j.group.id, gid); assert.equal(j.members.length, 2);
  await assert.rejects(() => eli.call('joinGroup', { code: 'nope', display: 'x' }), /קוד הזמנה לא תקין/);
});
await t('חוב שדוד יוצר מופיע אצל אלי', async () => {
  await david.call('addDebt', { groupId: gid, creditor_id: dUid, debtor_id: eUid, amount: 120, description: 'מטען', created_at: '2026-11-10T12:00:00.000Z' });
  const l = await eli.call('load', { groupId: gid });
  assert.equal(l.debts.length, 1); assert.equal(l.debts[0].amount, 120); assert.equal(l.debts[0].debtor_id, eUid);
  assert.equal(l.debts[0].created_at, '2026-11-10T12:00:00.000Z');
});
await t('תשלום חלקי ואז סגירה מלאה', async () => {
  const d = (await eli.call('load', { groupId: gid })).debts[0];
  await eli.call('recordPayment', { debtId: d.id, amount: 30 });
  let l = await david.call('load', { groupId: gid });
  assert.equal(l.payments.length, 1); assert.equal(l.debts[0].status, 'open');
  await assert.rejects(() => eli.call('recordPayment', { debtId: d.id, amount: 100 }), /גבוה מיתרת החוב/);
  await eli.call('recordPayment', { debtId: d.id, amount: 90 });
  l = await david.call('load', { groupId: gid });
  assert.equal(l.debts[0].status, 'paid'); assert.equal(l.payments.length, 2);
  await assert.rejects(() => eli.call('recordPayment', { debtId: d.id, amount: 1 }), /שולם במלואו/);
});
await t('עריכת סכום מתחת למה ששולם נדחית, והשרת מחזיר הודעה בעברית', async () => {
  await david.call('addDebt', { groupId: gid, creditor_id: eUid, debtor_id: dUid, amount: 100, description: 'פיצה' });
  const d = (await david.call('load', { groupId: gid })).debts.find((x) => x.description === 'פיצה');
  await david.call('recordPayment', { debtId: d.id, amount: 60 });
  await assert.rejects(() => david.call('updateDebt', { id: d.id, patch: { amount: 50 } }), /נמוך ממה ששולם/);
  await david.call('updateDebt', { id: d.id, patch: { amount: 200, description: 'פיצה גדולה' } });
  assert.equal((await eli.call('load', { groupId: gid })).debts.find((x) => x.id === d.id).amount, 200);
});
await t('מחיקה: רק יוצר החוב או מנהל', async () => {
  await eli.call('addDebt', { groupId: gid, creditor_id: eUid, debtor_id: dUid, amount: 15, description: 'קפה' });
  const d = (await eli.call('load', { groupId: gid })).debts.find((x) => x.description === 'קפה');
  await david.call('deleteDebt', { id: d.id }); // דוד מנהל
  assert.ok(!(await eli.call('load', { groupId: gid })).debts.some((x) => x.id === d.id));
  await david.call('addDebt', { groupId: gid, creditor_id: dUid, debtor_id: eUid, amount: 5, description: 'מסטיק' });
  const m = (await eli.call('load', { groupId: gid })).debts.find((x) => x.description === 'מסטיק');
  await assert.rejects(() => eli.call('deleteDebt', { id: m.id }), /אין הרשאה למחוק/);
});
await t('מוצר: אצל מי / למי / נמסר', async () => {
  await david.call('addProduct', { groupId: gid, name: 'מצלמה', quantity: 2, holder_id: dUid, receiver_id: eUid });
  let p = (await eli.call('load', { groupId: gid })).products[0];
  assert.equal(p.holder_id, dUid); assert.equal(p.receiver_id, eUid); assert.equal(p.quantity, 2); assert.equal(p.delivered, false);
  await eli.call('updateProduct', { id: p.id, patch: { delivered: true } });
  p = (await david.call('load', { groupId: gid })).products[0]; assert.equal(p.delivered, true);
});
await t('פתק: השולח והנמען רואים אותו', async () => {
  await david.call('sendNote', { groupId: gid, recipient_id: eUid, body: 'תודה על הקפה ☕' });
  for (const u of [david, eli]) { const m = (await u.call('load', { groupId: gid })).messages; assert.equal(m.length, 1); assert.equal(m[0].body, 'תודה על הקפה ☕'); }
});
await t('זמן אמת: שינוי אצל אחד שולח אירוע לשני', async () => {
  await eli.call('subscribe', { groupId: gid });
  eli.events.length = 0;
  await david.call('addProduct', { groupId: gid, name: 'כבל', quantity: 1, holder_id: dUid, receiver_id: eUid });
  // הגשר מחכה 200ms לפני שליחת האירוע (איחוד אירועים)
  await new Promise((r) => setTimeout(r, 350));
  assert.ok(eli.events.some((e) => e.event === 'changed'), 'לא התקבל אירוע changed');
  await eli.call('unsubscribe');
});
await t('משתמש זר לא רואה כלום', async () => {
  const x = mk(); await x.call('signUp', { email: 'x@x.com', password: 'secret3' });
  const l = await x.call('load', { groupId: gid });
  assert.deepEqual([l.debts.length, l.products.length, l.messages.length, l.payments.length], [0, 0, 0, 0]);
  assert.equal(await x.call('membership'), null);
});
await t('התנתקות', async () => { await eli.call('signOut'); assert.equal(await eli.call('session'), null); });
await t('הודעות שגיאה ידידותיות', () => {
  assert.match(friendly(new Error('Could not find the table public.debt_payments in the schema cache')), /Deploy Backend/);
  assert.match(friendly(new Error('Network request failed')), /אין חיבור/);
  assert.match(friendly(new Error('User already registered')), /כבר קיים/);
});
await t('פעולה לא מוכרת נדחית', async () => { await assert.rejects(() => david.call('dropEverything', {}), /פעולה לא מוכרת/); });

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
