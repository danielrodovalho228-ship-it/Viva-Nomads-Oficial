import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/*
  A taxa de serviço é do DONO e não sai mais pela API (0177: contratos.comissao_* e leads.accepted_* sem SELECT para
  authenticated/anon). Estas leituras usam o cliente de SERVIÇO e só devolvem a taxa depois de conferir que quem pede é
  o dono — do imóvel do contrato ou da candidatura.
*/

export interface TaxaDoContrato {
  comissaoValor: number;
  comissaoPercent: number;
}

/** Taxa dos contratos de imóveis DO dono (os de outros donos ficam de fora, mesmo se o id vier na lista). */
export async function taxaDosContratosDoDono(admin: SupabaseClient, ownerId: string, contratoIds: string[]): Promise<Map<string, TaxaDoContrato>> {
  const mapa = new Map<string, TaxaDoContrato>();
  if (!ownerId || contratoIds.length === 0) return mapa;
  const { data } = await admin
    .from("contratos")
    .select("id, comissao_valor, comissao_percent, properties!inner(owner_id)")
    .in("id", contratoIds)
    .eq("properties.owner_id", ownerId);
  for (const c of (data ?? []) as { id: string; comissao_valor: number | string | null; comissao_percent: number | string | null }[]) {
    mapa.set(c.id, { comissaoValor: Number(c.comissao_valor ?? 0), comissaoPercent: Number(c.comissao_percent ?? 0) });
  }
  return mapa;
}

export interface TaxaDoLead {
  acceptedPlan: string | null;
  acceptedCommissionRate: number | null;
}

/** Plano e taxa congelados no aceite de uma candidatura DO dono; null se a candidatura não é dele. */
export async function taxaDoLeadDoDono(admin: SupabaseClient, ownerId: string, leadId: string): Promise<TaxaDoLead | null> {
  if (!ownerId || !leadId) return null;
  const { data } = await admin.from("leads").select("accepted_plan, accepted_commission_rate").eq("id", leadId).eq("owner_id", ownerId).maybeSingle();
  if (!data) return null;
  const rate = data.accepted_commission_rate;
  return {
    acceptedPlan: (data.accepted_plan as string | null) ?? null,
    acceptedCommissionRate: rate == null ? null : Number(rate),
  };
}
