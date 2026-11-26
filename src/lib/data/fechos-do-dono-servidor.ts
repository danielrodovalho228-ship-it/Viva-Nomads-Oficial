import "server-only";
/*
  E1090 — a leitura dos fechos do dono, para a lista do Fechamento (a regra é pura, em `src/lib/fechamento/fechos-do-dono.ts`).
  Lê as candidaturas ACEITAS do dono pela sessão (o RLS só devolve as dele) e, com o cliente de serviço, só o que
  pertence a essas candidaturas: as propostas, os contratos, os títulos dos imóveis e os nomes dos moradores. Nenhum
  contato sai daqui.
  R10: "não li" não é "não tem" — qualquer falha de leitura LANÇA (a página mostra o erro com "Tentar de novo"); a lista
  vazia só sai de uma leitura que correu bem.
*/
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COLUNAS_ESTADO_CONTRATO, estadoDoContratoUnico, type LinhaEstadoContrato } from "@/lib/contrato-estado";
import { lerDaterange, periodoEmDias, type Periodo } from "@/lib/contrato-periodo";
import { DIAS_POR_MES } from "@/lib/contrato-blocos";
import { decisaoDoPreAceite } from "@/lib/data/pre-aceite-fechamento";
import {
  fechosDoDono,
  periodoDaCandidatura,
  STATUS_PROPOSTA_ACORDADA,
  type CandidaturaDoFecho,
  type ContratoDoFecho,
  type FechosDoDono,
  type PropostaDoFecho,
} from "@/lib/fechamento/fechos-do-dono";

export const MSG_FECHOS_SEM_LEITURA = "Não foi possível ler os seus fechamentos agora.";

export interface LeituraDosFechos extends FechosDoDono {
  /** Há ao menos uma candidatura aceita (o caso 12: há aceitas, mas nenhuma por fechar). */
  temAceitas: boolean;
}

const VAZIO: LeituraDosFechos = { linhas: [], foraDoTeto: 0, abrir: null, temAceitas: false };

