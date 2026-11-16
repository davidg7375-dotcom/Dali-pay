// נתוני דמה לתצוגה מקדימה בלבד (לא נכלל ב-APK). מדמה את ממשק supabase-js שהאפליקציה משתמשת בו.
const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
const scenario = params.get('s') || 'app';
const empty = params.get('data') === 'empty';

export const configured = true;

let session = scenario === 'login' ? null : { user: { id: 'u1' } };
let hasGroup = scenario !== 'nogroup';
const authListeners = [];
const changeListeners = new Set();
let n = 100;
const iso = (m) => new Date(Date.now() - m * 60000).toISOString();

const db = {
  members: [
    { group_id: 'g1', user_id: 'u1', display_name: 'דוד', role: 'owner', bit_phone: '0501234567', created_at: iso(900) },
    { group_id: 'g1', user_id: 'u2', display_name: 'אלי', role: 'member', bit_phone: '0527654321', created_at: iso(800) },
  ],
  groups: [{ id: 'g1', name: 'דוד ואלי', invite_code: 'a1b2c3d4', created_at: iso(900) }],
  projects: empty ? [] : [
    { id: 'p1', group_id: 'g1', name: 'דירה חדשה', created_by: 'u1', created_at: iso(300) },
    { id: 'p2', group_id: 'g1', name: 'חופשה בצפון', created_by: 'u2', created_at: iso(200) },
  ],
  debts: empty ? [] : [
    { id: 'd1', group_id: 'g1', project_id: 'p1', creditor_id: 'u1', debtor_id: 'u2', amount: 124, description: 'ארוחת ערב', status: 'open', created_by: 'u1', created_at: iso(10) },
    { id: 'd2', group_id: 'g1', project_id: null, creditor_id: 'u2', debtor_id: 'u1', amount: 386.5, description: 'קניות לשבת', status: 'open', created_by: 'u2', created_at: iso(20) },
    { id: 'd3', group_id: 'g1', project_id: 'p2', creditor_id: 'u1', debtor_id: 'u2', amount: 60, description: 'קפה', status: 'open', created_by: 'u1', created_at: iso(30) },
    { id: 'd4', group_id: 'g1', project_id: null, creditor_id: 'u2', debtor_id: 'u1', amount: 45, description: 'דלק', status: 'paid', paid_at: iso(35), paid_by: 'u2', created_by: 'u2', created_at: iso(400) },
  ],
  debt_payments: empty ? [] : [
    { id: 'pay1', group_id: 'g1', debt_id: 'd1', amount: 40, note: 'במזומן', paid_by: 'u2', created_at: iso(5) },
  ],
  messages: empty ? [] : [
    { id: 'm1', group_id: 'g1', sender_id: 'u2', recipient_id: 'u1', kind: 'message', body: 'נו, מה עם הכסף שלי? 😂', sticker: 'think_howmuch', debt_id: null, amount: null, push_status: 'sent', read_at: null, created_at: iso(3) },
    { id: 'm2', group_id: 'g1', sender_id: 'u1', recipient_id: 'u2', kind: 'payment_request', body: 'בקשת תשלום: ₪84.00 — ארוחת ערב', sticker: 'reminder_sent', debt_id: 'd1', amount: 84, push_status: 'sent', read_at: iso(1), created_at: iso(8) },
  ],
  products: empty ? [] : [
    { id: 'r1', group_id: 'g1', project_id: 'p1', name: 'ספה', quantity: 1, holder_id: 'u1', receiver_id: 'u2', delivered: false, created_by: 'u1', created_at: iso(15) },
    { id: 'r2', group_id: 'g1', project_id: null, name: 'כוסות יין', quantity: 6, holder_id: 'u2', receiver_id: 'u1', delivered: true, delivered_at: iso(20), delivered_by: 'u1', created_by: 'u2', created_at: iso(25) },
    { id: 'r3', group_id: 'g1', project_id: 'p2', name: 'אוהל', quantity: 2, holder_id: 'u2', receiver_id: 'u1', delivered: false, created_by: 'u1', created_at: iso(35) },
  ],
};

