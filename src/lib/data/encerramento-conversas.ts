import type { SupabaseClient } from "@supabase/supabase-js";
import { estadoDaConversa, type CandidaturaDaConversa, type EstadoDaConversa } from "@/lib/mensagens/encerramento";

/*
  E969 — o estado de encerramento de cada conversa (pessoa+pessoa+imóvel), lido pelo SERVIDOR (service role: o contrato,
  os blocos e a caução da outra parte não entram pela RLS do usuário). Sempre restrito às conversas em que `meuId` é parte.
  Falha de leitura: a conversa fica ABERTA (nunca trava o envio por erro de leitura).
*/
type Linha = { id: string; property_id: string; tenant_id: string; owner_id: string; status: string; created_at: string; rejected_at: string | null };

const chave = (imovel: string, a: string, b: string) => `${imovel}|${[a, b].sort().join("|")}`;

export async function estadosDasConversas(
  admin: SupabaseClient,
  meuId: string,
  pares: { propertyId: string; otherId: string }[],
  hoje: string = new Date().toISOString().slice(0, 10),
): Promise<Map<string, EstadoDaConversa>> {
  const saida = new Map<string, EstadoDaConversa>();
  const imoveis = [...new Set(pares.map((p) => p.propertyId).filter(Boolean))];
  if (!imoveis.length) return saida;
  try {
    const { data: leads, error } = await admin
      .from("leads")
      .select("id, property_id, tenant_id, owner_id, status, created_at, rejected_at")
      .in("property_id", imoveis)
      .or(`tenant_id.eq.${meuId},owner_id.eq.${meuId}`);
    if (error) console.error("[encerramento] leitura das candidaturas:", error.code, error.message);
    if (error || !leads?.length) return saida;
    const linhas = leads as Linha[];
    const ids = linhas.map((l) => l.id);
    const { data: contratos } = await admin.from("contratos").select("id, lead_id, contrato_blocos(fim, caucao, status)").in("lead_id", ids);
    const cts = (contratos ?? []) as { id: string; lead_id: string; contrato_blocos: { fim: string | null; caucao: number | null; status: string | null }[] | null }[];
    const { data: prazos } = cts.length ? await admin.from("caucao_prazos").select("contrato_id, devolvida_em, pendencia_em").in("contrato_id", cts.map((c) => c.id)) : { data: [] };
    const prazoDe = new Map(((prazos ?? []) as { contrato_id: string; devolvida_em: string | null }[]).map((p) => [p.contrato_id, p]));

    const porConversa = new Map<string, CandidaturaDaConversa[]>();
    for (const l of linhas) {
      const ct = cts.find((c) => c.lead_id === l.id);
      const blocos = (ct?.contrato_blocos ?? []).filter((b) => b.status !== "cancelado" && b.fim);
      const fimEstadia = blocos.map((b) => String(b.fim).slice(0, 10)).sort().at(-1) ?? null;
      const comCaucao = blocos.some((b) => Number(b.caucao ?? 0) > 0) || (ct ? prazoDe.has(ct.id) : false);
      const cand: CandidaturaDaConversa = {
        criadaEm: l.created_at,
        status: l.status,
        terminouEm: l.rejected_at ?? null,
        contrato: ct ? { fimEstadia, comCaucao, fimProcessoCaucao: prazoDe.get(ct.id)?.devolvida_em ?? null } : null,
      };
      const k = chave(l.property_id, l.tenant_id, l.owner_id);
      porConversa.set(k, [...(porConversa.get(k) ?? []), cand]);
    }
    for (const p of pares) {
      const cands = porConversa.get(chave(p.propertyId, meuId, p.otherId));
      if (cands) saida.set(chave(p.propertyId, meuId, p.otherId), estadoDaConversa(cands, hoje));
    }
  } catch {
    /* leitura falhou: conversas abertas */
  }
  return saida;
}

export const chaveDaConversa = (propertyId: string, meuId: string, otherId: string) => chave(propertyId, meuId, otherId);
