import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createSubscription, type BillingType } from "@/lib/payments/asaas";
import { PLANS } from "@/lib/constants";

/** Cria a assinatura recorrente do proprietário via Asaas (PIX/boleto/cartão). */
export async function POST(request: Request) {
  // Segurança: exige sessão em produção (demo/preview passa direto).
  const { block } = await requireUser();
  if (block) return block;
  const body = await request.json().catch(() => ({}));
  const { planId, billingType, name, email, cpfCnpj } = body as {
    planId?: string;
    billingType?: BillingType;
    name?: string;
    email?: string;
    cpfCnpj?: string;
  };

  // Gestor NÃO é auto-serviço: é plano de elegibilidade, ativado por venda
  // assistida no piloto. Nunca é cobrável por aqui, elegível ou não.
  if (planId === "gestor") {
    return NextResponse.json(
      { error: "O plano Gestor é ativado com nosso time. Fale com a gente." },
      { status: 403 }
    );
  }

  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || !plan.price) {
    return NextResponse.json({ error: "Plano inválido para cobrança." }, { status: 400 });
  }

  try {
    const result = await createSubscription({
      customerName: name ?? "Proprietário",
      customerEmail: email ?? "sem-email@vivanomads.com.br",
      cpfCnpj,
      planValue: plan.price,
      planName: plan.name,
      billingType: billingType ?? "PIX",
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao criar assinatura." },
      { status: 500 }
    );
  }
}
