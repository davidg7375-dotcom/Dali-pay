// גשר בין הממשק (HTML בתוך WebView) לבין Supabase.
// כל הגישה לשרת (כניסה, חובות, תשלומים, מוצרים, פתקים) עוברת כאן, בצד ה-Native,
// כך שהסשן נשמר ב-AsyncStorage והממשק עצמו לא מחזיק מפתחות.
// הקובץ טהור (מקבל לקוח supabase מבחוץ) כדי שאפשר יהיה לבדוק אותו ב-Node.

const TABLES = ['members', 'debts', 'debt_payments', 'products', 'messages', 'activity'];

export function friendly(e) {
  const m = String((e && (e.message || e.error_description)) || e || '');
  if (/activity|bit_link|avatar/i.test(m) && /Could not find|schema cache|does not exist|column/i.test(m)) {
    return 'צריך להריץ את עדכון מסד הנתונים 1.4 (קובץ SQL אחד ב-SQL Editor).';
  }
  if (/Could not find the table|schema cache|does not exist|relation .* does not exist|PGRST20[45]/i.test(m)) {
    return 'מסד הנתונים עדיין לא עודכן לגרסה 1.2 (חסרה טבלה). יש להריץ Deploy Backend.';
  }
  if (/Invalid login/i.test(m)) return 'אימייל או סיסמה שגויים';
  if (/already registered|already been registered/i.test(m)) return 'המשתמש כבר קיים. עבור להתחברות';
  if (/Email not confirmed/i.test(m)) return 'החשבון נוצר כשאימות מייל היה פעיל ולא אושר. יש להירשם עם אימייל אחר.';
  if (/Network request failed|Failed to fetch|network|timeout/i.test(m)) return 'אין חיבור לאינטרנט';
  return m || 'שגיאה לא ידועה';
}

const must = (res) => { if (res && res.error) throw res.error; return res; };

const UPDATE_PREFIX = 'https://github.com/davidg7375-dotcom/Dali-pay/releases/download/';