const notify = () => setTimeout(() => changeListeners.forEach((cb) => cb({})), 0);

class Query {
  constructor(table) { this.table = table; this.filters = []; this.op = 'select'; this.countMode = false; this.one = false; }
  select() { return this; }
  eq(k, v) { this.filters.push([k, v]); return this; }
  order() { return this; }
  limit() { return this; }
  single() { this.one = true; return this; }
  insert(row) { this.op = 'insert'; this.row = row; return this; }
  update(patch) { this.op = 'update'; this.patch = patch; return this; }
  delete(opts) { this.op = 'delete'; this.countMode = !!(opts && opts.count); return this; }
  match(r) { return this.filters.every(([k, v]) => r[k] === v); }
  run() {
    const rows = db[this.table];
    if (this.op === 'insert') {
      n += 1;
      const base = { id: `x${n}`, created_at: new Date().toISOString(), created_by: 'u1', status: 'open', delivered: false, quantity: 1, sender_id: 'u1', push_status: 'pending', read_at: null };
      const made = { ...base, ...this.row };
      rows.unshift(made);
      notify();
      return this.one ? { data: made, error: null } : { data: null, error: null };
    }
    if (this.op === 'update') {
      let c = 0;
      rows.forEach((r, i) => { if (this.match(r)) { rows[i] = { ...r, ...this.patch }; c += 1; } });
      notify();
      return { data: null, error: null, count: c };
    }
    if (this.op === 'delete') {
      const keep = rows.filter((r) => !this.match(r));
      const c = rows.length - keep.length;
      db[this.table] = keep;
      notify();
      return { data: null, error: null, count: c };
    }
    const out = rows.filter((r) => this.match(r));
    return this.one ? { data: out[0] || null, error: null } : { data: out, error: null };
  }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej); }
}

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: (cb) => { authListeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    signInWithPassword: async () => { session = { user: { id: 'u1' } }; authListeners.forEach((cb) => cb('SIGNED_IN', session)); return { data: { session }, error: null }; },
    signUp: async () => { session = { user: { id: 'u1' } }; authListeners.forEach((cb) => cb('SIGNED_IN', session)); return { data: { session }, error: null }; },
    signOut: async () => { session = null; authListeners.forEach((cb) => cb('SIGNED_OUT', null)); return { error: null }; },
  },
  from: (t) => {
    if (t === 'members' || t === 'groups') {
      const q = new Query(t);
      const run = q.run.bind(q);
      q.run = () => (hasGroup ? run() : { data: t === 'members' ? [] : null, error: null });
      return q;
    }
    return new Query(t);
  },
  rpc: async (name, args = {}) => {
    if (name === 'record_payment') {
      const d = db.debts.find((x) => x.id === args.p_debt);
      if (!d) return { data: null, error: { message: 'חוב לא נמצא' } };
      n += 1;
      db.debt_payments.unshift({ id: `x${n}`, group_id: 'g1', debt_id: d.id, amount: args.p_amount, note: args.p_note || '', paid_by: 'u1', created_at: new Date().toISOString() });
      const paid = db.debt_payments.filter((x) => x.debt_id === d.id).reduce((a, x) => a + Number(x.amount), 0);
      if (paid >= Number(d.amount)) Object.assign(d, { status: 'paid', paid_at: new Date().toISOString(), paid_by: 'u1' });
      notify(); return { data: null, error: null };
    }
    if (name === 'delete_payment') { db.debt_payments = db.debt_payments.filter((x) => x.id !== args.p_payment); notify(); return { data: null, error: null }; }
    if (name === 'register_device' || name === 'unregister_device') return { data: null, error: null };
    hasGroup = true; return { data: {}, error: null };
  },
  functions: { invoke: async () => ({ data: { status: 'sent', delivered: 1 }, error: null }) },
  channel: () => {
    const ch = { cbs: [], on(_e, _c, cb) { this.cbs.push(cb); changeListeners.add(cb); return this; }, subscribe(cb) { if (cb) cb('SUBSCRIBED'); return this; } };
    return ch;
  },
  removeChannel: (ch) => { (ch.cbs || []).forEach((cb) => changeListeners.delete(cb)); },
};
