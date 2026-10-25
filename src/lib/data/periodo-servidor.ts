import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { conflitoDePeriodo, lerDaterange, mensagemConflitoPeriodo, STATUS_OCUPA_IMOVEL, type Periodo } from "@/lib/contrato-periodo";

/**
 * Períodos já ocupados por contratos ativos do imóvel (cliente de SERVIÇO: o calendário público e a outra parte não
 * leem contratos pelo RLS). Só datas — nunca quem é o morador.
 */
export async function periodosOcupados(admin: SupabaseClient, propertyId: string, ignorarContratoId?: string | null): Promise<Periodo[]> {
  let q = admin.from("contratos").select("id, periodo").eq("property_id", propertyId).eq("status", STATUS_OCUPA_IMOVEL).not("periodo", "is", null);
  if (ignorarContratoId) q = q.neq("id", ignorarContratoId);
  const { data } = await q;
  return ((data ?? []) as { periodo: unknown }[]).map((c) => lerDaterange(c.periodo)).filter((p): p is Periodo => !!p);
}

/** Mensagem "Este imóvel já tem contrato de … a …" quando o pedido cruza um contrato ativo; null quando está livre. */
export async function conflitoNoImovel(admin: SupabaseClient, propertyId: string, pedido: Periodo, ignorarContratoId?: string | null): Promise<string | null> {
  const c = conflitoDePeriodo(pedido, await periodosOcupados(admin, propertyId, ignorarContratoId));
  return c ? mensagemConflitoPeriodo(c) : null;
}
