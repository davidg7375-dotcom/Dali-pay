// בדיקות יחידה לחישובי הכסף. הרצה: node scripts/unit-tests/run.mjs
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dali-'));
let passed = 0;
const t = (name, fn) => { try { fn(); passed += 1; console.log('PASS ', name); } catch (e) { console.log('FAIL ', name, '\n     ', e.message); process.exitCode = 1; } };
const ta = async (name, fn) => { try { await fn(); passed += 1; console.log('PASS ', name); } catch (e) { console.log('FAIL ', name, '\n     ', e.stack); process.exitCode = 1; } };

// Node 22 מריץ TypeScript (הסרת טיפוסים) ו-ESM ישירות, בלי כלי בנייה.
const load = (entry) => import(pathToFileURL(path.join(root, entry)).href);

const M = await load('src/money.js');
const me = 'u1'; const eli = 'u2';
const D = (id, creditor, debtor, amount, status = 'open', extra = {}) => ({ id, creditor_id: creditor, debtor_id: debtor, amount, status, created_at: '2026-11-01T10:00:00Z', ...extra });
const P = (id, debt, amount, by, at) => ({ id, debt_id: debt, amount, paid_by: by, created_at: at, note: '' });

t('shekel מעצב סכומים', () => {
  assert.equal(M.shekel(1234.5), '₪1,234.50');
  assert.equal(M.shekel(0), '₪0.00');
  assert.equal(M.shekel('386.5'), '₪386.50');
});
t('r2 בלי שגיאות נקודה צפה', () => { assert.equal(M.r2(0.1 + 0.2), 0.3); assert.equal(M.r2(1.005), 1.01); });
t('פורמט תאריך ושעה', () => {
  assert.equal(M.fmtDate('2026-11-05T10:00:00'), '05.11.2026');
  assert.equal(M.fmtDateTime('2026-11-05T09:07:00'), '05.11.2026 09:07');
  assert.equal(M.fmtDate(null), '');
});
t('חוב פתוח בלי תשלומים', () => {
  const v = M.debtView(D('a', me, eli, 100), []);
  assert.deepEqual([v.isPaid, v.paid, v.remaining, v.isPartial], [false, 0, 100, false]);
});
t('תשלום חלקי מעדכן יתרה', () => {
  const v = M.debtView(D('a', me, eli, 100), [P('p1', 'a', 40, eli, '2026-11-02')]);
  assert.deepEqual([v.isPaid, v.paid, v.remaining, v.isPartial], [false, 40, 60, true]);
});
t('כמה תשלומים מצטברים לסגירה', () => {
  const v = M.debtView(D('a', me, eli, 100), [P('p1', 'a', 40, eli, '2026-11-02'), P('p2', 'a', 60, me, '2026-11-03')]);
  assert.deepEqual([v.isPaid, v.remaining], [true, 0]);
  assert.equal(v.payments[0].id, 'p2'); // החדש ראשון
});
t('חוב שסומן שולם בלי תשלומים (גרסה ישנה) נחשב סגור', () => {
  const v = M.debtView(D('a', me, eli, 100, 'paid'), []);
  assert.deepEqual([v.isPaid, v.paid, v.remaining], [true, 100, 0]);
});
t('תשלומים של חוב אחר לא נספרים', () => {
  const v = M.debtView(D('a', me, eli, 100), [P('p1', 'zzz', 50, me, '2026-11-02')]);
  assert.equal(v.remaining, 100);
});
t('סיכום: כמה אני חייב / חייבים לי / יתרה — כמה חובות במקביל', () => {
  const debts = [D('1', me, eli, 100), D('2', eli, me, 386.5), D('3', me, eli, 60), D('4', eli, me, 45, 'paid')];
  const pays = [P('p', '1', 40, eli, '2026-11-02')];
  const s = M.moneySummary(M.debtViews(debts, pays), me);
  assert.equal(s.owedToMe, 120);     // 60 שנותרו מ-100 + 60
  assert.equal(s.iOwe, 386.5);
  assert.equal(s.net, -266.5);
  assert.equal(s.openCount, 3);
  assert.equal(s.closedCount, 1);
  assert.equal(s.byPerson[eli], -266.5);
});
t('סיכום מצד אלי הפוך', () => {
  const debts = [D('1', me, eli, 100), D('2', eli, me, 30)];
  const s = M.moneySummary(M.debtViews(debts, []), eli);
  assert.equal(s.owedToMe, 30); assert.equal(s.iOwe, 100); assert.equal(s.net, -70);
});
t('חוב סגור לא נכנס ליתרה', () => {
  const s = M.moneySummary(M.debtViews([D('1', me, eli, 100, 'paid')], []), me);
  assert.deepEqual([s.owedToMe, s.iOwe, s.net, s.openCount], [0, 0, 0, 0]);
});
t('היסטוריית תשלומים כוללת חובות ישנים שסומנו שולם', () => {
  const debts = [D('1', me, eli, 100), D('2', eli, me, 50, 'paid', { paid_at: '2026-11-01T12:00:00Z', paid_by: me })];
  const pays = [P('p1', '1', 40, eli, '2026-11-05T09:00:00Z')];
  const h = M.paymentHistory(M.debtViews(debts, pays));
  assert.equal(h.length, 2);
  assert.equal(h[0].id, 'p1'); assert.equal(h[0].legacy, false);
  assert.equal(h[1].legacy, true); assert.equal(h[1].amount, 50); assert.equal(h[1].by, me);
});
t('סיכום מוצרים', () => {
  const ps = [
    { id: 1, delivered: false, holder_id: me, receiver_id: eli },
    { id: 2, delivered: false, holder_id: eli, receiver_id: me },
    { id: 3, delivered: true, holder_id: eli, receiver_id: me },
    { id: 4, delivered: false, holder_id: null, receiver_id: null },
  ];
  assert.deepEqual(M.productsSummary(ps, me), { toReceive: 1, toDeliver: 1, delivered: 1, unassigned: 1, pending: 3 });
});
t('מספר Bit: נירמול ובדיקה', () => {
  assert.equal(M.normalizeBitPhone('050-123 4567'), '0501234567');
  assert.equal(M.normalizeBitPhone('+972 50-123-4567'), '0501234567');
  assert.equal(M.normalizeBitPhone('972501234567'), '0501234567');
  assert.equal(M.normalizeBitPhone('0361234567'), null);
  assert.equal(M.normalizeBitPhone('123'), null);
  assert.equal(M.normalizeBitPhone(''), null);
  assert.equal(M.formatPhone('0501234567'), '050-1234567');
});

