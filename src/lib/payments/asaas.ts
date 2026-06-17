/*
  Integração de pagamento nativo brasileiro — Asaas.
  Suporta assinatura recorrente do proprietário, PIX, boleto e cartão,
  além de split (modelo híbrido). Em produção define ASAAS_API_KEY;
  sem a chave, opera em modo demonstração com dados simulados.

  Docs: https://docs.asaas.com  (sandbox: https://sandbox.asaas.com/api/v3)
*/

const API_BASE =
  process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

export type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

export function isAsaasConfigured() {
  return !!process.env.ASAAS_API_KEY;
}

async function asaasFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error("ASAAS_API_KEY ausente");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: key,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asaas ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface SubscriptionResult {
  demo: boolean;
  subscriptionId: string;
  billingType: BillingType;
  value: number;
  /** Link de pagamento (boleto/cartão) ou payload PIX copia-e-cola. */
  invoiceUrl?: string;
  pixPayload?: string;
  status: string;
}

/** Cria (ou simula) a assinatura recorrente mensal de um proprietário. */
export async function createSubscription(params: {
  customerName: string;
  customerEmail: string;
  cpfCnpj?: string;
  planValue: number;
  planName: string;
  billingType: BillingType;
}): Promise<SubscriptionResult> {
  if (!isAsaasConfigured()) {
    // Modo demonstração — devolve um resultado plausível sem chamar a API.
    return {
      demo: true,
      subscriptionId: `demo_${Math.random().toString(36).slice(2, 10)}`,
      billingType: params.billingType,
      value: params.planValue,
      invoiceUrl:
        params.billingType === "PIX" ? undefined : "https://sandbox.asaas.com/i/demo",
      pixPayload:
        params.billingType === "PIX"
          ? "00020126...DEMO-PIX-COPIA-E-COLA...6304ABCD"
          : undefined,
      status: "PENDING",
    };
  }

  // 1) cliente
  const customer = await asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: params.customerName,
      email: params.customerEmail,
      cpfCnpj: params.cpfCnpj,
    }),
  });

  // 2) assinatura mensal
  const nextDueDate = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const sub = await asaasFetch<{ id: string; status: string }>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id,
      billingType: params.billingType,
      cycle: "MONTHLY",
      value: params.planValue,
      nextDueDate,
      description: `Viva Nomads — plano ${params.planName}`,
    }),
  });

  return {
    demo: false,
    subscriptionId: sub.id,
    billingType: params.billingType,
    value: params.planValue,
    status: sub.status,
  };
}
