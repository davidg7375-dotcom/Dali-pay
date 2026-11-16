// Supabase Edge Function: שולחת Push לנמען של הודעה. מופעלת מהאפליקציה אחרי שההודעה נשמרה.
// סודות: FCM_SERVICE_ACCOUNT_JSON (JSON של חשבון שירות Firebase). SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY מגיעים אוטומטית.
// @ts-nocheck — רץ ב-Deno
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { createFcmClient } from './fcm.ts';
import { handle } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const fcm = createFcmClient(Deno.env.get('FCM_SERVICE_ACCOUNT_JSON'));
const imageBase = Deno.env.get('PUSH_IMAGE_BASE') || 'https://raw.githubusercontent.com/davidg7375-dotcom/Dali-pay/main/push';

Deno.serve((req) => handle(req, { imageBase }, admin, fcm));
