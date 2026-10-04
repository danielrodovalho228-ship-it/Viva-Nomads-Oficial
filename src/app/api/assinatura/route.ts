import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSubscription, isAsaasConfigured, type BillingType } from "@/lib/payments/asaas";
import { PLANS } from "@/lib/constants";
import { IntegracaoNaoConfigurada, MSG_NAO_CONFIGURADA, emProducao } from "@/lib/integracoes";
import { consumirLimite, DIA } from "@/lib/limites";
import { createAdminClient } from "@/lib/supabase/admin";

const FORMAS: BillingType[] = ["PIX", "BOLETO", "CREDIT_CARD"];

/**
 * Assinatura do plano do proprietário (Asaas). A5: nome, e-mail e CPF/CNPJ vêm
 * do PERFIL (não do pedido); o preço vem da tabela de planos do servidor; no
 * máximo 1 pedido de assinatura por conta a cada 24h (cada pedido cria cliente
 * e assinatura no Asaas). O plano só muda quando o pagamento confirmar (webhook).
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Serviço indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { planId?: string; billingType?: string };
  if (body.planId === "gestor") {
    return NextResponse.json(
      { error: "O plano Gestor é ativado com nosso time. Fale com a gente." },
      { status: 403 }
    );
  }
  const plan = PLANS.find((p) => p.id === body.planId);
  if (!plan || !plan.price) {
    return NextResponse.json({ error: "Plano inválido para cobrança." }, { status: 400 });
  }
  const billingType = FORMAS.includes(body.billingType as BillingType) ? (body.billingType as BillingType) : "PIX";

  const { data: perfil } = await supabase
    .from("profiles")
    .select("full_name, email, cpf, cnpj, person_type")
    .eq("id", user.id)
    .maybeSingle();
  const documento = String((perfil?.person_type === "pj" ? perfil?.cnpj : perfil?.cpf) ?? "").replace(/\D/g, "");

  if (!isAsaasConfigured() && emProducao()) {
    return NextResponse.json({ error: MSG_NAO_CONFIGURADA }, { status: 503 });
  }
  if (!(await consumirLimite(`assinatura:user:${user.id}`, 1, DIA))) {
    return NextResponse.json(
      { error: "Já recebemos um pedido de assinatura seu hoje. Confira seu e-mail ou fale com a gente." },
      { status: 429 }
    );
  }

  try {
    const result = await createSubscription({
      customerName: (perfil?.full_name as string) || "Proprietário",
      customerEmail: (perfil?.email as string) || user.email || "sem-email@vivanomads.com.br",
      cpfCnpj: documento || undefined,
      planValue: plan.price,
      planName: plan.name,
      billingType,
    });
    // Registra a assinatura como PENDENTE: o webhook do Asaas a encontra pelo
    // id e só a ativa quando o pagamento confirmar (o plano vale a partir daí).
    if (!result.demo) {
      const admin = createAdminClient();
      const { error: subErr } = admin
        ? await admin.from("subscriptions").insert({
            owner_id: user.id,
            gateway: "asaas",
            gateway_customer_id: result.customerId ?? null,
            gateway_subscription_id: result.subscriptionId,
            billing_type: billingType,
            plan: plan.id,
            status: "pending",
          })
        : { error: { message: "sem service role" } };
      if (subErr) console.error("[assinatura] assinatura criada no Asaas mas não registrada:", result.subscriptionId, subErr.message);
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof IntegracaoNaoConfigurada) {
      return NextResponse.json({ error: MSG_NAO_CONFIGURADA }, { status: 503 });
    }
    console.error("[assinatura] falha:", err);
    return NextResponse.json({ error: "Falha ao criar a assinatura." }, { status: 502 });
  }
}
