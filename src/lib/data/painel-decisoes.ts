import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COLUNAS_ESTADO_CONTRATO } from "@/lib/contrato-estado";
import { ehStatusVisita } from "@/lib/visitas-video";
import { linhaParaOrdem, type LinhaOrdem } from "@/lib/manutencao-solicitacoes";
import type {
  CandidaturaParaDecisao,
  ContratoParaDecisao,
  ManutencaoParaDecisao,
  VisitaParaDecisao,
} from "@/lib/painel/decisoes";

/**
 * Dados das decisões da Visão geral (Prompt 42, item 1) que a página ainda não lia — numa sessão só, em paralelo, só
 * colunas de estado (sem contato, sem valores além do que a tela já mostra). As REGRAS ficam nas funções puras de
 * lib/painel/decisoes.ts (que usam as fontes únicas: estado do contrato, visitas, prazo da manutenção). Propostas,
 * estadias e o rascunho a página já busca (listarPropostas, estadiasDaHome, getLatestDraft) e passa direto.
 * Best-effort: sem sessão ou erro → listas vazias (nenhuma decisão inventada).
 */
export interface DadosDecisoesDoServidor {
  contratosDono: ContratoParaDecisao[];
  contratosMorador: ContratoParaDecisao[];
  visitasDono: VisitaParaDecisao[];
  visitasMorador: VisitaParaDecisao[];
  manutencoes: ManutencaoParaDecisao[];
  candidaturas: CandidaturaParaDecisao[];
}

const VAZIO: DadosDecisoesDoServidor = { contratosDono: [], contratosMorador: [], visitasDono: [], visitasMorador: [], manutencoes: [], candidaturas: [] };

type Titulo = { title?: string | null } | null;
const titulo = (t: unknown) => ((t as Titulo)?.title ?? "").trim();

type LinhaContrato = { id: string; properties: Titulo } & Record<string, unknown>;
function contrato(l: LinhaContrato): ContratoParaDecisao {
  return {
    id: String(l.id),
    imovel: titulo(l.properties),
    status: (l.status as string | null) ?? null,
    assinado_proprietario_em: (l.assinado_proprietario_em as string | null) ?? null,
    assinado_inquilino_em: (l.assinado_inquilino_em as string | null) ?? null,
    pagamentos_bloco: (l.pagamentos_bloco as ContratoParaDecisao["pagamentos_bloco"]) ?? null,
  };
}

type LinhaVisita = { id: string; status: string; modalidade: string | null; horarios: string[] | null; horario_proposto: string | null; property: Titulo };
function visita(l: LinhaVisita): VisitaParaDecisao | null {
  if (!ehStatusVisita(l.status)) return null;
  return {
    id: l.id,
    imovel: titulo(l.property),
    status: l.status,
    modalidade: l.modalidade === "presencial" ? "presencial" : "video",
    horarios: l.horarios ?? [],
    horarioProposto: l.horario_proposto,
  };
}

const COLUNAS_VISITA = "id, status, modalidade, horarios, horario_proposto, property:properties!visitas_video_property_id_fkey ( title )";

export async function dadosDasDecisoes(): Promise<DadosDecisoesDoServidor> {
  try {
    const supabase = await createClient();
    if (!supabase) return VAZIO;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return VAZIO;
    const admin = createAdminClient();
    const nada = Promise.resolve({ data: [] as unknown[] });

    const [cDono, cMorador, vDono, vMorador, ordens, leads] = await Promise.all([
      // Contratos dos imóveis do dono (a RLS deixa as partes lerem) — só os vigentes podem esperar assinatura.
      supabase
        .from("contratos")
        .select(`id, properties!inner(title, owner_id), ${COLUNAS_ESTADO_CONTRATO}`)
        .eq("properties.owner_id", user.id)
        .eq("status", "ativo")
        .limit(50),
      supabase.from("contratos").select(`id, properties(title), ${COLUNAS_ESTADO_CONTRATO}`).eq("tenant_id", user.id).eq("status", "ativo").limit(50),
      supabase.from("visitas_video").select(COLUNAS_VISITA).eq("owner_id", user.id).eq("status", "pedido").limit(50),
      // tenant_id da visita não é legível pela sessão: o servidor filtra pelo id da sessão (como em listMinhasVisitas).
      admin ? admin.from("visitas_video").select(COLUNAS_VISITA).eq("tenant_id", user.id).eq("status", "remarcar").limit(50) : nada,
      supabase
        .from("service_orders")
        .select("id, category, priority, description, status, opened_at, first_response_at, resolved_at, properties(title)")
        .eq("owner_id", user.id)
        .neq("status", "resolvido")
        .is("first_response_at", null)
        .limit(50),
      supabase
        .from("leads")
        .select("id, property_id, status, property:properties!leads_property_id_fkey ( title )")
        .eq("owner_id", user.id)
        .eq("status", "new")
        .limit(200),
    ]);

    return {
      contratosDono: ((cDono.data ?? []) as LinhaContrato[]).map(contrato),
      contratosMorador: ((cMorador.data ?? []) as LinhaContrato[]).map(contrato),
      visitasDono: ((vDono.data ?? []) as unknown as LinhaVisita[]).map(visita).filter((v): v is VisitaParaDecisao => !!v),
      visitasMorador: ((vMorador.data ?? []) as unknown as LinhaVisita[]).map(visita).filter((v): v is VisitaParaDecisao => !!v),
      // A mesma tradução da tela Solicitações (linhaParaOrdem); o prazo sai de prazoDaOrdem na função pura.
      manutencoes: ((ordens.data ?? []) as unknown as LinhaOrdem[]).map(linhaParaOrdem).map((o) => ({
        id: o.id,
        imovel: o.property,
        priority: o.priority,
        status: o.status,
        openedAt: o.openedAt,
        firstResponseAt: o.firstResponseAt ?? null,
      })),
      candidaturas: ((leads.data ?? []) as unknown as { id: string; property_id: string; status: string; property: Titulo }[]).map((l) => ({
        id: l.id,
        propertyId: l.property_id,
        imovel: titulo(l.property),
        status: l.status,
      })),
    };
  } catch {
    return VAZIO;
  }
}
