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
  // Achado 46: a falha de leitura LANÇA — antes virava "nenhum contrato", e o aceite de candidatura ou de proposta
  // passava por cima de um período ocupado (o EXCLUDE da 0176 só recusa no contrato, depois do aceite).
  const { data, error } = await q;
  if (error) throw new Error("Não foi possível ler os períodos ocupados do imóvel.");
  return ((data ?? []) as { periodo: unknown }[]).map((c) => lerDaterange(c.periodo)).filter((p): p is Periodo => !!p);
}

export const MSG_DATAS_SEM_CONFERIR = "Não foi possível conferir as datas do imóvel agora. Tente de novo em instantes.";

/** Mensagem "Este imóvel já tem contrato de … a …" quando o pedido cruza um contrato ativo; null quando está livre. */
export async function conflitoNoImovel(admin: SupabaseClient, propertyId: string, pedido: Periodo, ignorarContratoId?: string | null): Promise<string | null> {
  // Achado 46: sem conseguir conferir as datas, não segue — melhor pedir para tentar de novo que aceitar em data ocupada.
  const ocupados = await periodosOcupados(admin, propertyId, ignorarContratoId).catch(() => null);
  if (!ocupados) return MSG_DATAS_SEM_CONFERIR;
  const c = conflitoDePeriodo(pedido, ocupados);
  return c ? mensagemConflitoPeriodo(c) : null;
}
