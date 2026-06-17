/*
  WhatsApp transacional. Suporta Z-API (mais simples para começar) — basta
  configurar ZAPI_INSTANCE, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN. Sem configuração,
  opera em modo demonstração. (Alternativas: Twilio, Meta WhatsApp Business.)
*/

export function isWhatsappConfigured() {
  return !!process.env.ZAPI_INSTANCE && !!process.env.ZAPI_TOKEN;
}

export interface WhatsappResult {
  demo: boolean;
  ok: boolean;
  error?: string;
}

export async function sendWhatsapp(params: {
  phone: string; // E.164 sem '+', ex.: 5534999990000
  message: string;
}): Promise<WhatsappResult> {
  if (!isWhatsappConfigured()) {
    return { demo: true, ok: true };
  }

  const url = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}/send-text`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": process.env.ZAPI_CLIENT_TOKEN ?? "",
    },
    body: JSON.stringify({ phone: params.phone, message: params.message }),
  });

  return { demo: false, ok: res.ok, error: res.ok ? undefined : `Z-API ${res.status}` };
}
