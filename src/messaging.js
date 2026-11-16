import { supabase } from './supabase';
import { shekel } from './money';

export const PRESETS = [
  'נו, מה עם הכסף שלי? 😂',
  'תביא כסף כבר 💸',
  'הגיע הזמן להתאזן!',
  'תודה על התשלום ❤️',
  'אל תשכח אותי!',
];

export const CAT_LABELS = { debt: 'חובות', money: 'כסף', mood: 'מצב רוח', product: 'מוצרים' };

export function paymentRequestText(amount, reason) {
  return `בקשת תשלום: ${shekel(amount)}${reason ? ` — ${reason}` : ''}`;
}

// שומר הודעה ואז מפעיל את פונקציית ה-Push. ההודעה נשמרת גם אם ה-Push נכשל.
export async function sendMessage({ group, to, kind = 'message', body = '', sticker = null, debt = null, amount = null }) {
  const text = String(body || '').trim();
  if (!text && !sticker) return { ok: false, error: 'צריך טקסט או איור' };
  const row = { group_id: group.id, recipient_id: to, kind, body: text || null, sticker, debt_id: debt, amount };
  const { data, error } = await supabase.from('messages').insert(row).select().single();
  if (error) return { ok: false, error: error.message };
  let push = 'failed';
  try {
    const r = await supabase.functions.invoke('send-push', { body: { message_id: data.id } });
    push = r?.data?.status || 'failed';
  } catch { push = 'failed'; }
  return { ok: true, message: data, push };
}

export function pushNote(push) {
  switch (push) {
    case 'sent': return null;
    case 'no_device': return 'ההודעה נשמרה, אבל לצד השני אין מכשיר רשום להתראות. היא תופיע אצלו באפליקציה.';
    case 'not_configured': return 'ההודעה נשמרה ותופיע באפליקציה. התראות Push עדיין לא הוגדרו בשרת.';
    default: return 'ההודעה נשמרה ותופיע באפליקציה, אבל שליחת ההתראה נכשלה.';
  }
}
