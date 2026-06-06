/* Envio de mensagem WhatsApp via Z-API (server-side). */
export async function sendWhatsApp(phone: string, message: string): Promise<boolean> {
  const instance    = (process.env.ZAPI_INSTANCE     ?? '').trim()
  const token       = (process.env.ZAPI_TOKEN        ?? '').trim()
  const clientToken = (process.env.ZAPI_CLIENT_TOKEN ?? '').trim()
  if (!instance || !token) { console.error('[zapi] credenciais ausentes'); return false }

  const phoneDigits = phone.replace(/\D/g, '')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (clientToken) headers['Client-Token'] = clientToken

  try {
    const res = await fetch(`https://api.z-api.io/instances/${instance}/token/${token}/send-text`, {
      method: 'POST', headers, body: JSON.stringify({ phone: phoneDigits, message }),
    })
    if (!res.ok) console.error('[zapi] http', res.status, (await res.text()).slice(0, 200))
    return res.ok
  } catch (e) { console.error('[zapi] fetch', e); return false }
}