export async function lerFechosDoDono(): Promise<LeituraDosFechos | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: leads, error: erroLeads } = await supabase
    .from("leads")
    .select("id, owner_id, tenant_id, property_id, accepted_at")
    .eq("owner_id", user.id)
    .eq("status", "accepted")
    .order("accepted_at", { ascending: false });
  if (erroLeads) throw new Error(MSG_FECHOS_SEM_LEITURA);
  type Lead = { id: string; owner_id: string; tenant_id: string; property_id: string; accepted_at: string | null };
  const aceitas = (leads ?? []) as Lead[];
  if (aceitas.length === 0) return VAZIO;

  const admin = createAdminClient();
  if (!admin) throw new Error(MSG_FECHOS_SEM_LEITURA);
  const leadIds = aceitas.map((l) => l.id);

  const [rPropostas, rContratos, rImoveis, rMoradores, rJanelas] = await Promise.all([
    // Todas as pré-aceitações (aceita_em preenchido): a mais recente decide se a candidatura expirou (E968).
    admin.from("propostas").select("id, lead_id, numero, status, aceita_em, versao_atual").in("lead_id", leadIds).not("aceita_em", "is", null),
    admin.from("contratos").select(`id, lead_id, proposta_id, created_at, ${COLUNAS_ESTADO_CONTRATO}`).in("lead_id", leadIds),
    admin.from("properties").select("id, title").eq("owner_id", user.id).in("id", [...new Set(aceitas.map((l) => l.property_id))]),
    admin.from("profiles").select("id, full_name").in("id", [...new Set(aceitas.map((l) => l.tenant_id))]),
    admin.from("leads").select("id, inicio_desejado, fim_desejado").in("id", leadIds),
  ]);
  if (rPropostas.error || rContratos.error || rImoveis.error || rMoradores.error || rJanelas.error) throw new Error(MSG_FECHOS_SEM_LEITURA);

  type Proposta = { id: string; lead_id: string; numero: string; status: string; aceita_em: string | null; versao_atual: number };
  const propostas = (rPropostas.data ?? []) as Proposta[];
  const acordadas = propostas.filter((p) => STATUS_PROPOSTA_ACORDADA.includes(p.status));

  // O período de cada estadia acordada, da versão atual da proposta (a mesma conta de dias do contrato).
  const periodoDaProposta = new Map<string, Periodo>();
  if (acordadas.length > 0) {
    const { data: versoes, error: erroVersoes } = await admin
      .from("proposta_versoes")
      .select("proposta_id, versao, data_entrada, meses, dias")
      .in("proposta_id", acordadas.map((p) => p.id));
    if (erroVersoes) throw new Error(MSG_FECHOS_SEM_LEITURA);
    const atual = new Map(acordadas.map((p) => [p.id, p.versao_atual]));
    for (const v of (versoes ?? []) as { proposta_id: string; versao: number; data_entrada: string | null; meses: number | null; dias: number | null }[]) {
      if (atual.get(v.proposta_id) !== v.versao || !v.data_entrada) continue;
      const dias = v.dias == null ? Number(v.meses ?? 0) * DIAS_POR_MES : Number(v.dias);
      if (dias > 0) periodoDaProposta.set(v.proposta_id, periodoEmDias(String(v.data_entrada).slice(0, 10), dias));
    }
  }

  // E968: a pré-aceitação mais recente de cada candidatura.
  const maisRecente = new Map<string, Proposta>();
  for (const p of propostas) {
    const m = maisRecente.get(p.lead_id);
    if (!m || Date.parse(String(p.aceita_em)) > Date.parse(String(m.aceita_em))) maisRecente.set(p.lead_id, p);
  }

  const titulo = new Map(((rImoveis.data ?? []) as { id: string; title: string | null }[]).map((p) => [p.id, p.title]));
  // O nome do morador, como no assistente: nunca um e-mail no lugar do nome.
  const nome = new Map(((rMoradores.data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  const janela = new Map(((rJanelas.data ?? []) as { id: string; inicio_desejado: string | null; fim_desejado: string | null }[]).map((l) => [l.id, l]));

  const candidaturas: CandidaturaDoFecho[] = aceitas.map((l) => {
    const n = nome.get(l.tenant_id);
    const j = janela.get(l.id);
    return {
      id: l.id,
      donoId: l.owner_id,
      imovel: titulo.get(l.property_id) || "Imóvel",
      morador: n && !n.includes("@") ? n : "Candidato(a)",
      aceitaEm: l.accepted_at,
      preAceiteExpirado: decisaoDoPreAceite(maisRecente.get(l.id) ?? null) === "expirada",
      // E1204: fim_desejado é a SAÍDA; a linha guarda o fim inclusivo (saída − 1), como as linhas A e B.
      periodo: periodoDaCandidatura(j?.inicio_desejado ?? null, j?.fim_desejado ?? null),
    };
  });

  const doFecho: PropostaDoFecho[] = acordadas.map((p) => ({
    id: p.id,
    leadId: p.lead_id,
    numero: p.numero,
    status: p.status,
    aceitaEm: p.aceita_em,
    periodo: periodoDaProposta.get(p.id) ?? null,
  }));

  const contratos: ContratoDoFecho[] = ((rContratos.data ?? []) as unknown as (LinhaEstadoContrato & { id: string; lead_id: string; proposta_id: string | null; created_at: string })[]).map((c) => {
    const e = estadoDoContratoUnico(c, "proprietario");
    return {
      id: c.id,
      leadId: c.lead_id,
      propostaId: c.proposta_id,
      criadoEm: c.created_at,
      periodo: lerDaterange(c.periodo),
      estado: { selo: e.selo, etapa: e.etapa },
    };
  });

  return { ...fechosDoDono({ donoId: user.id, candidaturas, propostas: doFecho, contratos }), temAceitas: true };
}
