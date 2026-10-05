import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processarAvisoAsaas, type RepoAsaas } from "@/lib/payments/asaas-webhook";

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

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });

  // Acesso ao banco pelo servidor (service role) — só depois do token conferido.
  const repo: RepoAsaas = {
    async registrarEvento(chave, evento, paymentId) {
      const { error } = await admin.from("asaas_eventos").insert({ chave, evento, payment_id: paymentId });
      if (!error) return true;
      if (error.code === "23505") return false; // já processado
      throw new Error(error.message);
    },
    async desfazerEvento(chave) {
      await admin.from("asaas_eventos").delete().eq("chave", chave);
    },
    async atualizarAssinatura(id, dados) {
      const { data, error } = await admin
        .from("subscriptions")
        .update(dados)
        .eq("gateway_subscription_id", id)
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    async atualizarCobranca(id, dados) {
      const { data, error } = await admin
        .from("cobrancas_fechamento")
        .update(dados)
        .eq("externo_id", id)
        .select("lead_id");
      if (error) throw new Error(error.message);
      return (data ?? []).length > 0;
    },
    // Livro de recebimentos (0071): dono/plano (assinatura) ou candidatura
    // (comissão) resolvidos aqui; pagamento repetido é ignorado (payment_id único).
    async registrarRecebimento(r) {
      let owner_id: string | null = null;
      let plano: string | null = null;
      let lead_id: string | null = null;
      if (r.tipo === "assinatura" && r.subscriptionId) {
        const { data } = await admin
          .from("subscriptions")
          .select("owner_id, plan")
          .eq("gateway_subscription_id", r.subscriptionId)
          .maybeSingle();
        owner_id = (data?.owner_id as string | undefined) ?? null;
        plano = (data?.plan as string | undefined) ?? null;
      } else if (r.tipo === "comissao") {
        const { data } = await admin
          .from("cobrancas_fechamento")
          .select("lead_id")
          .eq("externo_id", r.paymentId)
          .maybeSingle();
        lead_id = (data?.lead_id as string | undefined) ?? null;
      }
      const { error } = await admin.from("recebimentos").upsert(
        { tipo: r.tipo, payment_id: r.paymentId, owner_id, plano, lead_id, valor: r.valor, pago_em: r.pagoEm },
        { onConflict: "payment_id", ignoreDuplicates: true }
      );
      // Sem a 0071 aplicada a tabela não existe: não trava o webhook por isso.
      if (error && error.code !== "42P01" && error.code !== "PGRST205") throw new Error(error.message);
    },
  };

  const r = await processarAvisoAsaas(event, repo);
  if (!r.ok) {
    console.error("[asaas-webhook] falha:", r.erro);
    // 500: o Asaas reenvia o aviso mais tarde (o registro foi desfeito).
    return NextResponse.json({ error: "Falha ao processar." }, { status: 500 });
  }
  if (r.acao === "sem_alvo") console.warn("[asaas-webhook] pagamento sem assinatura/cobrança local:", event?.payment?.id);
  return NextResponse.json({ received: true, acao: r.acao });
}
