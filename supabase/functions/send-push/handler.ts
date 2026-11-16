// לוגיקת השליחה, בלי תלות ב-Deno, כדי שאפשר יהיה לבדוק אותה ב-Node.
import type { FcmClient } from './fcm.ts';

export interface HandlerEnv { imageBase: string }
// ממשק מינימלי של לקוח supabase-js (service role)
// deno-lint-ignore no-explicit-any
type Admin = any;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export async function handle(req: Request, env: HandlerEnv, admin: Admin, fcm: FcmClient): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return json(401, { error: 'unauthorized' });
  const { data: u, error: ue } = await admin.auth.getUser(jwt);
  const uid = u?.user?.id;
  if (ue || !uid) return json(401, { error: 'unauthorized' });

  let body: { message_id?: string } = {};
  try { body = await req.json(); } catch { /* ריק */ }
  const mid = body?.message_id;
  if (!mid || typeof mid !== 'string') return json(400, { error: 'message_id required' });

  // רק השולח של ההודעה יכול להפעיל שליחה
  const { data: msg } = await admin.from('messages').select('*').eq('id', mid).eq('sender_id', uid).maybeSingle();
  if (!msg) return json(404, { error: 'not found' });

  // idempotent: כבר טופל
  if (msg.push_status && msg.push_status !== 'pending') return json(200, { status: msg.push_status });

  const setStatus = (s: string) => admin.from('messages').update({ push_status: s }).eq('id', mid);

  if (!fcm.configured) { await setStatus('not_configured'); return json(200, { status: 'not_configured' }); }

  const { data: tokens } = await admin.from('device_tokens').select('*').eq('user_id', msg.recipient_id);
  if (!tokens || tokens.length === 0) { await setStatus('no_device'); return json(200, { status: 'no_device' }); }

  const { data: member } = await admin.from('members').select('*').eq('group_id', msg.group_id).eq('user_id', uid).maybeSingle();
  const title = member?.display_name || 'DALI PAY';
  const text = msg.body || (msg.kind === 'payment_request' ? 'בקשת תשלום' : 'שלח/ה לך איור');
  const data: Record<string, unknown> = { type: msg.kind, message_id: mid };
  if (msg.kind === 'payment_request' && msg.debt_id) data.debt_id = msg.debt_id;
  const payload = {
    title,
    body: text,
    image: msg.sticker ? `${env.imageBase.replace(/\/$/, '')}/${msg.sticker}.jpg` : undefined,
    channelId: 'dalipay',
    data,
  };

  let delivered = 0;
  const dead: string[] = [];
  for (const t of tokens) {
    const r = await fcm.send(t.token, payload);
    if (r.ok) delivered += 1;
    else if (r.invalidToken) dead.push(t.token);
  }
  if (dead.length) await admin.from('device_tokens').delete().in('token', dead);

  const status = delivered > 0 ? 'sent' : dead.length === tokens.length ? 'no_device' : 'failed';
  await setStatus(status);
  return json(200, delivered > 0 ? { status, delivered } : { status });
}
