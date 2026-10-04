/*
  Integração de pagamento nativo brasileiro — Asaas.
  Suporta assinatura recorrente do proprietário, PIX, boleto e cartão,
  além de split (modelo híbrido). Em produção define ASAAS_API_KEY;
  sem a chave, simula SÓ fora de produção — em produção recusa com
  IntegracaoNaoConfigurada (ver src/lib/integracoes.ts).

  Docs: https://docs.asaas.com  (sandbox: https://sandbox.asaas.com/api/v3)
*/

const API_BASE =
  process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";

import { exigirChaveEmProducao } from "@/lib/integracoes";
import { valorComissao } from "@/lib/comissao";

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
  /** Cliente no Asaas (só no modo real). */
  customerId?: string;
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
    exigirChaveEmProducao("Asaas");
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
    customerId: customer.id,
    billingType: params.billingType,
    value: params.planValue,
    status: sub.status,
  };
}

export interface CommissionResult {
  demo: boolean;
  chargeId: string;
  /** Base de cálculo: 1 mês de aluguel (NÃO é cobrado — só serve de base). */
  baseAluguel: number;
  commissionRate: number; // taxa congelada no aceite
  /** Valor cobrado do PROPRIETÁRIO. */
  platformCommission: number;
  status: string;
}

/**
 * Cobra (ou simula) a COMISSÃO de fechamento do PROPRIETÁRIO, como cobrança à
 * parte. Regra de ouro: a plataforma nunca movimenta o aluguel — o inquilino
 * paga o aluguel direto ao proprietário. Antes esta função gerava um PIX do 1º
 * aluguel INTEIRO para o inquilino com split ao dono (e, sem carteira do dono,
 * o aluguel todo ficava com a plataforma).
 */
export async function createCommissionCharge(params: {
  aluguelMensal: number;
  commissionRate: number;
  ownerName: string;
  ownerEmail: string;
  ownerCpfCnpj?: string;
}): Promise<CommissionResult> {
  const platformCommission = valorComissao(params.aluguelMensal, params.commissionRate);

  if (!isAsaasConfigured()) {
    exigirChaveEmProducao("Asaas");
    return {
      demo: true,
      chargeId: `demo_${Math.random().toString(36).slice(2, 10)}`,
      baseAluguel: params.aluguelMensal,
      commissionRate: params.commissionRate,
      platformCommission,
      status: "PENDING",
    };
  }
  if (platformCommission <= 0) {
    // Plano sem comissão (Gestor): nada a cobrar.
    return {
      demo: false,
      chargeId: "sem_comissao",
      baseAluguel: params.aluguelMensal,
      commissionRate: params.commissionRate,
      platformCommission: 0,
      status: "NOT_APPLICABLE",
    };
  }

  const customer = await asaasFetch<{ id: string }>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: params.ownerName,
      email: params.ownerEmail,
      ...(params.ownerCpfCnpj ? { cpfCnpj: params.ownerCpfCnpj } : {}),
    }),
  });

  // Cobrança ÚNICA da comissão, do proprietário. Sem split, sem aluguel.
  const charge = await asaasFetch<{ id: string; status: string }>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: customer.id,
      billingType: "PIX",
      value: platformCommission,
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      description: `Viva Nomads — comissão de fechamento (${Math.round(params.commissionRate * 100)}% sobre 1 aluguel)`,
    }),
  });

  return {
    demo: false,
    chargeId: charge.id,
    baseAluguel: params.aluguelMensal,
    commissionRate: params.commissionRate,
    platformCommission,
    status: charge.status,
  };
}
