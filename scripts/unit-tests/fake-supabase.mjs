// Supabase מדומה בזיכרון, לבדיקות בלבד. משקף את הסכמה האמיתית (supabase/migrations/20261116_v1_2.sql):
// + 1.4 (20261117_v1_4.sql): רק המקבל מאשר/סוגר/מוחק חוב, פרופיל (bit_link/avatar), יומן activity.
// create_group/join_group/record_payment, RLS בסיסי (חברי קבוצה בלבד), וזמן אמת.
// מדמה את ההתנהגות כפי שהיא מתועדת; אינו תחליף לבדיקה מול שרת אמיתי.
let n = 0;
const id = () => `id-${++n}-${Math.random().toString(36).slice(2, 8)}`;

export function createFakeServer() {
  const db = { users: [], groups: [], members: [], debts: [], debt_payments: [], products: [], messages: [], activity: [] };
  const listeners = new Set();
  const notify = (table) => listeners.forEach((l) => l.table === table && l.cb({ table }));

  const clientFor = () => {
    let session = null;
    const uid = () => session && session.user.id;
    const memberOf = (g) => db.members.some((m) => m.group_id === g && m.user_id === uid());
    const isOwner = (g) => db.members.some((m) => m.group_id === g && m.user_id === uid() && m.role === 'owner');
    const err = (message) => ({ message });
    const log = (group_id, kind, entity_id, data) => { db.activity.push({ id: id(), group_id, actor_id: uid(), kind, entity_id, data, created_at: new Date(Date.now() + db.activity.length).toISOString() }); notify('activity'); };
    const dData = (r) => ({ amount: r.amount, description: r.description, creditor_id: r.creditor_id, debtor_id: r.debtor_id });

    const visible = (table, r) => {
      if (!uid()) return false;
      if (table === 'groups') return memberOf(r.id);
      if (table === 'messages') return memberOf(r.group_id) && (r.sender_id === uid() || r.recipient_id === uid());
      return memberOf(r.group_id);
    };

    function builder(table) {
      const q = { op: 'select', filters: [], order: null, limit: null, single: false, count: null, row: null, patch: null };
      const run = () => {
        if (!uid()) return { data: null, error: err('JWT expired') };
        const rows = db[table];
        let hit = rows.filter((r) => visible(table, r) && q.filters.every(([c, v]) => r[c] === v));
        if (q.op === 'insert') {
          const r = { id: id(), created_at: new Date().toISOString(), ...q.row };
          if (table === 'debts') Object.assign(r, { status: 'open', created_by: uid(), updated_at: r.created_at, description: q.row.description || '' });
          if (table === 'products') Object.assign(r, { delivered: false, created_by: uid() });
          if (table === 'messages') Object.assign(r, { sender_id: uid(), push_status: 'pending', read_at: null });
          if (table === 'debts') {
            if (!(r.amount > 0) || r.creditor_id === r.debtor_id) return { data: null, error: err('check constraint') };
            if (!memberOf(r.group_id)) return { data: null, error: err('new row violates row-level security policy') };
          }
          if (table === 'messages' && !memberOf(r.group_id)) return { data: null, error: err('new row violates row-level security policy') };
          if (table === 'debts' && q.row.status === 'paid' && r.creditor_id !== uid()) return { data: null, error: err('רק מי שמקבל את הכסף יכול לסמן חוב כשולם') };
          if (table === 'debts' && q.row.status) r.status = q.row.status;
          if (table === 'activity') return { data: null, error: err('permission denied for table activity') };
          rows.push(r); notify(table);
          if (table === 'debts') log(r.group_id, 'debt_add', r.id, dData(r));
          if (table === 'products') log(r.group_id, 'product_add', r.id, { name: r.name, quantity: r.quantity, holder_id: r.holder_id, receiver_id: r.receiver_id });
          return { data: r, error: null };
        }
        if (q.op === 'update') {
          if (table === 'activity') return { data: null, error: err('permission denied for table activity') };
          if (table === 'members') {
            hit = hit.filter((r) => r.user_id === uid());
            if ('role' in q.patch || 'group_id' in q.patch || 'user_id' in q.patch) return { data: null, error: err('permission denied for table members') };
            if ('bit_link' in q.patch && q.patch.bit_link != null && !/^https:\/\/[^\s<>"']+$/.test(q.patch.bit_link)) return { data: null, error: err('violates check constraint "members_bit_link_chk"') };
            if ('avatar' in q.patch && q.patch.avatar != null && !['a', 'b'].includes(q.patch.avatar)) return { data: null, error: err('violates check constraint "members_avatar_chk"') };
          }
          if (table === 'messages') hit = hit.filter((r) => r.recipient_id === uid());
          if (table === 'debts') {
            for (const r of hit) {
              if (r.creditor_id !== uid()) {
                if (q.patch.status === 'paid' && r.status !== 'paid') return { data: null, error: err('רק מי שמקבל את הכסף יכול לסמן חוב כשולם') };
                if ('amount' in q.patch && q.patch.amount < r.amount) return { data: null, error: err('רק מי שמקבל את הכסף יכול להקטין את סכום החוב') };
                if (('creditor_id' in q.patch && q.patch.creditor_id !== r.creditor_id) || ('debtor_id' in q.patch && q.patch.debtor_id !== r.debtor_id)) return { data: null, error: err('רק מי שמקבל את הכסף יכול לשנות את כיוון החוב') };
              }
            }
            for (const r of hit) {
              const paid = db.debt_payments.filter((p) => p.debt_id === r.id).reduce((s, p) => s + p.amount, 0);
              const amt = q.patch.amount ?? r.amount;
              if (paid > 0 && (('creditor_id' in q.patch && q.patch.creditor_id !== r.creditor_id) || ('debtor_id' in q.patch && q.patch.debtor_id !== r.debtor_id))) return { data: null, error: err('אי אפשר להחליף את הצדדים בחוב שכבר שולם בו חלק') };
              if (amt < paid) return { data: null, error: err(`סכום החוב לא יכול להיות נמוך ממה ששולם כבר (${paid})`) };
            }
          }
          hit.forEach((r) => {
            const before = { ...r }; Object.assign(r, q.patch);
            if (table === 'debts') {
              const changed = ['amount', 'description', 'creditor_id', 'debtor_id', 'created_at'].some((k) => before[k] !== r[k]);
              if (changed) log(r.group_id, 'debt_edit', r.id, { ...dData(r), ...(before.amount !== r.amount ? { old_amount: before.amount } : {}) });
            }
            if (table === 'products') {
              if (r.delivered && !before.delivered) { r.delivered_by = uid(); r.delivered_at = new Date().toISOString(); log(r.group_id, 'product_delivered', r.id, { name: r.name, quantity: r.quantity, holder_id: r.holder_id, receiver_id: r.receiver_id }); }
              else if (['name', 'quantity', 'holder_id', 'receiver_id'].some((k) => before[k] !== r[k])) log(r.group_id, 'product_edit', r.id, { name: r.name, quantity: r.quantity });
            }
          });
          if (hit.length) notify(table);
          return { data: hit, error: null };
        }
        if (q.op === 'delete') {
          if (table === 'activity') return { data: null, error: err('permission denied for table activity') };
          const allowed = hit.filter((r) => (table === 'debts' ? r.creditor_id === uid() : (r.created_by === uid() || isOwner(r.group_id))));
          allowed.forEach((r) => {
            rows.splice(rows.indexOf(r), 1);
            if (table === 'debts') log(r.group_id, 'debt_delete', r.id, dData(r));
            if (table === 'products') log(r.group_id, 'product_delete', r.id, { name: r.name, quantity: r.quantity });
          });
          if (allowed.length) notify(table);
          return { data: null, error: null, count: allowed.length };
        }
        if (q.order) hit = [...hit].sort((a, b) => (a[q.order.c] < b[q.order.c] ? 1 : -1) * (q.order.asc ? -1 : 1));
        if (q.limit != null) hit = hit.slice(0, q.limit);
        if (q.single) return hit.length === 1 ? { data: hit[0], error: null } : { data: null, error: err('Row not found') };
        return { data: hit, error: null };
      };
      const api = {
        select() { return api; },
        insert(row) { q.op = 'insert'; q.row = row; return api; },
        update(patch) { q.op = 'update'; q.patch = patch; return api; },
        delete() { q.op = 'delete'; return api; },
        eq(c, v) { q.filters.push([c, v]); return api; },
        order(c, o = {}) { q.order = { c, asc: o.ascending !== false }; return api; },
        limit(k) { q.limit = k; return api; },
        single() { q.single = true; return api; },
        then(res, rej) { return Promise.resolve(run()).then(res, rej); },
      };
      return api;
    }

    const rpc = async (fn, a) => {
      if (!uid()) return { data: null, error: err('לא מחובר') };
      if (fn === 'create_group') {
        const g = { id: id(), name: a.p_name, invite_code: Math.random().toString(16).slice(2, 10), created_at: new Date().toISOString() };
        db.groups.push(g); db.members.push({ group_id: g.id, user_id: uid(), display_name: a.p_display, role: 'owner', bit_phone: null, bit_link: null, avatar: null });
        notify('members'); return { data: g, error: null };
      }
      if (fn === 'join_group') {
        const g = db.groups.find((x) => x.invite_code === String(a.p_code).trim().toLowerCase());
        if (!g) return { data: null, error: err('קוד הזמנה לא תקין') };
        if (!memberOf(g.id)) db.members.push({ group_id: g.id, user_id: uid(), display_name: a.p_display, role: 'member', bit_phone: null, bit_link: null, avatar: null });
        notify('members'); return { data: g, error: null };
      }
      if (fn === 'record_payment') {
        const d = db.debts.find((x) => x.id === a.p_debt);
        if (!d || !memberOf(d.group_id)) return { data: null, error: err('החוב לא נמצא') };
        if (d.creditor_id !== uid()) return { data: null, error: err('רק מי שמקבל את הכסף יכול לאשר תשלום ולסגור את החוב') };
        const amt = Math.round(a.p_amount * 100) / 100;
        if (!(amt > 0)) return { data: null, error: err('סכום התשלום חייב להיות חיובי') };
        const paid = db.debt_payments.filter((p) => p.debt_id === d.id).reduce((s, p) => s + p.amount, 0);
        const remaining = Math.round((d.amount - paid) * 100) / 100;
        if (d.status === 'paid' || remaining <= 0) return { data: null, error: err('החוב כבר שולם במלואו') };
        if (amt > remaining) return { data: null, error: err(`הסכום גבוה מיתרת החוב (${remaining})`) };
        const p = { id: id(), group_id: d.group_id, debt_id: d.id, amount: amt, note: a.p_note || '', paid_by: uid(), created_at: new Date().toISOString() };
        db.debt_payments.push(p);
        log(d.group_id, 'payment', d.id, { ...dData(d), amount: amt, debt_amount: d.amount });
        if (amt === remaining) { Object.assign(d, { status: 'paid', paid_at: p.created_at, paid_by: uid() }); log(d.group_id, 'debt_closed', d.id, dData(d)); }
        notify('debt_payments'); notify('debts'); return { data: p, error: null };
      }
      return { data: null, error: err('Could not find the function ' + fn) };
    };

    const authUser = (email) => db.users.find((u) => u.email === email);
    return {
      auth: {
        async getSession() { return { data: { session }, error: null }; },
        async signUp({ email, password }) {
          if (authUser(email)) return { data: {}, error: err('User already registered') };
          const u = { id: id(), email, password }; db.users.push(u);
          session = { user: { id: u.id, email } }; return { data: { session, user: session.user }, error: null };
        },
        async signInWithPassword({ email, password }) {
          const u = authUser(email);
          if (!u || u.password !== password) return { data: {}, error: err('Invalid login credentials') };
          session = { user: { id: u.id, email } }; return { data: { session }, error: null };
        },
        async signOut() { session = null; return { error: null }; },
      },
      from: builder,
      rpc,
      channel() {
        const ch = { subs: [], on(_t, f, cb) { ch.subs.push({ table: f.table, cb }); return ch; }, subscribe() { ch.subs.forEach((s) => listeners.add(s)); return ch; } };
        return ch;
      },
      async removeChannel(ch) { (ch.subs || []).forEach((s) => listeners.delete(s)); },
    };
  };
  return { db, clientFor };
}
