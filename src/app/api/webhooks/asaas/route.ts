import { NextResponse } from "next/server";

/**
 * Webhook do Asaas: confirma pagamentos e atualiza o status da assinatura.
 * Valida o token configurado em ASAAS_WEBHOOK_TOKEN (header asaas-access-token).
 */
export async function POST(request: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (expected) {
    const token = request.headers.get("asaas-access-token");
    if (token !== expected) {
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
