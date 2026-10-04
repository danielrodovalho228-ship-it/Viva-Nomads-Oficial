import crypto from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Webhook do Asaas: confirma pagamentos e atualiza o status da assinatura.
 * Valida o token configurado em ASAAS_WEBHOOK_TOKEN (header asaas-access-token).
 * A5: sem o token configurado, RECUSA (antes aceitava qualquer chamada);
 * comparação em tempo constante.
 */
export async function POST(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "Integração não configurada." }, { status: 503 });
  }
  {
    const token = request.headers.get("asaas-access-token") ?? "";
    const a = crypto.createHash("sha256").update(token).digest();
    const b = crypto.createHash("sha256").update(expected).digest();
    if (!crypto.timingSafeEqual(a, b)) {
      return NextResponse.json({ error: "Token inválido." }, { status: 401 });
    }
  }

  const event = await request.json().catch(() => null);
  if (!event?.event) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  // Eventos típicos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE.
  // Aqui atualizaríamos a tabela subscriptions/transactions no Supabase.
  switch (event.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      // TODO: marcar assinatura como ativa / registrar transação
      break;
    case "PAYMENT_OVERDUE":
      // TODO: marcar assinatura como inadimplente
      break;
  }

  return NextResponse.json({ received: true });
}
