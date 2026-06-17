import { NextResponse } from "next/server";
import { createSubscription, type BillingType } from "@/lib/payments/asaas";
import { PLANS } from "@/lib/constants";

/** Cria a assinatura recorrente do proprietário via Asaas (PIX/boleto/cartão). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { planId, billingType, name, email, cpfCnpj } = body as {
    planId?: string;
    billingType?: BillingType;
    name?: string;
    email?: string;
    cpfCnpj?: string;
  };

  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || plan.price === 0) {
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
