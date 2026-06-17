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

export interface SubaccountResult {
  demo: boolean;
  walletId: string;
  /** apiKey é devolvida só uma vez — armazenar criptografada imediatamente. */
  apiKey: string;
  status: string;
}

/**
 * Cria (ou simula) uma subconta Asaas para um proprietário aprovado.
 * Recomendado: chamar quando o checklist é aprovado. A resposta traz o
 * walletId (usado no split) e a apiKey (devolvida só uma vez).
 * Nota regulatória: subcontas via API passam por avaliação com limites iniciais.
 */
export async function createSubaccount(params: {
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
}): Promise<SubaccountResult> {
  if (!isAsaasConfigured()) {
    return {
      demo: true,
      walletId: `demo_wallet_${Math.random().toString(36).slice(2, 10)}`,
      apiKey: `demo_apikey_${Math.random().toString(36).slice(2, 14)}`,
      status: "PENDING",
    };
  }

  const acc = await asaasFetch<{ walletId: string; apiKey: string; accountStatus?: string }>(
    "/accounts",
    {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        email: params.email,
        cpfCnpj: params.cpfCnpj,
        mobilePhone: params.mobilePhone,
      }),
    }
  );

  return {
    demo: false,
    walletId: acc.walletId,
    apiKey: acc.apiKey, // armazenar criptografada — devolvida apenas nesta resposta
    status: acc.accountStatus ?? "PENDING",
  };
}

export interface CommissionResult {
  demo: boolean;
  chargeId: string;
  grossAmount: number; // 1º mês de aluguel
  commissionRate: number; // 0.08 a 0.12 conforme o plano
  platformCommission: number;
  ownerNet: number;
  status: string;
}

/**
 * Cobra (ou simula) a comissão de fechamento sobre o 1º mês de aluguel,
 * com split: a plataforma retém a comissão e o restante vai ao proprietário.
 * Os aluguéis seguintes vão direto ao proprietário, fora da plataforma.
 */
export async function createCommissionCharge(params: {
  firstMonthRent: number;
  commissionRate: number;
  ownerWalletId?: string; // conta-filha do proprietário no Asaas
  customerName: string;
  customerEmail: string;
}): Promise<CommissionResult> {
  const platformCommission = Math.round(params.firstMonthRent * params.commissionRate);
  const ownerNet = params.firstMonthRent - platformCommission;

  if (!isAsaasConfigured()) {
    return {
      demo: true,
      chargeId: `demo_${Math.random().toString(36).slice(2, 10)}`,
      grossAmount: params.firstMonthRent,
      commissionRate: params.commissionRate,
      platformCommission,
      ownerNet,
      status: "PENDING",
    };
  }

  const customer = await asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({ name: params.customerName, email: params.customerEmail }),
  });

  // Cobrança única do 1º mês com split para a carteira do proprietário.
  const charge = await asaasFetch<{ id: string; status: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id,
      billingType: "PIX",
      value: params.firstMonthRent,
      dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      description: "Viva Nomads — 1º aluguel (comissão de fechamento retida)",
      split: params.ownerWalletId
        ? [{ walletId: params.ownerWalletId, fixedValue: ownerNet }]
        : undefined,
    }),
  });

  return {
    demo: false,
    chargeId: charge.id,
    grossAmount: params.firstMonthRent,
    commissionRate: params.commissionRate,
    platformCommission,
    ownerNet,
    status: charge.status,
  };
}
