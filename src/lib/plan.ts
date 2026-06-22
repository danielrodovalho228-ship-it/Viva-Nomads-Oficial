import type { SubscriptionPlan } from "@/lib/store";

/**
 * Regras de plano — puras e SEM dependência de cliente (zustand/React), para
 * poder rodar no servidor (server actions, middleware) e no cliente (PlanGate).
 * O gating real é validado no servidor; o cliente só espelha para a UX.
 */

/** Ordem dos planos (quanto maior, mais recursos). */
export const PLAN_RANK: Record<SubscriptionPlan, number> = {
  free: 0,
  essential: 1,
  pro: 2,
  gestor: 3,
};

/** Limite de anúncios ativos por plano (espelha constants.PLANS.listingLimit). */
export const LISTING_LIMIT: Record<SubscriptionPlan, number> = {
  free: 1,
  essential: 5,
  pro: 20,
  gestor: 999,
};

/** Rótulo amigável do plano. */
export const PLAN_LABEL: Record<SubscriptionPlan, string> = {
  free: "Gratuito",
  essential: "Essencial",
  pro: "Profissional",
  gestor: "Gestor",
};

/** O plano `plan` atende ao mínimo exigido `min`? */
export function planAllows(plan: SubscriptionPlan | undefined, min: SubscriptionPlan): boolean {
  return PLAN_RANK[plan ?? "free"] >= PLAN_RANK[min];
}

/** Quantos anúncios ativos o plano permite. */
export function listingLimit(plan: SubscriptionPlan | undefined): number {
  return LISTING_LIMIT[plan ?? "free"];
}
