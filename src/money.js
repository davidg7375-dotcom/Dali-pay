// חישובי כסף ומוצרים. פונקציות טהורות בלבד (נבדקות ב-supabase/tests ו-scripts/unit-tests).

export const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const shekel = (n) => {
  const v = r2(n);
  const [i, f] = Math.abs(v).toFixed(2).split('.');
  return `${v < 0 ? '-' : ''}₪${i.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${f}`;
};

const pad = (n) => String(n).padStart(2, '0');
export const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
};
export const fmtDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// פרטי חוב אחד כולל תשלומים. חוב שסומן 'paid' (גם ע"י גרסה ישנה של האפליקציה) נחשב שולם במלואו.
export function debtView(d, payments = []) {
  const amount = r2(d.amount);
  const list = payments.filter((p) => p.debt_id === d.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const sum = r2(list.reduce((s, p) => s + Number(p.amount), 0));
  const isPaid = d.status === 'paid' || sum >= amount;
  return {
    ...d,
    amount,
    payments: list,
    isPaid,
    paid: isPaid ? amount : sum,
    remaining: isPaid ? 0 : r2(amount - sum),
    isPartial: !isPaid && sum > 0,
  };
}

export function debtViews(debts, payments) {
  return debts.map((d) => debtView(d, payments));
}

// סיכום כספי אישי: כמה אני חייב, כמה חייבים לי, והיתרה ביננו. כולל פירוט לפי אדם.
export function moneySummary(views, me) {
  let owedToMe = 0;
  let iOwe = 0;
  let openCount = 0;
  const byPerson = {};
  for (const v of views) {
    if (v.isPaid) continue;
    if (v.creditor_id === me) {
      owedToMe += v.remaining;
      byPerson[v.debtor_id] = r2((byPerson[v.debtor_id] || 0) + v.remaining);
      openCount += 1;
    } else if (v.debtor_id === me) {
      iOwe += v.remaining;
      byPerson[v.creditor_id] = r2((byPerson[v.creditor_id] || 0) - v.remaining);
      openCount += 1;
    }
  }
  owedToMe = r2(owedToMe);
  iOwe = r2(iOwe);
  return { owedToMe, iOwe, net: r2(owedToMe - iOwe), openCount, byPerson, total: views.length, closedCount: views.filter((v) => v.isPaid).length };
}

// היסטוריית תשלומים: כל התשלומים + חובות ישנים שסומנו כשולם בלי רשומת תשלום.
export function paymentHistory(views) {
  const rows = [];
  for (const v of views) {
    for (const p of v.payments) rows.push({ id: p.id, debt: v, amount: Number(p.amount), by: p.paid_by, at: p.created_at, note: p.note, legacy: false, payment: p });
    if (v.status === 'paid' && v.payments.length === 0) {
      rows.push({ id: `legacy-${v.id}`, debt: v, amount: v.amount, by: v.paid_by || null, at: v.paid_at || v.updated_at, note: '', legacy: true, payment: null });
    }
  }
  return rows.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export function productsSummary(products, me) {
  let toReceive = 0;
  let toDeliver = 0;
  let delivered = 0;
  let unassigned = 0;
  for (const p of products) {
    if (p.delivered) { delivered += 1; continue; }
    if (p.receiver_id === me) toReceive += 1;
    if (p.holder_id === me) toDeliver += 1;
    if (!p.holder_id || !p.receiver_id) unassigned += 1;
  }
  return { toReceive, toDeliver, delivered, pending: products.length - delivered, unassigned };
}

// מספר טלפון של Bit: מקבל 05X-XXXXXXX, +972…, 972… ומחזיר 05XXXXXXXX או null אם לא תקין.
export function normalizeBitPhone(input) {
  let s = String(input || '').replace(/[\s\-().]/g, '');
  if (s.startsWith('+972')) s = '0' + s.slice(4);
  else if (s.startsWith('972')) s = '0' + s.slice(3);
  return /^05\d{8}$/.test(s) ? s : null;
}

export const formatPhone = (p) => (p && p.length === 10 ? `${p.slice(0, 3)}-${p.slice(3)}` : p || '');