// ───── פונקציית השרת (Edge Function): FCM + לוגיקת השליחה ─────
const F = await load('supabase/functions/send-push/fcm.ts');
const H = await load('supabase/functions/send-push/handler.ts');
const { generateKeyPairSync, createVerify } = await import('node:crypto');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const SA = { client_email: 'svc@proj.iam.gserviceaccount.com', private_key: pem, project_id: 'dali-proj', token_uri: 'https://oauth2.googleapis.com/token' };

await ta('חתימת JWT ל-Google: מבנה וחתימה תקינים', async () => {
  const jwt = await F.signServiceAccountJwt(SA, 1_800_000_000);
  const [h, c, s] = jwt.split('.');
  const dec = (x) => JSON.parse(Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  assert.deepEqual(dec(h), { alg: 'RS256', typ: 'JWT' });
  const claims = dec(c);
  assert.equal(claims.iss, SA.client_email);
  assert.equal(claims.scope, 'https://www.googleapis.com/auth/firebase.messaging');
  assert.equal(claims.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(claims.exp - claims.iat, 3600);
  const v = createVerify('RSA-SHA256'); v.update(`${h}.${c}`);
  assert.equal(v.verify(publicKey, Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')), true);
});

t('בניית הודעת FCM: תמונה, ערוץ, נתונים כמחרוזות', () => {
  const b = F.buildFcmBody('tok123', { title: 'דוד', body: 'שלום', image: 'https://x/y.jpg', channelId: 'dalipay', data: { type: 'message', message_id: 'm1', n: 5 } });
  assert.equal(b.message.token, 'tok123');
  assert.deepEqual(b.message.notification, { title: 'דוד', body: 'שלום' });
  assert.equal(b.message.android.priority, 'HIGH');
  assert.equal(b.message.android.notification.image, 'https://x/y.jpg');
  assert.equal(b.message.android.notification.channel_id, 'dalipay');
  assert.deepEqual(b.message.data, { type: 'message', message_id: 'm1', n: '5' });
  const noImg = F.buildFcmBody('t', { title: 'a', body: 'b', channelId: 'c', data: {} });
  assert.equal('image' in noImg.message.android.notification, false);
});

// מסד נתונים מדומה קטן עם ממשק השרשור של supabase-js
function fakeAdmin(state) {
  const q = (table) => {
    const f = { table, filters: [], op: 'select', patch: null };
    const api = {
      select() { return api; },
      eq(k, v) { f.filters.push([k, v]); return api; },
      in(k, vs) { f.filters.push([k, vs, 'in']); return api; },
      update(p) { f.op = 'update'; f.patch = p; return api; },
      delete() { f.op = 'delete'; return api; },
      match(r) { return f.filters.every(([k, v, m]) => (m === 'in' ? v.includes(r[k]) : r[k] === v)); },
      run() {
        const rows = state[table] || [];
        if (f.op === 'update') { rows.filter(api.match).forEach((r) => Object.assign(r, f.patch)); state.log.push(['update', table, f.patch]); return { data: null, error: null }; }
        if (f.op === 'delete') { state[table] = rows.filter((r) => !api.match(r)); state.log.push(['delete', table, f.filters]); return { data: null, error: null }; }
        return { data: rows.filter(api.match), error: null };
      },
      maybeSingle() { const r = api.run(); return Promise.resolve({ data: r.data[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve(api.run()).then(res, rej); },
    };
    return api;
  };
  return {
    from: q,
    auth: { getUser: async (jwt) => (state.jwts[jwt] ? { data: { user: { id: state.jwts[jwt] } }, error: null } : { data: { user: null }, error: { message: 'bad' } }) },
  };
}
const baseState = () => ({
  jwts: { goodJWT: 'u1', otherJWT: 'u3' },
  log: [],
  messages: [{ id: 'm1', group_id: 'g', sender_id: 'u1', recipient_id: 'u2', kind: 'message', body: 'נו, מה עם הכסף שלי?', sticker: 'paid_cash', debt_id: null, amount: null, push_status: 'pending' }],
  members: [{ group_id: 'g', user_id: 'u1', display_name: 'דוד' }],
  device_tokens: [{ token: 'tokA', user_id: 'u2' }, { token: 'tokB', user_id: 'u2' }],
});
const req = (body, jwt = 'goodJWT', method = 'POST') => new Request('https://f/send-push', { method, headers: { Authorization: jwt ? `Bearer ${jwt}` : '', 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined });
const env = (extra = {}) => ({ imageBase: 'https://raw.example/push', ...extra });
const okFcm = (sent = []) => ({ configured: true, send: async (token, payload) => { sent.push({ token, payload }); return { ok: true }; } });

await ta('שרת: שליחה מוצלחת לשני מכשירים + תמונה + סטטוס sent', async () => {
  const st = baseState(); const sent = [];
  const r = await H.handle(req({ message_id: 'm1' }), env(), fakeAdmin(st), okFcm(sent));
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { status: 'sent', delivered: 2 });
  assert.equal(sent.length, 2);
  const p = sent[0].payload;
  assert.equal(p.title, 'דוד'); assert.equal(p.body, 'נו, מה עם הכסף שלי?');
  assert.equal(p.image, 'https://raw.example/push/paid_cash.jpg');
  assert.deepEqual(p.data, { type: 'message', message_id: 'm1' });
  assert.equal(st.messages[0].push_status, 'sent');
});
await ta('שרת: בקשת תשלום נושאת debt_id וסכום בגוף ההתראה', async () => {
  const st = baseState();
  Object.assign(st.messages[0], { kind: 'payment_request', body: 'בקשת תשלום: ₪110.00 — ארוחה', debt_id: 'd1', amount: 110, sticker: 'reminder_sent' });
  const sent = [];
  await H.handle(req({ message_id: 'm1' }), env(), fakeAdmin(st), okFcm(sent));
  assert.deepEqual(sent[0].payload.data, { type: 'payment_request', message_id: 'm1', debt_id: 'd1' });
});
await ta('שרת: בלי Authorization → 401', async () => {
  const r = await H.handle(req({ message_id: 'm1' }, ''), env(), fakeAdmin(baseState()), okFcm());
  assert.equal(r.status, 401);
});
await ta('שרת: JWT לא תקין → 401', async () => {
  const r = await H.handle(req({ message_id: 'm1' }, 'nope'), env(), fakeAdmin(baseState()), okFcm());
  assert.equal(r.status, 401);
});
await ta('שרת: משתמש אחר לא יכול לשלוח הודעה של דוד → 404 ושום דבר לא נשלח', async () => {
  const st = baseState(); const sent = [];
  const r = await H.handle(req({ message_id: 'm1' }, 'otherJWT'), env(), fakeAdmin(st), okFcm(sent));
  assert.equal(r.status, 404); assert.equal(sent.length, 0); assert.equal(st.messages[0].push_status, 'pending');
});
await ta('שרת: message_id חסר → 400', async () => {
  const r = await H.handle(req({}), env(), fakeAdmin(baseState()), okFcm());
  assert.equal(r.status, 400);
});
await ta('שרת: FCM לא מוגדר → not_configured', async () => {
  const st = baseState();
  const r = await H.handle(req({ message_id: 'm1' }), env(), fakeAdmin(st), { configured: false, send: async () => { throw new Error('no'); } });
  assert.equal((await r.json()).status, 'not_configured'); assert.equal(st.messages[0].push_status, 'not_configured');
});
await ta('שרת: לנמען אין מכשיר → no_device', async () => {
  const st = baseState(); st.device_tokens = [];
  const r = await H.handle(req({ message_id: 'm1' }), env(), fakeAdmin(st), okFcm());
  assert.equal((await r.json()).status, 'no_device'); assert.equal(st.messages[0].push_status, 'no_device');
});
await ta('שרת: טוקן לא תקף נמחק והשני מקבל → sent', async () => {
  const st = baseState();
  const fcm = { configured: true, send: async (token) => (token === 'tokA' ? { ok: false, invalidToken: true } : { ok: true }) };
  const r = await H.handle(req({ message_id: 'm1' }), env(), fakeAdmin(st), fcm);
  assert.deepEqual(await r.json(), { status: 'sent', delivered: 1 });
  assert.deepEqual(st.device_tokens.map((x) => x.token), ['tokB']);
});
await ta('שרת: כל השליחות נכשלו → failed', async () => {
  const st = baseState();
  const r = await H.handle(req({ message_id: 'm1' }), env(), fakeAdmin(st), { configured: true, send: async () => ({ ok: false, error: '500' }) });
  assert.equal((await r.json()).status, 'failed'); assert.equal(st.messages[0].push_status, 'failed');
});
await ta('שרת: קריאה חוזרת לא שולחת פעמיים (idempotent)', async () => {
  const st = baseState(); const sent = [];
  await H.handle(req({ message_id: 'm1' }), env(), fakeAdmin(st), okFcm(sent));
  const r2 = await H.handle(req({ message_id: 'm1' }), env(), fakeAdmin(st), okFcm(sent));
  assert.equal(sent.length, 2); assert.equal((await r2.json()).status, 'sent');
});
await ta('שרת: הודעה ללא איור — בלי תמונה', async () => {
  const st = baseState(); st.messages[0].sticker = null; const sent = [];
  await H.handle(req({ message_id: 'm1' }), env(), fakeAdmin(st), okFcm(sent));
  assert.equal(sent[0].payload.image, undefined);
});
await ta('שרת: OPTIONS (CORS) מחזיר 200', async () => {
  const r = await H.handle(req(null, '', 'OPTIONS'), env(), fakeAdmin(baseState()), okFcm());
  assert.equal(r.status, 200);
});

await ta('FCM: שליחה אמיתית של הלקוח מול שרת מדומה (טוקן OAuth + v1 send + זיהוי טוקן לא תקף)', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token: 'ya29.test', expires_in: 3600 }), { status: 200 });
    const body = JSON.parse(init.body);
    if (body.message.token === 'dead') return new Response(JSON.stringify({ error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }), { status: 404 });
    return new Response(JSON.stringify({ name: 'projects/dali-proj/messages/1' }), { status: 200 });
  };
  try {
    const client = F.createFcmClient(JSON.stringify(SA));
    assert.equal(client.configured, true);
    const ok = await client.send('good', { title: 't', body: 'b', channelId: 'c', data: {} });
    assert.equal(ok.ok, true);
    const dead = await client.send('dead', { title: 't', body: 'b', channelId: 'c', data: {} });
    assert.deepEqual([dead.ok, dead.invalidToken], [false, true]);
    const send = calls.filter((c) => c.url.includes('fcm.googleapis.com'))[0];
    assert.equal(send.url, 'https://fcm.googleapis.com/v1/projects/dali-proj/messages:send');
    assert.equal(send.init.headers.Authorization, 'Bearer ya29.test');
    assert.equal(calls.filter((c) => c.url.includes('oauth2')).length, 1); // הטוקן נשמר בזיכרון
    assert.equal(F.createFcmClient('').configured, false);
    assert.equal(F.createFcmClient('{bad json').configured, false);
  } finally { globalThis.fetch = realFetch; }
});

console.log(`\n${passed} בדיקות עברו`);
fs.rmSync(tmp, { recursive: true, force: true });
