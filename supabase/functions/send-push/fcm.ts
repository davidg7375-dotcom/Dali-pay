// לקוח FCM v1: חתימת JWT של חשבון שירות, החלפה לטוקן OAuth ושליחה. אין תלות חיצונית (WebCrypto + fetch).

export interface ServiceAccount { client_email: string; private_key: string; project_id: string; token_uri?: string }
export interface PushPayload { title: string; body: string; image?: string; channelId: string; data: Record<string, unknown> }
export interface SendResult { ok: boolean; invalidToken?: boolean; error?: string }
export interface FcmClient { configured: boolean; send: (token: string, payload: PushPayload) => Promise<SendResult> }

const b64url = (buf: ArrayBuffer | Uint8Array): string => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlStr = (s: string): string => b64url(new TextEncoder().encode(s));

function pemToDer(pem: string): Uint8Array {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function signServiceAccountJwt(sa: ServiceAccount, nowSec = Math.floor(Date.now() / 1000)): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: sa.token_uri || 'https://oauth2.googleapis.com/token',
    iat: nowSec,
    exp: nowSec + 3600,
  };
  const input = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  return `${input}.${b64url(sig)}`;
}

export function buildFcmBody(token: string, p: PushPayload) {
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(p.data)) data[k] = String(v);
  const notification: Record<string, string> = { channel_id: p.channelId };
  if (p.image) notification.image = p.image;
  return {
    message: {
      token,
      notification: { title: p.title, body: p.body },
      android: { priority: 'HIGH', notification },
      data,
    },
  };
}

export function createFcmClient(serviceAccountJson: string | undefined | null): FcmClient {
  let sa: ServiceAccount | null = null;
  try {
    const parsed = JSON.parse(serviceAccountJson || '');
    if (parsed && parsed.client_email && parsed.private_key && parsed.project_id) sa = parsed;
  } catch { /* לא מוגדר */ }
  if (!sa) return { configured: false, send: async () => ({ ok: false, error: 'not configured' }) };
  const account = sa;
  let cached: { token: string; exp: number } | null = null;

  async function accessToken(): Promise<string> {
    const now = Date.now();
    if (cached && cached.exp - 60_000 > now) return cached.token;
    const jwt = await signServiceAccountJwt(account);
    const res = await fetch(account.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
    });
    if (!res.ok) throw new Error(`oauth ${res.status}`);
    const j = await res.json();
    cached = { token: j.access_token, exp: now + (Number(j.expires_in) || 3600) * 1000 };
    return cached.token;
  }

  return {
    configured: true,
    async send(token, payload) {
      try {
        const at = await accessToken();
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(buildFcmBody(token, payload)),
        });
        if (res.ok) return { ok: true };
        const j = await res.json().catch(() => ({}));
        const status = j?.error?.status;
        const codes = JSON.stringify(j?.error?.details || '');
        const invalid = res.status === 404 || status === 'NOT_FOUND' || codes.includes('UNREGISTERED') || (res.status === 400 && codes.includes('INVALID_ARGUMENT') && status === 'INVALID_ARGUMENT' && /token/i.test(j?.error?.message || ''));
        return { ok: false, invalidToken: invalid, error: `fcm ${res.status} ${status || ''}` };
      } catch (e) {
        return { ok: false, error: String((e as Error)?.message || e) };
      }
    },
  };
}
