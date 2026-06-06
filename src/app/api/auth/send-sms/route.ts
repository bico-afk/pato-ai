import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sendWhatsApp } from '@/lib/zapi'

export const runtime = 'nodejs'

/* ───────────────────────────────────────────────────────────────
   "Send SMS Hook" do Supabase Auth.
   O Supabase gera o código (OTP) e chama ESTE endpoint para entregá-lo.
   Em vez de SMS, entregamos pelo WhatsApp (Z-API).

   Configurar no Supabase: Authentication → Auth Hooks → Send SMS hook
   → URL: https://SEU_DOMINIO/api/auth/send-sms
   → copie o "secret" gerado e ponha em SEND_SMS_HOOK_SECRET (env).
   ─────────────────────────────────────────────────────────────── */

/** Verifica a assinatura (Standard Webhooks) com o secret do hook. */
function verifySignature(secret: string, headers: Headers, body: string): boolean {
  try {
    const base64 = secret.replace(/^v1,?/, '').replace(/^whsec_/, '')
    const key = Buffer.from(base64, 'base64')
    const id = headers.get('webhook-id')
    const ts = headers.get('webhook-timestamp')
    const sig = headers.get('webhook-signature') ?? ''
    if (!id || !ts) return false
    const expected = crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')
    // o header pode ter várias assinaturas separadas por espaço: "v1,<base64> v1,<base64>"
    return sig.split(' ').some(part => {
      const s = part.includes(',') ? part.split(',')[1] : part
      return s === expected
    })
  } catch { return false }
}

interface HookPayload {
  user?: { phone?: string }
  sms?:  { otp?: string }
}

export async function POST(req: Request) {
  const raw = await req.text()

  const secret = (process.env.SEND_SMS_HOOK_SECRET ?? '').trim()
  if (secret && !verifySignature(secret, req.headers, raw)) {
    console.warn('[send-sms] assinatura inválida — rejeitado')
    return NextResponse.json({ error: { message: 'invalid signature' } }, { status: 401 })
  }

  let payload: HookPayload
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: { message: 'invalid json' } }, { status: 400 }) }

  const phone = (payload.user?.phone ?? '').replace(/\D/g, '')
  const otp   = payload.sms?.otp ?? ''
  if (!phone || !otp) return NextResponse.json({ error: { message: 'missing phone or otp' } }, { status: 400 })

  const msg =
    `🦆 *Bikco* — seu código de acesso é:\n\n` +
    `*${otp}*\n\n` +
    `Digite no site para entrar. Não compartilhe com ninguém.`

  const ok = await sendWhatsApp(phone, msg)
  if (!ok) return NextResponse.json({ error: { message: 'whatsapp send failed' } }, { status: 502 })

  // O Supabase espera 200 com corpo (pode ser vazio) quando entregou.
  return NextResponse.json({})
}
