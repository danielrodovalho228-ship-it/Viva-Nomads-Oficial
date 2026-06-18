import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook do Asaas: confirma pagamentos e atualiza o status da assinatura.
 * Valida o token configurado em ASAAS_WEBHOOK_TOKEN (header asaas-access-token).
 *
 * Persiste o efeito no Supabase via service role (sem usuário autenticado).
 * Sem SUPABASE_SERVICE_ROLE_KEY, responde 200 e apenas reconhece o evento
 * (modo demonstração) — o Asaas não fica reenviando.
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

  const supabase = createAdminClient();
  // Sem service role configurada → reconhece o evento sem persistir (demo).
  if (!supabase) {
    return NextResponse.json({ received: true, demo: true });
  }

  const payment = event.payment ?? {};
  const subscriptionId: string | undefined = payment.subscription;

  // Eventos típicos: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, PAYMENT_OVERDUE.
  let status: "active" | "overdue" | null = null;
  switch (event.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      status = "active";
      break;
    case "PAYMENT_OVERDUE":
      status = "overdue";
      break;
  }

  if (status && subscriptionId) {
    const update: Record<string, unknown> = { status };
    // Pagamento em dia → estende o período por ~30 dias.
    if (status === "active") {
      update.current_period_end = new Date(Date.now() + 30 * 86400000).toISOString();
    }
    const { error } = await supabase
      .from("subscriptions")
      .update(update)
      .eq("gateway_subscription_id", subscriptionId);
    if (error) {
      // Loga e devolve 500 para o Asaas reenviar o evento mais tarde.
      console.error("[asaas webhook] falha ao atualizar assinatura:", error.message);
      return NextResponse.json({ error: "Falha ao persistir." }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
