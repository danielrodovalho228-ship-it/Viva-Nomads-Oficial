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

/**
 * Telefone como gravado no perfil → E.164 sem "+", que é o que a Z-API espera.
 * "(34) 99999-0000" → "5534999990000"; "+1 641 629 6134" → "16416296134".
 * Já em dígitos com 55 na frente fica como está. Inválido → null.
 */
export function telefoneParaWhatsapp(gravado: string): string | null {
  const texto = String(gravado ?? "").trim();
  const d = texto.replace(/\D/g, "");
  if (texto.startsWith("+")) return d.length >= 8 && d.length <= 15 ? d : null;
  if (d.length === 10 || d.length === 11) return "55" + d;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d;
  return null;
}

export async function sendWhatsapp(params: {
  phone: string; // como gravado no perfil, ex.: "(34) 99999-0000" ou "+1 641 629 6134"
  message: string;
}): Promise<WhatsappResult> {
  if (!isWhatsappConfigured()) {
    return { demo: true, ok: true };
  }
  const phone = telefoneParaWhatsapp(params.phone);
  if (!phone) return { demo: false, ok: false, error: "Telefone inválido para WhatsApp." };

  const url = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE}/token/${process.env.ZAPI_TOKEN}/send-text`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": process.env.ZAPI_CLIENT_TOKEN ?? "",
    },
    body: JSON.stringify({ phone, message: params.message }),
  });

  return { demo: false, ok: res.ok, error: res.ok ? undefined : `Z-API ${res.status}` };
}