export function createBridge(supabase, { emit = () => {}, share = async () => {}, exit = () => {}, open = async () => {}, notify = () => {}, update = null } = {}) {
  let channels = [];
  let timer = null;

  const bump = () => { clearTimeout(timer); timer = setTimeout(() => emit({ event: 'changed' }), 200); };

  const uidOf = async () => {
    const { data } = await supabase.auth.getSession();
    const s = data && data.session;
    if (!s) throw new Error('לא מחובר');
    return s.user.id;
  };

  async function membership() {
    const uid = await uidOf();
    const mem = must(await supabase.from('members').select('group_id, role').eq('user_id', uid).limit(1)).data;
    if (!mem || !mem.length) return null;
    const gid = mem[0].group_id;
    const g = must(await supabase.from('groups').select('*').eq('id', gid).single()).data;
    const members = must(await supabase.from('members').select('*').eq('group_id', gid)).data || [];
    return { group: { id: g.id, name: g.name, invite_code: g.invite_code }, role: mem[0].role, members };
  }

  const ops = {
    async session() {
      const { data } = await supabase.auth.getSession();
      const s = data && data.session;
      return s ? { uid: s.user.id, email: s.user.email } : null;
    },
    async signIn({ email, password }) {
      must(await supabase.auth.signInWithPassword({ email: String(email).trim(), password }));
      return ops.session();
    },
    async signUp({ email, password }) {
      const { data, error } = await supabase.auth.signUp({ email: String(email).trim(), password });
      if (error) throw error;
      if (!data || !data.session) throw new Error('השרת עדיין דורש אימות מייל. יש לכבות את "Confirm email" ב-Supabase.');
      return ops.session();
    },
    async signOut() {
      await ops.unsubscribe();
      await supabase.auth.signOut();
      return true;
    },
    membership,
    async createGroup({ name, display }) {
      must(await supabase.rpc('create_group', { p_name: (name || '').trim() || 'DALI PAY', p_display: String(display).trim() }));
      return membership();
    },
    async joinGroup({ code, display }) {
      must(await supabase.rpc('join_group', { p_code: String(code), p_display: String(display).trim() }));
      return membership();
    },
    async subscribe({ groupId }) {
      await ops.unsubscribe();
      channels = TABLES.map((t) => supabase
        .channel(`rt-${t}-${groupId}-${Math.random().toString(36).slice(2, 7)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: t }, bump)
        .subscribe());
      return true;
    },
    async unsubscribe() {
      const old = channels; channels = [];
      for (const c of old) { try { await supabase.removeChannel(c); } catch (e) { /* ignore */ } }
      return true;
    },
    async load({ groupId }) {
      const [members, debts, payments, products, messages] = await Promise.all([
        supabase.from('members').select('*').eq('group_id', groupId),
        supabase.from('debts').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
        supabase.from('debt_payments').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
        supabase.from('products').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
        supabase.from('messages').select('*').eq('group_id', groupId).eq('kind', 'message').order('created_at', { ascending: false }).limit(40),
      ]);
      return {
        members: must(members).data || [],
        debts: must(debts).data || [],
        payments: must(payments).data || [],
        products: must(products).data || [],
        messages: must(messages).data || [],
      };
    },

    // ───── חובות ─────
    async addDebt({ groupId, creditor_id, debtor_id, amount, description, created_at }) {
      const row = { group_id: groupId, creditor_id, debtor_id, amount, description: description || '' };
      if (created_at) row.created_at = created_at;
      must(await supabase.from('debts').insert(row));
      return true;
    },
    async updateDebt({ id, patch }) {
      const allowed = {};
      for (const k of ['creditor_id', 'debtor_id', 'amount', 'description', 'created_at']) if (k in patch) allowed[k] = patch[k];
      must(await supabase.from('debts').update(allowed).eq('id', id));
      return true;
    },
    async deleteDebt({ id }) {
      const res = must(await supabase.from('debts').delete({ count: 'exact' }).eq('id', id));
      if (res.count === 0) throw new Error('אין הרשאה למחוק. רק מי שיצר את החוב או מנהל הקבוצה יכולים למחוק.');
      return true;
    },
    async recordPayment({ debtId, amount, note }) {
      must(await supabase.rpc('record_payment', { p_debt: debtId, p_amount: amount, p_note: note || '' }));
      return true;
    },

    // ───── מוצרים ─────
    async addProduct({ groupId, name, quantity, holder_id, receiver_id }) {
      must(await supabase.from('products').insert({ group_id: groupId, name, quantity, holder_id, receiver_id }));
      return true;
    },
    async updateProduct({ id, patch }) {
      const allowed = {};
      for (const k of ['name', 'quantity', 'holder_id', 'receiver_id', 'delivered']) if (k in patch) allowed[k] = patch[k];
      must(await supabase.from('products').update(allowed).eq('id', id));
      return true;
    },
    async deleteProduct({ id }) {
      const res = must(await supabase.from('products').delete({ count: 'exact' }).eq('id', id));
      if (res.count === 0) throw new Error('אין הרשאה למחוק. רק מי שיצר את המוצר או מנהל הקבוצה יכולים למחוק.');
      return true;
    },

    // ───── פתקים (נשמרים בטבלת messages הקיימת: השולח והנמען רואים אותם) ─────
    async sendNote({ groupId, recipient_id, body }) {
      must(await supabase.from('messages').insert({ group_id: groupId, recipient_id, kind: 'message', body }));
      return true;
    },

    // ───── פרופיל: קישור Bit ודמות (רק השורה של המשתמש עצמו) ─────
    async setProfile({ groupId, patch }) {
      const uid = await uidOf();
      const allowed = {};
      if ('bit_link' in patch) {
        const v = patch.bit_link == null ? '' : String(patch.bit_link).trim();
        if (v && !/^https:\/\/[^\s<>"']+$/.test(v)) throw new Error('הקישור צריך להתחיל ב-https://');
        allowed.bit_link = v || null;
      }
      if ('avatar' in patch) {
        if (patch.avatar !== 'a' && patch.avatar !== 'b') throw new Error('דמות לא תקינה');
        allowed.avatar = patch.avatar;
      }
      must(await supabase.from('members').update(allowed).eq('group_id', groupId).eq('user_id', uid));
      return true;
    },

    // ───── דיווח תשלום מהחייב (נשמר בטבלת messages הקיימת) ואישור/דחייה ע"י המקבל ─────
    async reportPayment({ groupId, debtId, recipient_id, amount }) {
      const a = Math.round(Number(amount) * 100) / 100;
      if (!(a > 0)) throw new Error('סכום לא תקין');
      must(await supabase.from('messages').insert({ group_id: groupId, recipient_id, kind: 'message', body: `דיווח תשלום ₪${a}`, debt_id: debtId, amount: a }));
      return true;
    },
    async resolveReport({ id }) {
      must(await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', id));
      return true;
    },

    async history({ groupId }) {
      const res = must(await supabase.from('activity').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(300));
      return res.data || [];
    },

    async openUrl({ url }) {
      const u = String(url || '');
      if (!/^https:\/\/[^\s<>"']+$/.test(u)) throw new Error('קישור לא תקין');
      await open(u);
      return true;
    },

    // ───── עדכון מתוך האפליקציה ─────
    async checkUpdate() {
      if (!update) return { available: false };
      return update.check();
    },
    async installUpdate({ url }) {
      if (!update) throw new Error('עדכון לא זמין');
      const u = String(url || '');
      if (!u.startsWith(UPDATE_PREFIX) || !/\.apk$/.test(u)) throw new Error('קישור עדכון לא מורשה');
      await update.install(u);
      return true;
    },
    async openInstallSettings() {
      if (!update) throw new Error('לא זמין');
      await update.settings();
      return true;
    },
    // הודעה קצרה של מערכת Android (במקום החלונית הלבנה שהייתה בראש המסך)
    async notify({ text }) { notify(String(text || '').slice(0, 200)); return true; },

    async share({ text }) { await share(text); return true; },
    async exit() { exit(); return true; },
  };

  async function handle(msg) {
    try {
      const fn = ops[msg.op];
      if (!fn) throw new Error('פעולה לא מוכרת: ' + msg.op);
      const result = await fn(msg.args || {});
      return { id: msg.id, ok: true, result };
    } catch (e) {
      return { id: msg.id, ok: false, error: friendly(e) };
    }
  }

  return { handle, ops };
}
