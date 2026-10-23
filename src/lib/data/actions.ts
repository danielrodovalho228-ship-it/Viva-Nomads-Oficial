"use server";

import { MSG_DISPONIVEL_ATE_ANTES, periodoDisponivelValido } from "@/lib/anuncio/periodo-disponivel";
import { gravarMarca } from "@/lib/marcas/servidor";
import { perfilDonoCompleto, MSG_PERFIL_DONO_INCOMPLETO } from "@/lib/anuncio/perfil-dono";
import { atualizarRascunhoDoDono, rascunhoVazioRecente } from "@/lib/data/rascunho-dono";
import { camposDeConteudoDoRascunho } from "@/lib/data/rascunho-campos";
import { ligarMatriculaAoImovel, ligarQualificacaoAoImovel } from "@/lib/data/ligar-qualificacao";
import { colunaVideoArquivo } from "@/lib/video-anuncio";
import { caminhoDoDono, colunasDeOperacao } from "@/lib/anuncio/operacao";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { cookies } from "next/headers";
import { revalidarAnuncio } from "@/lib/anuncio/revalidar";
import { createClient } from "@/lib/supabase/server";
import { dentroDoLimite, HORA, DIA as DIA_SEGUNDOS } from "@/lib/limites";
import { textoEmail, textoPlano } from "@/lib/notifications/texto-seguro";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAtivacao } from "@/lib/ativacao/servidor";
import type { EligibilityState, QualityState } from "@/lib/qualification";
import {
  isEligible,
  readyToLiveScore,
  tagHomeOffice,
  tagWorkLocated,
  tagCondoApproved,
} from "@/lib/qualification";
import { findNearbyWorkspaces } from "@/lib/integrations/places";
import { notify } from "@/lib/notifications";
import { ASSUNTOS } from "@/lib/notifications/assuntos";
import { donoPodeReativar, mensagemLimitePublicar, mensagemLimiteReativar, situacaoLimite, textoDaPausa, type EmAndamento, type SituacaoLimite } from "@/lib/anuncio/pausa";
import type { SubscriptionPlan } from "@/lib/store";
import { buildLeadNotification, LEAD_KIND_MSG, type LeadKind } from "@/lib/leads";
import { amenityRows } from "@/lib/amenities";
import { fotosDoDono, urlsDoRascunho } from "@/lib/fotos-anuncio";
import { taxaDoContrato } from "@/config/planos";
import { motivoBloqueioContrato } from "@/lib/contrato-trava";
import { lerDocumento } from "@/lib/data/documento-servidor";
import { docsInquilinoCompletos } from "@/lib/data/documentos-inquilino-servidor";
import { TERMO_IA_VERSAO, validarAceiteIa } from "@/lib/anuncio/termo-ia";
import { erroBancoPT } from "@/lib/erros-banco";
import { salvarDeclaracoesConforto } from "@/lib/conforto/servidor";
import { confortoParaGravar } from "@/lib/conforto/gravacao";
import { planoDoProprietario } from "@/lib/data/plano-efetivo";
import { avisarPedidosDoImovel } from "@/lib/data/pedidos-compat";
import { avisarBuscasDoImovel } from "@/lib/data/alerta-busca-servidor";
import { INTERNET_META } from "@/lib/internet";
import { validarMotivoEstadia } from "@/lib/conta-validacao";
import { getPropertyForOwner } from "@/lib/data/properties";
import { colunaAirbnb } from "@/lib/preco-justo";
import { colunasPrivacidade, type TipoAcesso } from "@/lib/anuncio/privacidade";
import { prontidaoDoImovel, fatosDosImoveis } from "@/lib/anuncio/prontidao-servidor";
import { prontidaoAnuncio } from "@/lib/anuncio/prontidao";
import { chegadaDoRascunho, colunasChegadaEPedido, type EntradaChegadaEPedido } from "@/lib/anuncio/chegada-e-pedido";
import { atribuirLead, garantirCartao } from "@/lib/data/cartoes-servidor";
import { REF_COOKIE } from "@/lib/cartoes/compartilhar";
import { scoreAnuncio, type ScoreAnuncio } from "@/lib/anuncio/score";
import type { Prontidao } from "@/lib/anuncio/prontidao";
import { guardContactInfo, DOCUMENTO_BLOQUEADO } from "@/lib/messages/contact-guard";
import { isExemplo, EXEMPLO_SEM_CONTATO } from "@/lib/demo-listing";
import { conversationId as idConversa } from "@/lib/messages/conversation-id";
import { SITE_URL } from "@/lib/site";
import type { Property } from "@/lib/types";
import { hojeBR, dataBR } from "@/lib/utils";
import { validarInicioEstadia } from "@/lib/inicio-estadia";
import {
  resumoContrato,
  encadearDatas,
  addDiasISO,
  fimInclusivoISO,
  diasInclusivos,
  caucaoDoBloco,
  cabeNoPrazoMaximo,
  DIAS_POR_MES,
  MESES_POR_BLOCO_PADRAO,
  MAX_MESES_BLOCO,
  PRAZO_MIN_MESES,
  PRAZO_MAX_MESES,
  PRAZO_MAX_DIAS,
  type BlocoComDatas,
} from "@/lib/contrato-blocos";
import { normalizarRegrasPets } from "@/lib/anuncio/pets-regras";
import { normalizarLimpezaEstadia } from "@/lib/anuncio/limpeza-estadia";
import { normalizarLimites, normalizarNegociacao } from "@/lib/anuncio/negociacao";
import { mbpsValido } from "@/lib/anuncio/sugestoes-cadastro";
import { apagarFotosDoAnuncio, ligarHashesAoImovel } from "@/lib/minimizacao/fotos-anuncio";
import { videoTourPermitido } from "@/lib/video-tour";
import { validarGarantia, type GarantiaContrato } from "@/lib/guarantees";
import { marcarPropostaEmContrato, propostaAcordadaDoLead } from "@/lib/data/propostas-servidor";
import { taxaDoLeadDoDono } from "@/lib/data/taxa-dono-servidor";
import { conflitoNoImovel } from "@/lib/data/periodo-servidor";
import { ERRO_SOBREPOSICAO_PG } from "@/lib/contrato-periodo";
import { validarOcupantes } from "@/lib/candidaturas/ocupantes";
import { anotarInteresseDoDono, bloqueioPorCidade } from "@/lib/cidades-liberadas/servidor";
import { MUNICIPIOS } from "@/lib/municipios";
import { avisarAdminsDocumentoRecebido } from "@/lib/data/aviso-documento-recebido";
import {
  caminhoDoDonoValido,
  documentoJaNaFila,
  documentoNoSalvar,
  hashValido,
  limparTitularDocumento,
  linhaDoEnvio,
  salvarNaMesmaLinha,
  CAMPOS_FIXOS_DA_FILA,
} from "@/lib/documento/fila-envio";

type ActionResult = { ok: boolean; demo?: boolean; id?: string; error?: string };

/** Persiste o checklist de qualificação (Fase 4). */
/** Nome do titular digitado pelo dono (só texto, até 150 caracteres). */
const limparTitular = limparTitularDocumento;

export async function saveQualification(
  elig: EligibilityState,
  quality: QualityState,
  documentPath?: string | null,
  documentHash?: string | null,
  /** Imóvel qualificado (`/qualificar?imovel=<id>`). Sem ele, a qualificação
   *  fica à espera e é ligada ao PRÓXIMO imóvel criado (createProperty). */
  propertyId?: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  // A qualificação é do IMÓVEL: só de um imóvel do próprio dono (o banco
  // confere de novo — 0060).
  if (propertyId) {
    if (!UUID_RE.test(propertyId)) return { ok: false, error: "Imóvel inválido." };
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!prop) return { ok: false, error: "Imóvel não encontrado." };
  }

  // Prompt 35A, item 1: o documento já entrou na fila no ENVIO (enviarDocumentoParaConferencia)? Então esta
  // linha grava SEM documento e o banco herda o da linha anterior (0072) — sem segundo item na fila nem segundo
  // aviso. Arquivo que ainda não está na fila segue o caminho de antes (entra "em análise" e avisa).
  let ultimoQ = supabase.from("qualification_checklists").select("id, document_path, document_status").eq("owner_id", user.id);
  ultimoQ = propertyId ? ultimoQ.eq("property_id", propertyId) : ultimoQ.is("property_id", null);
  const { data: ultimo } = documentPath
    ? await ultimoQ.order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const doc = documentoNoSalvar((ultimo?.document_path as string | null | undefined) ?? null, documentPath ?? null);
  const docGravado = doc.gravarPath;

  const eligible = isEligible(elig);
  const ready_to_live_score = readyToLiveScore(quality);

  const linha = {
    owner_id: user.id,
    property_id: propertyId ?? null,
    furnished: elig.furnished,
    accepts_30days: elig.accepts30days,
    iptu_ok: elig.iptuOk,
    habitable: elig.habitable,
    is_owner_or_agent: elig.isOwnerOrAgent,
    condo_allows: elig.condoAllows || "unknown",
    // Caminho do documento no bucket PRIVADO (migration 0041). Só a referência
    // — a exibição usa URL assinada. null quando não enviado: aí o banco herda o
    // documento (e a revisão) da qualificação anterior do mesmo imóvel (0072).
    document_path: docGravado,
    // Impressão digital do arquivo (0044) — detecta reuso entre contas na
    // conferência. Carimbo de quando foi enviado (distinto do created_at).
    document_hash_sha256: docGravado ? (documentHash ?? null) : null,
    document_uploaded_at: docGravado ? new Date().toISOString() : null,
    // Anti-fraude (migration 0042): documento enviado entra "em análise"; um
    // admin aprova/recusa. Só aprovado libera Publicar. O banco decide (0060/0072).
    document_status: docGravado ? "pending" : "none",
    eligible,
    // Selo base + etiquetas (Atualização 11)
    ready_to_live_score,
    ready_to_live_badge: ready_to_live_score >= 70,
    tag_home_office: tagHomeOffice(quality),
    tag_work_located: tagWorkLocated(quality),
    tag_condo_approved: tagCondoApproved(elig),
    internet_tier: quality.internetTier in INTERNET_META ? quality.internetTier : null,
    status: eligible ? "approved" : "not_eligible",
  };
  // O estado completo da tela (0072) — para o /qualificar abrir preenchido.
  const formulario = { versao: 1, elig: { ...elig, titularDocumento: limparTitular(elig.titularDocumento) }, quality };

  // Prompt 36, item 3a: o envio já pôs ESTE arquivo na fila e ele ainda está em análise → atualiza a MESMA linha
  // (respostas + formulário com o titular), sem criar outra. O gatilho da 0072 não deixa o dono alterar a linha
  // gravada; por isso grava pelo cliente de serviço, preso ao id E ao dono, e sem tocar no documento nem na revisão.
  if (salvarNaMesmaLinha(ultimo, documentPath)) {
    const servico = createAdminClient();
    if (servico) {
      const respostas: Record<string, unknown> = { ...linha };
      for (const k of CAMPOS_FIXOS_DA_FILA) delete respostas[k];
      const { data: upd, error: erroUpd } = await servico
        .from("qualification_checklists")
        .update({ ...respostas, formulario })
        .eq("id", ultimo.id)
        .eq("owner_id", user.id)
        .eq("document_status", "pending")
        .select("id");
      if (!erroUpd && upd?.length) return { ok: true, id: ultimo.id };
      if (erroUpd) console.error("[saveQualification] falha ao atualizar a linha da fila:", erroUpd.message);
    }
  }

  let { data, error } = await supabase
    .from("qualification_checklists")
    .insert({ ...linha, formulario })
    .select("id")
    .single();
  // Sem a 0072 aplicada a coluna não existe: grava sem o formulário.
  if (error && (error.code === "PGRST204" || /formulario/.test(error.message))) {
    ({ data, error } = await supabase.from("qualification_checklists").insert(linha).select("id").single());
  }

  if (error) {
    // Nunca mostra a mensagem técnica do banco (em inglês) ao proprietário.
    console.error("[saveQualification] falha ao gravar:", error.message);
    return { ok: false, error: "Não foi possível salvar a qualificação agora. Tente novamente em instantes." };
  }

  // Documento NOVO entrou na fila → avisa os admins (best-effort; nunca trava nem
  // vaza dados do documento — só o fato de que há item para conferir). Só
  // admins que ligaram "receber alertas" na Conta (ordem 27cfd36a).
  if (doc.avisarAdmins) await avisarAdminsDocumentoRecebido();
  return { ok: true, id: (data as { id: string }).id };
}

/**
 * Prompt 35A, item 1 — DOCUMENTO ENFILEIRADO NO ENVIO. Chamada pelo /qualificar logo depois do
 * /api/upload/documento: grava a linha da qualificação com o documento "em análise" (document_status 'pending',
 * caminho, impressão digital e data do envio), herdando as respostas da qualificação anterior do MESMO imóvel, e
 * avisa os admins (documento_recebido). Assim o documento entra na fila de /admin/documentos mesmo que a pessoa
 * saia da tela sem concluir. Sem imóvel (`propertyId` nulo): a linha fica à espera e se liga ao próximo imóvel
 * criado (mesma regra do saveQualification); a fila mostra "Documento sem imóvel ligado".
 * Idempotente: o mesmo arquivo já na fila não cria outra linha nem outro aviso. Grava com o cliente da pessoa —
 * o banco força o 'pending' e confere o imóvel (0060/0072).
 */
export async function enviarDocumentoParaConferencia(
  propertyId: string | null,
  path: string,
  hash: string | null,
  /** Prompt 36, item 3a: o nome do titular escrito no campo NO MOMENTO do envio (vai para formulario.elig). */
  titularDocumento?: string | null
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre na sua conta para enviar o documento." };
  if (!caminhoDoDonoValido(path, user.id)) return { ok: false, error: "Documento inválido. Envie o arquivo de novo." };
  if (propertyId) {
    if (!UUID_RE.test(propertyId)) return { ok: false, error: "Imóvel inválido." };
    const { data: prop } = await supabase
      .from("properties")
      .select("id")
      .eq("id", propertyId)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!prop) return { ok: false, error: "Imóvel não encontrado." };
  }
  if (!(await dentroDoLimite(`doc-fila:${user.id}`, 30, DIA_SEGUNDOS))) {
    return { ok: false, error: "Muitos envios de documento hoje. Tente novamente amanhã." };
  }

  // Respostas da qualificação anterior do MESMO imóvel (ou da que está à espera): a linha nova só troca o documento.
  let q = supabase.from("qualification_checklists").select("*").eq("owner_id", user.id);
  q = propertyId ? q.eq("property_id", propertyId) : q.is("property_id", null);
  const { data: anterior } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (anterior && documentoJaNaFila(anterior.document_path as string | null, path)) {
    return { ok: true, id: anterior.id as string };
  }

  const linha = linhaDoEnvio((anterior as Record<string, unknown> | null) ?? null, {
    ownerId: user.id,
    propertyId: propertyId ?? null,
    path,
    hash: hashValido(hash),
    agora: new Date(),
    titular: titularDocumento,
  });
  const { data, error } = await supabase.from("qualification_checklists").insert(linha).select("id").single();
  if (error || !data) {
    console.error("[enviarDocumentoParaConferencia] falha ao gravar:", error?.message ?? "sem linha");
    return { ok: false, error: "Não foi possível colocar o documento na fila de conferência agora. Tente de novo." };
  }
  await avisarAdminsDocumentoRecebido();
  return { ok: true, id: (data as { id: string }).id };
}

export type DocumentStatus = "none" | "pending" | "approved" | "rejected";

/**
 * Estado da verificação do documento do proprietário logado (última
 * qualificação). O editor usa isto para o portão de Publicar (item 1 do QA):
 * só `approved` libera. Em demo/preview (sem Supabase) devolve `approved` para
 * não travar os fluxos de demonstração.
 */
export async function getMyDocumentStatus(
  propertyId?: string | null
): Promise<{ status: DocumentStatus; reason: string | null }> {
  const supabase = await createClient();
  if (!supabase) return { status: "approved", reason: null };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "none", reason: null };
  // Por IMÓVEL: a qualificação dele; imóvel novo: a qualificação à espera
  // (ainda sem imóvel), que será ligada a ele ao criar.
  const q = await qualificacaoDoImovel(supabase, user.id, propertyId ?? null);
  return {
    status: ((q?.document_status as DocumentStatus) ?? "none"),
    reason: (q?.document_review_reason as string) ?? null,
  };
}

/**
 * Qualificação já salva deste imóvel (ou a que está à espera), para o
 * /qualificar abrir PREENCHIDO. Usa o formulário completo (0072); em linhas
 * antigas, refaz os requisitos pelas colunas. `temDocumento`: já há documento
 * enviado — a tela não pede de novo (salvar sem documento novo o mantém).
 */
export async function carregarQualificacao(
  propertyId?: string | null
): Promise<{ elig: EligibilityState; quality: Partial<QualityState> | null; temDocumento: boolean } | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  if (propertyId && !UUID_RE.test(propertyId)) return null;
  let q = supabase.from("qualification_checklists").select("*").eq("owner_id", user.id);
  q = propertyId ? q.eq("property_id", propertyId) : q.is("property_id", null);
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const temDocumento = !!data.document_path;
  const form = (data.formulario ?? null) as { elig?: Partial<EligibilityState>; quality?: Partial<QualityState> } | null;
  const condo = data.condo_allows as string | null;
  const elig: EligibilityState = {
    furnished: form?.elig?.furnished ?? !!data.furnished,
    accepts30days: form?.elig?.accepts30days ?? !!data.accepts_30days,
    iptuOk: form?.elig?.iptuOk ?? !!data.iptu_ok,
    habitable: form?.elig?.habitable ?? !!data.habitable,
    isOwnerOrAgent: form?.elig?.isOwnerOrAgent ?? !!data.is_owner_or_agent,
    hasDocument: temDocumento,
    titularDocumento: typeof form?.elig?.titularDocumento === "string" ? form.elig.titularDocumento : undefined,
    condoAllows: (form?.elig?.condoAllows ??
      (condo === "yes" || condo === "no" || condo === "unknown" ? condo : "")) as EligibilityState["condoAllows"],
  };
  const quality: Partial<QualityState> | null =
    form?.quality ?? (data.internet_tier ? { internetTier: data.internet_tier as QualityState["internetTier"] } : null);
  return { elig, quality, temDocumento };
}

/** Título e endereço de um imóvel do PRÓPRIO dono (cabeçalho do /qualificar). */
export async function resumoImovelDoDono(
  id: string
): Promise<{ id: string; titulo: string; local: string; rascunho: boolean } | null> {
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(id)) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("properties")
    .select("id, title, address, city, status")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    titulo: (data.title as string) || "Imóvel sem título",
    local: [data.address, data.city].filter(Boolean).join(", "),
    rascunho: data.status === "draft",
  };
}

/**
 * Qualificação que vale para um imóvel: a mais recente LIGADA a ele; para um
 * imóvel ainda não criado (propertyId null), a mais recente do dono ainda sem
 * imóvel. Nunca a de outro imóvel (antes valia "a última do dono").
 */
async function qualificacaoDoImovel(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ownerId: string,
  propertyId: string | null
): Promise<{ id: string; document_status: string | null; document_review_reason: string | null } | null> {
  let q = supabase
    .from("qualification_checklists")
    .select("id, document_status, document_review_reason")
    .eq("owner_id", ownerId);
  q = propertyId ? q.eq("property_id", propertyId) : q.is("property_id", null);
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as { id: string; document_status: string | null; document_review_reason: string | null } | null) ?? null;
}

/** Cria um imóvel (Fase 5), exigindo um checklist aprovado. */
export interface PropertyInput {
  title: string;
  description: string;
  propertyType: string;
  city: string;
  neighborhood: string;
  bedrooms: number;
  bathrooms: number;
  areaM2: number;
  minPeriodDays: number;
  monthlyPrice: number;
  /** Preço mensal equivalente no Airbnb (opcional) — base do selo "Preço justo" (0130). */
  airbnbMonthlyPrice?: number;
  readyToLiveScore: number;
  tagHomeOffice?: boolean;
  tagWorkLocated?: boolean;
  tagCondoApproved?: boolean;
  ownershipType?: "own" | "subleased" | "managed";
  subleaseAuthorized?: boolean;
  subleaseDocUrl?: string;
  /** Privacidade e acesso (ordem f92bc582). Ausente = não mexe no que já está gravado. */
  semCamerasInterior?: boolean;
  camerasExternas?: string;
  tipoAcesso?: string | null;
  senhaTrocadaEstadia?: boolean;
  utilitiesMode?: "fixed" | "real";
  utilitiesEstimate?: number;
  issuesInvoice?: boolean;
  acceptsInsurance?: boolean;
  /** Faixas de prazo aceitas (temporada, media_estadia, longa). */
  faixasAceitas?: string[];
  /** Garantias que o proprietário aceita (caucao_avista, caucao_parcelada, titulo, seguro_fianca). */
  garantiasAceitas?: string[];
  prepFee?: number;
  lat?: number;
  lng?: number;
  photoUrls?: string[];
  videoUrl?: string;
  /** Vídeo enviado (ordem 8681ae95): caminho "<uid>/<arquivo>" no bucket anuncio-videos. Ausente = não mexe; "" = remove. */
  videoArquivo?: string;
  /**
   * Salvar como rascunho (não publicar). Padrão: false = publica direto.
   * Publicar grava status "active" — é o que torna o imóvel visível na busca
   * pública (que filtra status='active'). Rascunho fica "draft" e só aparece
   * no painel do dono.
   */
  asDraft?: boolean;
  /** Aceite do termo de IA (obrigatório ao publicar; validado e gravado no servidor). */
  aceiteIa?: unknown;
  /**
   * Prompt 59: chaves do padrão mínimo de conforto que o dono marcou (gravadas no servidor antes do portão).
   * 59-C1: só vale com `confortoMexido: true` (o dono mexeu no checklist nesta sessão, depois de carregar o que já
   * estava salvo). Ausente = não mexe; nunca desmarca por omissão.
   */
  confortoConfirmados?: string[];
  confortoMexido?: boolean;
  // ── Enriquecimento (FASE 1/2) — gravados best-effort (requer migrações 0018/0019) ──
  parkingSpots?: number;
  condoFee?: number;
  descricaoGeradaPorIa?: boolean;
  availableFrom?: string;
  availableUntil?: string;
  maxPeriodDays?: number;
  furnished?: boolean;
  petsAllowed?: boolean;
  /** Regras de pets do proprietário (validadas no servidor; requer migração 0119). */
  petsRegras?: unknown;
  /** Pacote de limpeza durante a estadia; validado no servidor (0144). */
  limpezaEstadia?: unknown;
  /**
   * Rua, número e complemento (complemento do prompt 23): vão para a coluna RESTRITA exact_address (nunca pública;
   * lida só pelo dono, admin, inquilino aceito e o morador de visita presencial confirmada). Vazio = não mexe.
   */
  enderecoExato?: string;
  /** Negociação pública do anúncio (0152), validada em lib/anuncio/negociacao. */
  negociacao?: unknown;
  /** Limites PRIVADOS da negociação (0152): só o dono lê; nunca vão ao anúncio. */
  limitesNegociacao?: unknown;
  /** Velocidade da internet informada (Mbps), opcional (0152). */
  internetMbps?: unknown;
  smokingAllowed?: boolean;
  childrenAllowed?: boolean;
  /** 61-B (0225): tipo de entrada (público), mensagem a quem vai pedir e "o que considerar antes de pedir". */
  tipoEntrada?: string | null;
  mensagemParaPedido?: string | null;
  considerarAntes?: string[];
  considerarAntesTexto?: string | null;
  maxGuests?: number;
  /** Chaves de comodidade selecionadas (catálogo único). */
  amenityKeys?: string[];
  /** Proximidades Google curadas (só place_id + categoria + rótulo). */
  googlePlaces?: { placeId: string; categoria: string; rotulo?: string }[];
  /** Proximidades manuais (nome + distância digitados). */
  proximities?: { category: string; name: string; note?: string }[];
}

/**
 * Grava a declaração de privacidade/acesso (0116) em UPDATE à parte, como os
 * demais campos extras: sem a migração o erro é só logado (e a prontidão não
 * barra, pois a coluna não existe). Valida a forma no servidor.
 */
async function gravarPrivacidade(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ownerId: string,
  id: string,
  input: PropertyInput
): Promise<void> {
  if (input.semCamerasInterior === undefined) return;
  try {
    const { error } = await supabase
      .from("properties")
      .update(
        colunasPrivacidade({
          semCamerasInterior: input.semCamerasInterior,
          camerasExternas: input.camerasExternas,
          tipoAcesso: input.tipoAcesso as TipoAcesso | null | undefined,
          senhaTrocadaEstadia: input.senhaTrocadaEstadia,
        })
      )
      .eq("id", id)
      .eq("owner_id", ownerId);
    if (error) console.error("[gravarPrivacidade]", error.code, error.message);
  } catch (e) {
    console.error("[gravarPrivacidade] erro:", e);
  }
}

/**
 * 61-B: tipo de entrada, mensagem a quem vai pedir e "o que considerar" em UPDATE à parte (como a privacidade): sem a
 * 0225 o erro é só logado. A forma já foi validada por colunasChegadaEPedido antes de gravar o resto.
 */
async function gravarChegadaEPedido(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ownerId: string,
  id: string,
  entrada: EntradaChegadaEPedido
): Promise<void> {
  const r = colunasChegadaEPedido(entrada);
  if (!r.ok || Object.keys(r.colunas).length === 0) return;
  try {
    const { error } = await supabase.from("properties").update(r.colunas).eq("id", id).eq("owner_id", ownerId);
    if (error) console.error("[gravarChegadaEPedido]", error.code, error.message);
  } catch (e) {
    console.error("[gravarChegadaEPedido] erro:", e);
  }
}

/**
 * Trava de cidades liberadas (ordem 335b4064): publicar só em cidade liberada. Vale no servidor; rascunho não passa
 * por aqui. Em cidade fechada, grava o interesse do dono e devolve o convite.
 */
async function cidadeFechada(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  userId: string,
  cidade: string,
): Promise<string | null> {
  const msg = await bloqueioPorCidade(supabase, cidade);
  if (msg) await anotarInteresseDoDono(supabase, userId, cidade, MUNICIPIOS);
  return msg;
}

/**
 * Portão final do Publicar: a MESMA prontidão de Meus imóveis, Visão geral, FAQ
 * e Viva (lib/anuncio/prontidao), lida do banco depois de salvar. Só os itens
 * obrigatórios barram; selo, vídeo e demais opcionais nunca.
 */
async function faltaParaPublicar(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ownerId: string,
  id: string
): Promise<string | null> {
  const pr = await prontidaoDoImovel(supabase, ownerId, id);
  if (!pr) return "Imóvel não encontrado.";
  if (pr.podePublicar) return null;
  return `Ainda falta para publicar: ${pr.faltam.join("; ")}.`;
}

/**
 * Publicar exige o termo de IA aceito (ordem 04e2fe5e, item 5): valida a forma e
 * grava o aceite do PRÓPRIO dono (a RLS confere o dono do imóvel). Devolve o
 * texto do erro, ou null quando está tudo certo.
 */
async function exigirAceiteIa(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  propertyId: string,
  aceiteIa: unknown,
): Promise<string | null> {
  const v = validarAceiteIa(aceiteIa);
  if (!v.ok) return "Marque a confirmação de que você revisou o anúncio para publicar.";
  const { error } = await supabase.from("anuncio_aceites_ia").insert({
    property_id: propertyId,
    versao_termo: v.aceite.versao,
    campos_gerados_ia: v.aceite.camposGeradosIa,
    campos_editados: v.aceite.camposEditados,
  });
  return error ? "Não foi possível registrar a sua confirmação. Tente novamente." : null;
}

/**
 * Negociação (pública), limites privados e velocidade da internet (0152) — prompt 10 + prompt 17 §8. Best-effort:
 * sem a migração aplicada o cadastro segue igual. Os limites ficam numa tabela só do dono (RLS) e nunca vão ao anúncio.
 */
async function gravarNegociacao(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ownerId: string,
  id: string,
  input: PropertyInput,
): Promise<void> {
  if ("negociacao" in input || "internetMbps" in input) {
    try {
      const campos: Record<string, unknown> = {};
      if ("negociacao" in input) campos.negociacao = normalizarNegociacao(input.negociacao);
      if ("internetMbps" in input) campos.internet_mbps = mbpsValido(input.internetMbps);
      await supabase.from("properties").update(campos).eq("id", id).eq("owner_id", ownerId);
    } catch {
      /* migração 0152 ausente */
    }
  }
  if ("limitesNegociacao" in input) {
    try {
      const l = normalizarLimites(input.limitesNegociacao);
      if (l.valorMinimo === null && l.limpezasMax === null) {
        await supabase.from("property_negociacao_limites").delete().eq("property_id", id).eq("owner_id", ownerId);
      } else {
        await supabase.from("property_negociacao_limites").upsert({
          property_id: id,
          owner_id: ownerId,
          valor_minimo: l.valorMinimo,
          limpezas_max: l.limpezasMax,
          atualizado_em: new Date().toISOString(),
        });
      }
    } catch {
      /* migração 0152 ausente */
    }
  }
}

/**
 * Grava só os limites PRIVADOS da negociação de um rascunho do próprio dono (o autosave não os põe no JSON do
 * rascunho, para nunca irem a uma coluna legível por outros).
 */
export async function salvarLimitesNegociacao(id: string, limites: unknown): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  if (!UUID_RE.test(id)) return { ok: false, error: "Imóvel inválido." };
  await gravarNegociacao(supabase, user.id, id, { limitesNegociacao: limites } as PropertyInput);
  return { ok: true };
}

/** Limites privados da negociação de um imóvel do PRÓPRIO dono (para o cadastro abrir preenchido). */
export async function carregarLimitesNegociacao(id: string): Promise<{ valorMinimo: number | null; limpezasMax: number | null }> {
  const vazio = { valorMinimo: null, limpezasMax: null };
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(id)) return vazio;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return vazio;
  try {
    const { data } = await supabase
      .from("property_negociacao_limites")
      .select("valor_minimo, limpezas_max")
      .eq("property_id", id)
      .eq("owner_id", user.id)
      .maybeSingle();
    return normalizarLimites({ valorMinimo: data?.valor_minimo, limpezasMax: data?.limpezas_max });
  } catch {
    return vazio;
  }
}

export async function createProperty(input: PropertyInput): Promise<ActionResult> {
  // Tour em vídeo (ordem 6f964617): só YouTube/Vimeo em https, validado no servidor.
  if (input.videoUrl?.trim() && !videoTourPermitido(input.videoUrl)) {
    return { ok: false, error: "O vídeo precisa ser um link do YouTube ou do Vimeo." };
  }
  const chegada = colunasChegadaEPedido(input);
  if (!chegada.ok) return { ok: false, error: chegada.erro };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  // F45: publicar exige perfil de proprietário completo (nome e telefone) — checado
  // aqui no servidor; a conta pode ser dona e inquilina, então a tela só avisa.
  if (!input.asDraft) {
    const { data: perfil } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
    if (!perfilDonoCompleto(perfil as { full_name: string | null; phone: string | null } | null)) {
      return { ok: false, error: MSG_PERFIL_DONO_INCOMPLETO };
    }
    const fechada = await cidadeFechada(supabase, user.id, input.city);
    if (fechada) return { ok: false, error: `${fechada} Você pode salvar como rascunho.` };
  }

  // Portão anti-fraude NO SERVIDOR (item 1): publicar (status active) exige a
  // última qualificação com documento APROVADO. Rascunho passa. Enforcement real
  // — o gate do cliente é só UX. A3: vale sempre que NÃO for rascunho (antes só
  // com asDraft === false, e omitir o campo publicava sem aprovação). O banco
  // reforça a mesma regra (0056).
  // Qualificação POR IMÓVEL: a que está à espera (sem imóvel) é ligada a este
  // imóvel novo. Publicar exige que ELA tenha o documento aprovado.
  const qualificacao = await qualificacaoDoImovel(supabase, user.id, null);
  if (!input.asDraft && (qualificacao?.document_status ?? "none") !== "approved") {
    return {
      ok: false,
      error: "Documentação do imóvel ainda não aprovada. Salve como rascunho — a publicação libera após a verificação.",
    };
  }

  // Limite de anúncios ATIVOS do plano (rascunho e pausado não contam). Só
  // pesa quando o anúncio vai ser publicado agora.
  if (!input.asDraft) {
    const limite = await limiteDePublicacao(supabase, user.id, null);
    if (limite) return { ok: false, error: limite };
  }

  const { data, error } = await supabase
    .from("properties")
    .insert({
      owner_id: user.id,
      title: input.title,
      description: input.description,
      property_type: input.propertyType,
      city: input.city,
      address: input.neighborhood,
      ...colunaEnderecoExato(input.enderecoExato),
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      area_m2: input.areaM2,
      min_period_days: input.minPeriodDays,
      monthly_price: input.monthlyPrice,
      ...colunaAirbnb(input.airbnbMonthlyPrice),
      // Nasce rascunho: a qualificação é ligada logo abaixo e só então o
      // imóvel é publicado (o banco confere o documento DESTE imóvel — 0060).
      status: "draft",
      ready_to_live_score: input.readyToLiveScore,
      ready_to_live_badge: input.readyToLiveScore >= 70,
      tag_home_office: input.tagHomeOffice ?? false,
      tag_work_located: input.tagWorkLocated ?? false,
      tag_condo_approved: input.tagCondoApproved ?? false,
      ...colunasDeOperacao(input.ownershipType, input.subleaseAuthorized),
      // Só um arquivo da PASTA DO DONO no bucket privado (nunca link externo/preview local).
      sublease_doc_url: caminhoDoDono(input.subleaseDocUrl, user.id) ? input.subleaseDocUrl! : null,
      utilities_mode: input.utilitiesMode ?? "fixed",
      utilities_estimate: input.utilitiesEstimate ?? 0,
      issues_invoice: input.issuesInvoice ?? false,
      accepts_insurance: input.acceptsInsurance ?? false,
      garantias_aceitas: input.garantiasAceitas ?? [],
      prep_fee: input.prepFee ?? 0,
      video_url: input.videoUrl?.trim() || null,
      ...colunaVideoArquivo(input.videoArquivo, user.id),
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: erroBancoPT(error) };

  // Enriquecimento (campos das migrações 0018/0019). Best-effort: se a migração
  // ainda não rodou, o update falha em silêncio mas o imóvel já foi criado.
  try {
    await supabase
      .from("properties")
      .update({
        parking_spots: input.parkingSpots ?? 0,
        condo_fee: input.condoFee ?? 0,
        descricao_gerada_por_ia: input.descricaoGeradaPorIa ?? false,
        available_from: input.availableFrom ?? null,
        available_until: input.availableUntil ?? null,
        max_period_days: input.maxPeriodDays ?? null,
        furnished: input.furnished ?? true,
        pets_allowed: input.petsAllowed ?? null,
        smoking_allowed: input.smokingAllowed ?? false,
        children_allowed: input.childrenAllowed ?? null,
        max_guests: input.maxGuests ?? null,
        faixas_aceitas: input.faixasAceitas ?? [],
        google_places: (input.googlePlaces ?? []).map((g) => ({
          place_id: g.placeId,
          categoria: g.categoria,
          rotulo: g.rotulo,
        })),
      })
      .eq("id", data.id);
  } catch {
    /* migração 0018/0019/0020 ausente — segue sem os campos extras */
  }
  await gravarPrivacidade(supabase, user.id, data.id as string, input);
  await gravarChegadaEPedido(supabase, user.id, data.id as string, input);

  // Comodidades por categoria (catálogo único). Best-effort.
  if (input.amenityKeys && input.amenityKeys.length > 0) {
    const rows = amenityRows(input.amenityKeys);
    if (rows.length > 0) {
      try {
        await supabase.from("property_amenities").insert(
          rows.map((r, i) => ({
            property_id: data.id,
            category: r.category,
            label: r.label,
            sort_order: i,
          }))
        );
      } catch {
        /* tabela ausente — segue sem comodidades */
      }
    }
  }

  // Proximidades manuais (nome + distância). Best-effort.
  if (input.proximities && input.proximities.length > 0) {
    try {
      await supabase.from("property_proximities").insert(
        input.proximities.map((p, i) => ({
          property_id: data.id,
          category: p.category,
          name: p.name,
          note: p.note ?? null,
          sort_order: i,
        }))
      );
    } catch {
      /* tabela ausente — segue sem proximidades */
    }
  }

  // Persiste as fotos enviadas ao Storage (a primeira é a capa). Ignora URLs
  // não persistentes (blob: do modo demo, ou upload que falhou) para não gravar
  // imagem quebrada. Best-effort: uma falha aqui não derruba o cadastro base.
  const persistableUrls = fotosDoDono(input.photoUrls ?? [], user.id);
  if (persistableUrls.length > 0) {
    try {
      const { error } = await supabase.from("property_photos").insert(
        persistableUrls.map((url, i) => ({
          property_id: data.id,
          url,
          sort_order: i,
        }))
      );
      if (error) console.error("[createProperty] falha ao gravar fotos:", error.message);
      else await ligarHashesAoImovel(createAdminClient(), data.id, persistableUrls);
    } catch (e) {
      console.error("[createProperty] erro ao gravar fotos:", e);
    }
  }

  // Mapeia espaços de trabalho próximos (Google Places) — sustenta o selo de trabalho.
  if (typeof input.lat === "number" && typeof input.lng === "number") {
    const spaces = await findNearbyWorkspaces({ lat: input.lat, lng: input.lng });
    if (spaces.length > 0) {
      await supabase.from("property_workspaces").insert(
        spaces.map((w) => ({
          property_id: data.id,
          name: w.name,
          type: w.type,
          distance_m: w.distanceM,
        }))
      );
    }
  }

  // Liga a qualificação à espera a ESTE imóvel e aplica o status pedido (o
  // trigger copia selos/etiquetas dela e confere o documento ao publicar).
  if (qualificacao) {
    await supabase
      .from("qualification_checklists")
      .update({ property_id: data.id })
      .eq("id", qualificacao.id)
      .eq("owner_id", user.id)
      .is("property_id", null);
  }
  const confortoNovo = confortoParaGravar(input.confortoConfirmados, input.confortoMexido);
  if (confortoNovo) {
    // O imóvel acabou de ser criado por este dono (a RLS conferiu): o servidor grava a confirmação.
    const adm = createAdminClient();
    if (adm) await salvarDeclaracoesConforto(adm, data.id as string, user.id, confortoNovo);
  }
  if (!input.asDraft) {
    const falta = await faltaParaPublicar(supabase, user.id, data.id as string);
    if (falta) return { ok: false, id: data.id, error: `${falta} O anúncio ficou salvo como rascunho.` };
    const semAceite = await exigirAceiteIa(supabase, data.id as string, input.aceiteIa);
    if (semAceite) return { ok: false, id: data.id, error: `${semAceite} O anúncio ficou salvo como rascunho.` };
  }
  const { error: stErr } = await supabase
    .from("properties")
    .update({ status: input.asDraft ? "draft" : "active" })
    .eq("id", data.id);
  if (stErr && !input.asDraft) {
    return {
      ok: false,
      id: data.id,
      error: "O imóvel foi salvo como rascunho, mas não pôde ser publicado: " + erroBancoPT(stErr),
    };
  }
  revalidarAnuncio(data.id as string, revalidatePath);
  // Publicado agora: avisa os pedidos ativos que ele atende (dono e inquilino).
  if (!input.asDraft) {
    try {
      await avisarPedidosDoImovel(data.id as string);
      await avisarBuscasDoImovel(data.id as string);
    } catch {
      /* best-effort */
    }
  }

  await gravarNegociacao(supabase, user.id, data.id, input);
  return { ok: true, id: data.id };
}

/** Carrega um imóvel do dono para edição (prefill do wizard). Serializável. */
export async function loadPropertyForEdit(id: string): Promise<Property | null> {
  const p = await getPropertyForOwner(id);
  return p ?? null;
}

/**
 * Atualiza um imóvel existente (edição). Espelha os campos de createProperty,
 * mas em UPDATE (escopo do dono via RLS) e re-sincroniza as tabelas filhas
 * (comodidades, proximidades, fotos) apagando e regravando. Best-effort nas
 * tabelas de enriquecimento — migração ausente não derruba a edição base.
 */
export async function updateProperty(id: string, input: PropertyInput): Promise<ActionResult> {
  if (!periodoDisponivelValido(input.availableFrom, input.availableUntil)) {
    return { ok: false, error: MSG_DISPONIVEL_ATE_ANTES };
  }
  // Tour em vídeo (ordem 6f964617): só YouTube/Vimeo em https, validado no servidor.
  if (input.videoUrl?.trim() && !videoTourPermitido(input.videoUrl)) {
    return { ok: false, error: "O vídeo precisa ser um link do YouTube ou do Vimeo." };
  }
  const chegada = colunasChegadaEPedido(input);
  if (!chegada.ok) return { ok: false, error: chegada.erro };
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  if (!UUID_RE.test(id)) return { ok: false, error: "Imóvel inválido para edição." };

  // F45: publicar exige perfil de proprietário completo (nome e telefone) — checado
  // aqui no servidor; a conta pode ser dona e inquilina, então a tela só avisa.
  if (input.asDraft === false) {
    const { data: perfil } = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
    if (!perfilDonoCompleto(perfil as { full_name: string | null; phone: string | null } | null)) {
      return { ok: false, error: MSG_PERFIL_DONO_INCOMPLETO };
    }
  }

  // A3: (re)publicar exige o documento APROVADO — o mesmo portão do createProperty
  // (antes a edição publicava sem checar). O banco reforça (0056).
  if (input.asDraft === false) {
    // Documento DESTE imóvel (não o último do dono).
    const q = await qualificacaoDoImovel(supabase, user.id, id);
    if ((q?.document_status ?? "none") !== "approved") {
      return {
        ok: false,
        error: "Documentação do imóvel ainda não aprovada. Salve como rascunho — a publicação libera após a verificação.",
      };
    }
  }

  // Publicar conta no limite de anúncios ATIVOS do plano (antes a edição
  // publicava sem checar).
  if (input.asDraft === false) {
    const limite = await limiteDePublicacao(supabase, user.id, id);
    if (limite) return { ok: false, error: limite };
  }

  // Status ANTES da edição: só a PUBLICAÇÃO (rascunho/pausado → ativo) avisa
  // os pedidos compatíveis — editar um anúncio já ativo não reenvia avisos.
  const { data: antes } = await supabase.from("properties").select("status, owner_id").eq("id", id).maybeSingle();

  // Fotos ANTES do status: o banco só deixa publicar com 8 fotos gravadas em
  // property_photos (0009). Antes elas eram regravadas DEPOIS da mudança para
  // 'active', e o rascunho (fotos só no draft_data) nunca publicava.
  await sincronizarFotos(supabase, id, user.id, input.photoUrls ?? []);

  const { error } = await supabase
    .from("properties")
    .update({
      title: input.title,
      description: input.description,
      property_type: input.propertyType,
      city: input.city,
      address: input.neighborhood,
      ...colunaEnderecoExato(input.enderecoExato),
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      bedrooms: input.bedrooms,
      bathrooms: input.bathrooms,
      area_m2: input.areaM2,
      min_period_days: input.minPeriodDays,
      monthly_price: input.monthlyPrice,
      ...colunaAirbnb(input.airbnbMonthlyPrice),
      ready_to_live_score: input.readyToLiveScore,
      ready_to_live_badge: input.readyToLiveScore >= 70,
      tag_home_office: input.tagHomeOffice ?? false,
      tag_work_located: input.tagWorkLocated ?? false,
      tag_condo_approved: input.tagCondoApproved ?? false,
      ...colunasDeOperacao(input.ownershipType, input.subleaseAuthorized),
      // Só grava o documento da operação quando o dono enviou um nesta edição.
      // A edição não recarrega esse campo — mandar null por ausência APAGAVA o
      // documento a cada edição (mesmo padrão do risco do endereço).
      ...(caminhoDoDono(input.subleaseDocUrl, user.id) ? { sublease_doc_url: input.subleaseDocUrl } : {}),
      utilities_mode: input.utilitiesMode ?? "fixed",
      utilities_estimate: input.utilitiesEstimate ?? 0,
      issues_invoice: input.issuesInvoice ?? false,
      accepts_insurance: input.acceptsInsurance ?? false,
      garantias_aceitas: input.garantiasAceitas ?? [],
      prep_fee: input.prepFee ?? 0,
      video_url: input.videoUrl?.trim() || null,
      ...colunaVideoArquivo(input.videoArquivo, user.id),
    })
    .eq("id", id)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: erroBancoPT(error) };
  // Editou preço/fotos/dados: a página pública refaz já, mesmo se a publicação abaixo falhar.
  revalidarAnuncio(id, revalidatePath);

  // Enriquecimento (best-effort — requer migrações 0018/0019/0020).
  try {
    await supabase
      .from("properties")
      .update({
        parking_spots: input.parkingSpots ?? 0,
        condo_fee: input.condoFee ?? 0,
        descricao_gerada_por_ia: input.descricaoGeradaPorIa ?? false,
        available_from: input.availableFrom ?? null,
        available_until: input.availableUntil ?? null,
        max_period_days: input.maxPeriodDays ?? null,
        furnished: input.furnished ?? true,
        pets_allowed: input.petsAllowed ?? null,
        smoking_allowed: input.smokingAllowed ?? false,
        children_allowed: input.childrenAllowed ?? null,
        max_guests: input.maxGuests ?? null,
        faixas_aceitas: input.faixasAceitas ?? [],
        google_places: (input.googlePlaces ?? []).map((g) => ({
          place_id: g.placeId,
          categoria: g.categoria,
          rotulo: g.rotulo,
        })),
      })
      .eq("id", id)
      .eq("owner_id", user.id);
  } catch {
    /* migração ausente — segue sem os campos extras */
  }
  await gravarPrivacidade(supabase, user.id, id, input);
  await gravarChegadaEPedido(supabase, user.id, id, input);

  // Regras de pets (0119): validadas aqui; só vale com "aceita pets" marcado.
  try {
    const regras = input.petsAllowed ? normalizarRegrasPets(input.petsRegras) : null;
    await supabase.from("properties").update({ pets_regras: regras }).eq("id", id).eq("owner_id", user.id);
  } catch {
    /* migração 0119 ausente — segue com o aceite geral */
  }

  // Pacote de limpeza durante a estadia (0144): validado aqui; sem pacote válido grava null.
  if ("limpezaEstadia" in input) {
    try {
      const pacote = normalizarLimpezaEstadia(input.limpezaEstadia);
      await supabase.from("properties").update({ limpeza_estadia: pacote }).eq("id", id).eq("owner_id", user.id);
    } catch {
      /* migração 0144 ausente — segue sem o pacote */
    }
  }

  await gravarNegociacao(supabase, user.id, id, input);

  // Re-sincroniza tabelas filhas: apaga as atuais e regrava as do formulário.
  const resync = async (table: string, rows: Record<string, unknown>[]) => {
    try {
      await supabase.from(table).delete().eq("property_id", id);
      if (rows.length > 0) await supabase.from(table).insert(rows);
    } catch {
      /* tabela ausente — ignora */
    }
  };
  await resync(
    "property_amenities",
    amenityRows(input.amenityKeys ?? []).map((r, i) => ({
      property_id: id,
      category: r.category,
      label: r.label,
      sort_order: i,
    }))
  );
  await resync(
    "property_proximities",
    (input.proximities ?? []).map((p, i) => ({
      property_id: id,
      category: p.category,
      name: p.name,
      note: p.note ?? null,
      sort_order: i,
    }))
  );

  // Só (re)publica se for explicitamente "Publicar"; "Salvar rascunho" não
  // despublica um anúncio já ativo. Publica DEPOIS de salvar tudo e de passar
  // pela prontidão (fonte única). Ao publicar, ZERA o draft_data (ele guarda a
  // rua exata e a linha fica pública — C4/T1).
  const confortoEditado = confortoParaGravar(input.confortoConfirmados, input.confortoMexido);
  if (confortoEditado && antes?.owner_id === user.id) {
    // Só o dono do imóvel: o servidor grava a confirmação do padrão mínimo (Prompt 59).
    const adm = createAdminClient();
    if (adm) await salvarDeclaracoesConforto(adm, id, user.id, confortoEditado);
  }
  if (input.asDraft === false) {
    if (antes?.status !== "active") {
      const fechada = await cidadeFechada(supabase, user.id, input.city);
      if (fechada) return { ok: false, id, error: `${fechada} Suas alterações foram salvas como rascunho.` };
    }
    const falta = await faltaParaPublicar(supabase, user.id, id);
    if (falta) return { ok: false, id, error: `${falta} Suas alterações foram salvas.` };
    if (antes?.status !== "active") {
      const semAceite = await exigirAceiteIa(supabase, id, input.aceiteIa);
      if (semAceite) return { ok: false, id, error: `${semAceite} Suas alterações foram salvas.` };
    }
    const { error: pubErr } = await supabase
      .from("properties")
      .update({ status: "active", draft_data: null })
      .eq("id", id)
      .eq("owner_id", user.id);
    if (pubErr) return { ok: false, id, error: erroBancoPT(pubErr) };
    // Prompt 50: o 1º anúncio publicado ativa o proprietário (1× por papel).
    await registrarAtivacao(user.id, "proprietario");
  }

  // Página pública do anúncio não pode ficar presa em cache (F9).
  revalidarAnuncio(id, revalidatePath);

  if (input.asDraft === false && antes?.status !== "active") {
    try {
      await avisarPedidosDoImovel(id);
      await avisarBuscasDoImovel(id);
    } catch {
      /* best-effort */
    }
    // Cartão do anúncio (cartões compartilháveis, T2): nasce ao publicar e fica em Meus imóveis → Cartão.
    const adm = createAdminClient();
    if (adm) await garantirCartao(adm, { tipo: "ownercard", usuarioId: user.id, propertyId: id }).catch(() => null);
  }

  return { ok: true, id };
}

/** exact_address só quando o formulário mandou a rua (vazio nunca apaga o que já estava gravado). */
function colunaEnderecoExato(v: string | undefined): { exact_address?: string } {
  const t = typeof v === "string" ? v.trim().slice(0, 300) : "";
  return t ? { exact_address: t } : {};
}

/** Adiciona ou remove um imóvel dos favoritos do inquilino. */
export async function toggleFavorite(
  propertyId: string,
  favorite: boolean
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  // Anúncio de exemplo: favorito fica só no aparelho (property_id é uuid).
  if (isExemplo(propertyId)) return { ok: true, demo: true };

  if (favorite) {
    const { error } = await supabase
      .from("favorites")
      .insert({ tenant_id: user.id, property_id: propertyId });
    if (error && error.code !== "23505") return { ok: false, error: erroBancoPT(error) };
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("tenant_id", user.id)
      .eq("property_id", propertyId);
    if (error) return { ok: false, error: erroBancoPT(error) };
  }
  return { ok: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LocacaoInput {
  propertyId: string;
  faixa: string; // temporada | media_estadia | longa
  modeloContratoId?: string | null;
  periodoDias: number;
  valorTotal: number; // aluguel × meses (base da caução)
  caucaoValor: number; // 50% do valor total (Onda 1)
  garantia: string; // caucao_avista | caucao_parcelada | seguro_fianca
  qtdOcupantes: number;
  capacidadeSnapshot?: number | null;
}

/**
 * Registra a locação (Onda 1) na tabela `locacoes` ao fechar o contrato: nº de
 * ocupantes (cláusula de ocupação), caução (50% do total), garantia, faixa e o
 * modelo de contrato selecionado. Best-effort: em modo demo (sem Supabase),
 * imóvel não-UUID (exemplos) ou visitante sem sessão, é no-op — não grava nada.
 */
export async function registrarLocacao(input: LocacaoInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login para registrar a locação." };
  // Imóvel de exemplo (id textual) ou fluxo mock → não persiste.
  if (!UUID_RE.test(input.propertyId)) return { ok: true, demo: true };
  const { data, error } = await supabase
    .from("locacoes")
    .insert({
      property_id: input.propertyId,
      tenant_id: user.id,
      faixa: input.faixa,
      modelo_contrato_id: input.modeloContratoId ?? null,
      periodo_dias: Math.round(input.periodoDias),
      valor_total: input.valorTotal,
      caucao_valor: input.caucaoValor,
      garantia: input.garantia,
      qtd_ocupantes: Math.round(input.qtdOcupantes),
      capacidade_snapshot: input.capacidadeSnapshot ?? null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true, id: data?.id };
}

// ── Contrato fracionado em blocos (v2) ───────────────────────────────────────

export interface ContratoInput {
  /** Candidatura ACEITA de onde o contrato nasce (inquilino, imóvel, aluguel e taxa vêm dela). */
  leadId: string;
  faixa: string; // temporada | media_estadia | longa
  prazoTotalMeses: number; // prazo total pretendido (contrato-mãe)
  tamanhoBlocoMeses?: number; // padrão 2 (≤ 3 = 90 dias)
  qtdOcupantes: number;
  capacidadeSnapshot?: number | null;
  inicioISO: string; // data de início do 1º bloco (yyyy-mm-dd)
  caucaoForma?: "avista" | "preauth_cartao";
  /** Garantia ÚNICA escolhida (art. 37). Padrão: caução. Seguro-fiança → blocos sem caução. */
  garantia?: GarantiaContrato;
}

const FAIXAS_CONTRATO = new Set(["temporada", "media_estadia", "longa"]);

/**
 * Registra o CONTRATO-MÃE + seus BLOCOS no fechamento. A comissão (taxa congelada ×
 * valor total do contrato = aluguel × meses, UMA vez) fica no contrato-mãe; a renovação é outro fechamento.
 * Cada bloco carrega a caução (50% do valor do bloco); a plataforma só calcula e
 * documenta, NUNCA captura o dinheiro (regra de ouro).
 *
 * A6: o contrato nasce da candidatura ACEITA do dono logado — inquilino
 * (tenant_id = o do lead; antes gravava o DONO como inquilino), imóvel, aluguel
 * (do anúncio) e taxa (congelada no aceite) vêm do banco, nunca da tela. Um
 * contrato por candidatura. Gravado pelo servidor (0057 tirou a escrita do
 * usuário em contratos/blocos).
 */
export async function registrarContrato(
  input: ContratoInput
): Promise<ActionResult & { blocos?: number; existente?: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login para registrar o contrato." };
  if (!UUID_RE.test(input.leadId)) return { ok: true, demo: true };

  const { data: lead } = await supabase
    .from("leads")
    .select("id, owner_id, tenant_id, property_id")
    .eq("id", input.leadId)
    .eq("owner_id", user.id)
    .eq("status", "accepted")
    .maybeSingle();
  if (!lead) return { ok: false, error: "Candidatura aceita não encontrada." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };

  const { data: existente } = await admin.from("contratos").select("id").eq("lead_id", lead.id).maybeSingle();
  // Prompt 28: avisa que o contrato JÁ existia (o Resumo mostra "gerado em" e o estado real dele).
  if (existente) return { ok: true, id: existente.id as string, blocos: 0, existente: true };

  // F32: o contrato nasce só com o documento das DUAS partes e os documentos do
  // inquilino — a trava vale aqui no servidor, não só na tela do fechamento.
  const bloqueio = motivoBloqueioContrato({
    dono: await lerDocumento(admin, lead.owner_id as string),
    inquilino: await lerDocumento(admin, lead.tenant_id as string),
    docsInquilinoCompletos: await docsInquilinoCompletos(admin, lead.id as string),
  });
  if (bloqueio) return { ok: false, error: bloqueio.erro };

  const { data: imovel } = await admin
    .from("properties")
    .select("monthly_price, owner_id")
    .eq("id", lead.property_id)
    .maybeSingle();
  // Prompt 17: com proposta aceita, o contrato usa o valor mensal e os meses ACORDADOS (não os do anúncio/tela).
  const acordada = await propostaAcordadaDoLead(admin, lead.id as string);
  const aluguel = acordada ? acordada.valorMensal : Number(imovel?.monthly_price);
  if (!imovel || imovel.owner_id !== user.id || !(aluguel > 0)) {
    return { ok: false, error: "Imóvel sem valor de aluguel." };
  }

  const prazo = acordada ? acordada.meses : Math.round(Number(input.prazoTotalMeses));
  if (!(prazo >= PRAZO_MIN_MESES && prazo <= PRAZO_MAX_MESES))
    return { ok: false, error: `Prazo inválido (${PRAZO_MIN_MESES} a ${PRAZO_MAX_MESES} meses, até ${PRAZO_MAX_DIAS} dias).` };
  if (!FAIXAS_CONTRATO.has(input.faixa)) return { ok: false, error: "Faixa de prazo inválida." };
  const ocupantes = Math.round(Number(input.qtdOcupantes));
  if (!(ocupantes >= 1 && ocupantes <= 20)) return { ok: false, error: "Número de ocupantes inválido." };
  // F37: data de início obrigatória, hoje ou futura (os blocos e os prazos partem dela).
  const inicio = validarInicioEstadia(input.inicioISO, hojeBR());
  if (!inicio.ok) return { ok: false, error: inicio.error };

  // Plano e taxa do aceite pelo servidor (a sessão não lê mais essas colunas — 0177); o dono já foi conferido acima.
  const taxaLead = await taxaDoLeadDoDono(admin, user.id, lead.id as string);
  const plano = taxaLead?.acceptedPlan ?? "free";
  // NULL cai para a taxa do plano no aceite (antes Number(null) = 0 = Gestor).
  const rate = taxaDoContrato(taxaLead?.acceptedCommissionRate ?? null, taxaLead?.acceptedPlan ?? null);
  const tamanho = Math.min(3, Math.max(1, Math.round(Number(input.tamanhoBlocoMeses ?? MESES_POR_BLOCO_PADRAO))));
  const resumo = resumoContrato(prazo, aluguel, rate, tamanho);
  // Garantia única: o servidor confere a escolha (fiança só ligada e na faixa de prazo).
  const garantia: GarantiaContrato = input.garantia === "seguro_fianca" ? "seguro_fianca" : "caucao";
  const okGarantia = validarGarantia(garantia, resumo.prazoTotalMeses * DIAS_POR_MES);
  if (!okGarantia.ok) return { ok: false, error: okGarantia.error };

  // Disponibilidade por datas (0176): o período inteiro (1º início ao último fim) não pode cruzar outro contrato ativo.
  const comDatas = encadearDatas(input.inicioISO, resumo.blocos);
  const periodo = { inicio: comDatas[0]?.inicio ?? input.inicioISO, fim: comDatas[comDatas.length - 1]?.fim ?? input.inicioISO };
  const conflito = await conflitoNoImovel(admin, lead.property_id as string, periodo);
  if (conflito) return { ok: false, error: conflito };

  const { data: contrato, error: cErr } = await admin
    .from("contratos")
    .insert({
      lead_id: lead.id,
      property_id: lead.property_id,
      tenant_id: lead.tenant_id,
      owner_plan: plano,
      faixa: input.faixa,
      prazo_total_dias: resumo.prazoTotalMeses * DIAS_POR_MES,
      aluguel_mensal: aluguel,
      tamanho_bloco_meses: resumo.tamanhoBlocoMeses,
      comissao_percent: resumo.comissaoPercent,
      comissao_valor: resumo.comissaoValor,
      qtd_ocupantes: ocupantes,
      capacidade_snapshot: input.capacidadeSnapshot ?? null,
      garantia,
      // O período já nasce no contrato: o banco recusa a sobreposição antes dos blocos (o gatilho o mantém depois).
      periodo: `[${periodo.inicio},${periodo.fim}]`,
    })
    .select("id")
    .single();
  if (cErr) {
    // Corrida com outro contrato gravado entre a checagem e o insert: o EXCLUDE da 0176 recusa.
    if (cErr.code === ERRO_SOBREPOSICAO_PG)
      return { ok: false, error: (await conflitoNoImovel(admin, lead.property_id as string, periodo)) ?? "Este imóvel já tem contrato nessas datas. Escolha outra data de entrada." };
    return { ok: false, error: "Não foi possível registrar o contrato." };
  }

  const rows = comDatas.map((b: BlocoComDatas, i) => ({
    contrato_id: contrato!.id,
    numero_bloco: b.numero,
    inicio: b.inicio,
    fim: b.fim,
    meses: b.meses,
    valor: b.valor,
    // Seguro-fiança: nenhuma caução (uma só garantia; o banco também recusa).
    caucao: garantia === "seguro_fianca" ? 0 : b.caucao,
    caucao_forma: input.caucaoForma === "preauth_cartao" ? "preauth_cartao" : "avista",
    // 1º bloco entra vigente; os demais ficam PENDENTES DE ACEITE das duas
    // partes (antes "agendado" — o ciclo diário os ativava sozinho).
    status: i === 0 ? "ativo" : "pendente_aceite",
  }));
  const { error: bErr } = await admin.from("contrato_blocos").insert(rows);
  // Best-effort: o contrato-mãe já existe mesmo se a inserção dos blocos falhar.
  if (acordada) await marcarPropostaEmContrato(admin, lead.id as string).catch(() => {});
  // Prompt 24: o contrato aparece nos dois lados e o inquilino é avisado (na conta de teste, na caixa de teste).
  const contratoNovoId = contrato!.id as string;
  after(async () => {
    try {
      const { data: pessoa } = await admin.auth.admin.getUserById(lead.tenant_id as string);
      await notify({
        event: "contract_status",
        email: pessoa?.user?.email ?? undefined,
        userId: lead.tenant_id as string,
        pushUrl: `/dashboard/locacoes/${contratoNovoId}`,
        subject: ASSUNTOS.contratoPronto,
      });
    } catch {
      /* aviso é best-effort: o contrato já está registrado */
    }
  });
  revalidatePath("/dashboard/contratos");
  revalidatePath("/dashboard/locacoes");
  revalidatePath("/dashboard/candidaturas");
  if (bErr) return { ok: true, id: contrato!.id, blocos: 0, error: erroBancoPT(bErr) };
  return { ok: true, id: contrato!.id, blocos: rows.length };
}

/**
 * Renovação com ACEITE DAS DUAS PARTES (nunca automática — requisito jurídico).
 * Quem chama (proprietário ou inquilino do contrato) dá o SEU aceite ao
 * próximo bloco:
 *  • havendo bloco "pendente_aceite", registra o aceite desta parte; com os
 *    dois aceites o bloco vira "agendado" (e o ciclo diário o ativa na data);
 *  • não havendo, propõe um novo bloco — se couber no teto de 180 dias — já
 *    com o aceite de quem propôs, e avisa a outra parte.
 * Caução do bloco limitada para a soma do contrato não passar de 3 aluguéis
 * (art. 38 §2º). A cobrança da renovação é um fechamento à parte (ordem b3c9d76e). O banco confere tudo de novo (0063).
 */
export async function renovarBloco(
  contratoId: string
): Promise<ActionResult & { numeroBloco?: number; aguardandoOutraParte?: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Faça login para renovar." };
  if (!UUID_RE.test(contratoId)) return { ok: true, demo: true };

  const { data: contrato, error: cErr } = await supabase
    .from("contratos")
    .select("id, property_id, tenant_id, aluguel_mensal, tamanho_bloco_meses, status, garantia")
    .eq("id", contratoId)
    .maybeSingle();
  if (cErr) return { ok: false, error: "Não foi possível ler o contrato." };
  // A leitura acima já passa pela RLS (só as partes do contrato veem).
  if (!contrato) return { ok: false, error: "Contrato não encontrado." };
  if (contrato.status !== "ativo") return { ok: false, error: "Só contratos ativos podem ser renovados." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "Serviço indisponível." };

  const { data: imovel } = await admin
    .from("properties")
    .select("owner_id")
    .eq("id", contrato.property_id)
    .maybeSingle();
  const papel: "proprietario" | "inquilino" | null =
    imovel?.owner_id === user.id ? "proprietario" : contrato.tenant_id === user.id ? "inquilino" : null;
  if (!papel) return { ok: false, error: "Só as partes do contrato podem renovar." };
  const colunaAceite = papel === "proprietario" ? "aceite_proprietario_em" : "aceite_inquilino_em";
  const colunaOutra = papel === "proprietario" ? "aceite_inquilino_em" : "aceite_proprietario_em";

  if (!(await dentroDoLimite(`renovar:${contratoId}:${user.id}`, 3, DIA_SEGUNDOS))) {
    return { ok: false, error: "Muitos pedidos de renovação hoje. Tente amanhã." };
  }

  const { data: blocos } = await admin
    .from("contrato_blocos")
    .select("id, numero_bloco, inicio, fim, caucao, status, aceite_proprietario_em, aceite_inquilino_em")
    .eq("contrato_id", contratoId)
    .order("numero_bloco", { ascending: true });
  const lista = (blocos ?? []) as Record<string, unknown>[];
  const validos = lista.filter((b) => b.status !== "nao_aceito");

  let numero: number;
  let inicio: string;
  let fim: string;
  let aguardando: boolean;

  const pendente = validos.find((b) => b.status === "pendente_aceite");
  if (pendente) {
    // Aceite desta parte num bloco já proposto.
    const outraJaAceitou = !!pendente[colunaOutra];
    const { error } = await admin
      .from("contrato_blocos")
      .update({
        [colunaAceite]: (pendente[colunaAceite] as string | null) ?? new Date().toISOString(),
        ...(outraJaAceitou ? { status: "agendado" } : {}),
      })
      .eq("id", pendente.id as string)
      .eq("status", "pendente_aceite");
    if (error) return { ok: false, error: "Não foi possível registrar o aceite." };
    numero = pendente.numero_bloco as number;
    inicio = pendente.inicio as string;
    fim = pendente.fim as string;
    aguardando = !outraJaAceitou;
  } else {
    // Proposta de um novo bloco (com o aceite de quem propõe).
    const meses = Math.min(MAX_MESES_BLOCO, Math.max(1, Number(contrato.tamanho_bloco_meses) || MESES_POR_BLOCO_PADRAO));
    const diasContratados = validos.reduce(
      (soma, b) => soma + diasInclusivos(b.inicio as string, b.fim as string),
      0
    );
    if (!cabeNoPrazoMaximo(diasContratados, meses)) {
      return {
        ok: false,
        error: `O contrato chegou ao prazo máximo de ${PRAZO_MAX_DIAS} dias. Para continuar, é preciso um novo contrato.`,
      };
    }
    const aluguel = Number(contrato.aluguel_mensal) || 0;
    const valor = aluguel * meses;
    const caucaoExigida = validos.reduce((soma, b) => soma + (Number(b.caucao) || 0), 0);
    const ultimo = validos[validos.length - 1];
    inicio = ultimo ? addDiasISO(ultimo.fim as string, 1) : hojeISO();
    fim = fimInclusivoISO(inicio, meses * DIAS_POR_MES);
    numero = ((lista[lista.length - 1]?.numero_bloco as number | undefined) ?? 0) + 1;
    const { error: bErr } = await admin.from("contrato_blocos").insert({
      contrato_id: contratoId,
      numero_bloco: numero,
      inicio,
      fim,
      meses,
      valor,
      caucao: contrato.garantia === "seguro_fianca" ? 0 : caucaoDoBloco(valor, aluguel, caucaoExigida),
      status: "pendente_aceite",
      [colunaAceite]: new Date().toISOString(),
    });
    if (bErr) {
      // O novo bloco cruzaria o contrato do próximo morador (0176).
      if (bErr.code === ERRO_SOBREPOSICAO_PG)
        return { ok: false, error: (await conflitoNoImovel(admin, contrato.property_id as string, { inicio, fim }, contratoId)) ?? "O imóvel já tem outro contrato nessas datas. Não dá para renovar." };
      return { ok: false, error: "Não foi possível propor a renovação." };
    }
    aguardando = true;
  }

  // Avisa a OUTRA parte (best-effort): precisa do aceite dela, ou a renovação
  // foi confirmada pelos dois.
  try {
    let destino: { email?: string | null; full_name?: string | null } | null = null;
    if (papel === "inquilino") {
      const { data: rpc } = await admin.rpc("owner_notify_contact", { prop_id: contrato.property_id });
      destino = (Array.isArray(rpc) ? rpc[0] : rpc) ?? null;
    } else {
      const { data: inq } = await admin
        .from("profiles")
        .select("email, full_name, notif_email")
        .eq("id", contrato.tenant_id as string)
        .maybeSingle();
      destino = inq && inq.notif_email !== false ? inq : null;
    }
    if (destino?.email) {
      const quem = papel === "inquilino" ? "O inquilino" : "O proprietário";
      await notify({
        event: "contract_status",
        email: destino.email,
        name: destino.full_name ?? undefined,
        pushUrl: "/dashboard/contratos",
        detailsText: aguardando
          ? `${quem} quer renovar a locação: bloco ${numero} (${dataBR(inicio)} a ${dataBR(fim)}). A renovação só vale com o seu aceite — abra Contratos no painel.`
          : `Renovação confirmada pelas duas partes: bloco ${numero} (${dataBR(inicio)} a ${dataBR(fim)}).`,
      });
    }
  } catch {
    /* notificação é best-effort */
  }

  return { ok: true, numeroBloco: numero, aguardandoOutraParte: aguardando };
}

/**
 * Checagem LAZY do ciclo de blocos (roda ao abrir o painel; o pg_cron cobre
 * quando ninguém abre). Executa as transições de estado (encerramento por
 * NÃO-renovação, ativação de blocos vigentes) via a função SQL idempotente
 * `avancar_ciclo_blocos`. Best-effort e no-op em demo.
 */
export async function varrerCicloBlocos(): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };
  // A rotina saiu da API (0070): roda pelo servidor.
  const admin = createAdminClient();
  if (!admin) return { ok: true };
  const { error } = await admin.rpc("avancar_ciclo_blocos");
  if (error) return { ok: false, error: erroBancoPT(error) };
  return { ok: true };
}

/** Data de hoje em ISO (yyyy-mm-dd) — isolada para manter as regras testáveis. */
function hojeISO(): string {
  return hojeBR();
}

/**
 * Registra o interesse de um inquilino (dúvida, visita ou candidatura) e AVISA
 * o proprietário por e-mail/WhatsApp — o canal real do funil.
 *
 * O dono é o owner_id da linha do imóvel; grava o lead + abre a conversa.
 * Anúncio de EXEMPLO (id não-uuid) é recusado (`exemplo`): não tem dono e nada
 * é enviado a ninguém (T9). Retorna `needsAuth` se o visitante não estiver
 * logado e `selfOwned` se for o próprio dono abrindo o anúncio.
 */
// Anti-flood: teto de contatos que um inquilino dispara por hora (mesmo espírito
// do IA_LIMITE_DIA). 20 cobre o uso legítimo — o inquilino interessado contata
// vários imóveis — e corta scripts de spam de notificação ao proprietário.
const LEAD_LIMITE_HORA = 20;

export async function requestLead(
  propertyId: string,
  // Ignorado: o título vem do BANCO. O que o navegador manda não entra no
  // e-mail oficial (dava para enviar um título com link de golpe).
  _tituloDoCliente: string,
  kind: LeadKind,
  note?: string,
  // F37: data de entrada que o inquilino quer (opcional). Só a candidatura guarda; o servidor valida.
  inicioDesejado?: string,
  // Motivo da estadia (chave de MOTIVOS). Vazio na candidatura = usa o do perfil. Inválido é ignorado.
  motivoEstadia?: string,
  // Prompt 8: quantas pessoas vão morar (opcional). O servidor confere com a capacidade do imóvel.
  qtdOcupantes?: number
): Promise<ActionResult & { needsAuth?: boolean; selfOwned?: boolean; exemplo?: boolean }> {
  // T9: anúncio de EXEMPLO não tem dono — nada de candidatura, contato nem e-mail
  // (antes ia o nome do inquilino para um e-mail pessoal de fallback).
  if (isExemplo(propertyId)) return { ok: false, exemplo: true, error: EXEMPLO_SEM_CONTATO };

  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, needsAuth: true, error: "Entre para falar com o proprietário." };

  // Dono do imóvel: owner_id da linha; contato só pela RPC (service role).
  let ownerId: string | null = null;
  let ownerEmail: string | null = null;
  let ownerPhone: string | null = null;
  let ownerName: string | null = null;
  let propertyTitle = "seu imóvel";
  let capacidadeImovel: number | null = null;
  {
    const { data: prop } = await supabase
      .from("properties")
      .select("owner_id, title, max_guests")
      .eq("id", propertyId)
      .maybeSingle();
    ownerId = (prop?.owner_id as string | undefined) ?? null;
    capacidadeImovel = (prop?.max_guests as number | null | undefined) ?? null;
    propertyTitle = ((prop?.title as string | undefined) ?? "").trim() || propertyTitle;
    if (ownerId) {
      // A RLS de `profiles` ("perfil próprio") bloqueia a sessão do inquilino de
      // ler o contato do dono. A RPC SECURITY DEFINER `owner_notify_contact`
      // (migração 0023) devolve o contato do dono de um anúncio ATIVO só para a
      // notificação. Enquanto a migração não roda, o erro cai no fallback abaixo.
      // C3: RPC de contato (PII) só via service role no servidor (não mais pela sessão).
      const admin = createAdminClient();
      const { data: rpc } = admin
        ? await admin.rpc("owner_notify_contact", { prop_id: propertyId })
        : { data: null };
      const o = Array.isArray(rpc) ? rpc[0] : rpc;
      ownerEmail = o?.email ?? null;
      ownerPhone = o?.phone ?? null;
      ownerName = o?.full_name ?? null;
    }
  }
  if (!ownerId) return { ok: false, error: "Imóvel não encontrado ou indisponível." };
  // T9: sem e-mail do dono (RPC falhou/sem service role) NÃO há desvio para outro
  // endereço — o aviso segue por push (userId) e fica o registro no log.
  if (!ownerEmail) console.warn("[requestLead] sem e-mail do proprietário; aviso só por push", propertyId);

  const ocupantes = kind === "candidatura" ? validarOcupantes(qtdOcupantes, capacidadeImovel) : ({ ok: true, valor: null } as const);
  if (!ocupantes.ok) return { ok: false, error: ocupantes.erro };

  // O próprio dono abrindo seu anúncio: não gera lead para si mesmo.
  if (ownerId && ownerId === user.id) return { ok: true, selfOwned: true };

  // Identidade do interessado (perfil próprio — permitido pela RLS).
  // Só o nome: o aviso ao dono mostra o PRIMEIRO nome (contato nunca sai).
  const { data: me } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const tenantName = me?.full_name ?? "Interessado";

  // Anti-flood: conta os leads REAIS do inquilino na última hora. Protege o
  // proprietário de spam de notificação e o custo de e-mail/WhatsApp. Cliques
  // repetidos no MESMO imóvel já são deduplicados abaixo (não contam), então o
  // teto mira a largura — muitos imóveis distintos em pouco tempo.
  {
    const desdeUmaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", user.id)
      .gte("created_at", desdeUmaHora);
    if ((count ?? 0) >= LEAD_LIMITE_HORA) {
      return {
        ok: false,
        error: "Você atingiu o limite de contatos por hora. Tente novamente em instantes.",
      };
    }
  }

  // Contato novo? Só notifica o dono quando há de fato um lead novo — clique
  // repetido no mesmo imóvel não re-notifica. Exceção: candidatura sempre
  // notifica (evento de maior valor no piloto); o teto de 20/h barra a
  // repetição. Distinguir "1ª candidatura" de "candidatura repetida" exigiria
  // registrar o kind no lead (migração) — hoje o lead é único por (imóvel,
  // inquilino) e o status 'new' não codifica o kind.
  let novoContato = true;

  // Imóvel real: grava lead + abre conversa. Dedup por (imóvel, interessado)
  // para que cliques repetidos não criem leads/mensagens duplicados.
  {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("property_id", propertyId)
      .eq("tenant_id", user.id)
      .maybeSingle();
    novoContato = !existing;
    if (!existing) {
      // Motivo da candidatura: o escolhido (validado no servidor) ou, sem escolha, o do perfil.
      let motivoLead: string | null = null;
      if (kind === "candidatura") {
        const escolhido = validarMotivoEstadia(motivoEstadia ?? "");
        motivoLead = escolhido.ok ? escolhido.valor : null;
        if (!motivoLead) {
          const { data: perfil } = await supabase.from("profiles").select("motivo_estadia").eq("id", user.id).maybeSingle();
          const doPerfil = validarMotivoEstadia((perfil?.motivo_estadia as string | null) ?? "");
          motivoLead = doPerfil.ok ? doPerfil.valor : null;
        }
      }
      const { error: leadErr } = await supabase
        .from("leads")
        .insert({
          property_id: propertyId,
          owner_id: ownerId,
          tenant_id: user.id,
          status: "new",
          ...(kind === "candidatura" && validarInicioEstadia(inicioDesejado, hojeBR()).ok
            ? { inicio_desejado: inicioDesejado!.trim() }
            : {}),
          ...(motivoLead ? { motivo_estadia: motivoLead } : {}),
          ...(ocupantes.valor ? { qtd_ocupantes: ocupantes.valor } : {}),
        });
      // 23505 = duplicado (corrida): não é erro real. Demais erros: registra.
      if (leadErr && leadErr.code !== "23505") {
        console.error("[requestLead] falha ao gravar lead:", leadErr.message);
      }
      // Cartões compartilháveis: a visita veio de um QR/link assinado deste imóvel? O lead guarda a atribuição.
      if (!leadErr) {
        const adm = createAdminClient();
        if (adm) await atribuirLead(adm, { propertyId, tenantId: user.id, cookieValor: (await cookies()).get(REF_COOKIE)?.value }).catch(() => false);
        // Prompt 50: o 1º pedido enviado ativa o morador (1× por papel).
        await registrarAtivacao(user.id, "morador", new Date(), adm);
      }
      const conversationId = idConversa(user.id, ownerId, propertyId);
      // Mensagem do inquilino: usa o texto que ele escreveu (dúvida/horários),
      // com contato mascarado (regra de ouro — nada de telefone/e-mail no chat
      // antes do aceite); sem texto, cai na mensagem padrão da ação.
      const corpo = note && note.trim()
        ? guardContactInfo(note.trim().slice(0, 1000)).text
        : LEAD_KIND_MSG[kind](propertyTitle);
      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        receiver_id: ownerId,
        property_id: propertyId,
        body: corpo,
      });
      if (msgErr) {
        console.error("[requestLead] falha ao abrir conversa:", msgErr.code, msgErr.message);
      }
    }
  }

  // Marca "Você já contatou" (ordem 8302024d): dúvida, visita ou candidatura. Best-effort.
  await gravarMarca(supabase, user.id, propertyId, "contatado_em");

  // Notifica o dono só em contato NOVO — ou sempre que for candidatura (evento
  // de maior valor; o teto de 20/h barra repetição). É isto que faz os botões
  // funcionarem de verdade: o lead chega ao e-mail/WhatsApp do proprietário.
  if (novoContato || kind === "candidatura") {
    const { detailsHtml, detailsText } = buildLeadNotification(kind, propertyTitle, {
      name: tenantName,
    });
    await notify({
      // Prompt 23: candidatura tem e-mail próprio ("Nova candidatura no seu imóvel"); dúvida/visita seguem como interessado.
      event: kind === "candidatura" ? "candidatura_nova" : "new_lead",
      email: ownerEmail ?? undefined,
      phone: ownerPhone ?? undefined,
      name: ownerName ?? undefined,
      userId: ownerId ?? undefined,
      pushUrl: "/dashboard/leads",
      detailsHtml,
      detailsText,
    });
  }

  return { ok: true };
}

/** Envia uma mensagem no chat (cria/usa a conversa). Best-effort em demo. */
export async function sendMessage(input: {
  conversationId?: string;
  receiverId?: string;
  propertyId?: string;
  body: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true, id: input.conversationId };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !input.receiverId) return { ok: false, error: "Dados incompletos." };

  // Id SEMPRE recalculado no servidor (as duas pessoas + imóvel): o valor que
  // vem do cliente é ignorado, para não dar para "entrar" em outra conversa.
  const conversationId = idConversa(user.id, input.receiverId, input.propertyId);

  // Proteção de contato: telefones/e-mails/links de mensageria são mascarados
  // ANTES de gravar — a negociação fica registrada na plataforma e o contato
  // direto só é liberado no fluxo oficial (após o aceite do proprietário).
  const { text: safeBody, documento } = guardContactInfo(input.body);
  // Prompt 32: CPF/RG não vai pelo chat (nem mascarado) — vai no campo Ocupantes da estadia.
  if (documento) return { ok: false, error: `${DOCUMENTO_BLOQUEADO}.` };

  const { data: gravada, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      receiver_id: input.receiverId,
      property_id: input.propertyId ?? null,
      body: safeBody,
    })
    .select("receiver_id")
    .single();
  if (error || !gravada) {
    console.error("[sendMessage] falha ao gravar:", error?.code, error?.message);
    return { ok: false, error: "Não foi possível enviar a mensagem agora. Tente de novo em instantes." };
  }
  // Destinatário pela LINHA GRAVADA (que passou na RLS), não pelo parâmetro.
  const destinatarioId = gravada.receiver_id as string;

  // Notifica o destinatário por e-mail com o LINK para responder NO SITE
  // (nunca por e-mail — mantém o registro). Best-effort: falha de notificação
  // não derruba o envio. O contato vem da RPC escopada (migração 0024); sem a
  // migração, segue sem notificar.
  try {
    // C3: contato (PII) só no servidor, via service role. A relação entre as
    // partes já foi provada: o INSERT acima passou na RLS de messages (exige
    // lead ou resposta a pedido). A RPC antiga dependia de auth.uid(), que é
    // nulo com service role — por isso a leitura direta, escopada ao destinatário.
    const admin = createAdminClient();
    const { data: contact } = admin
      ? await admin
          .from("profiles")
          .select("full_name, email, phone")
          .eq("id", destinatarioId)
          .maybeSingle()
      : { data: null };
    // Anti-spam de e-mail: no máximo 1 e-mail por conversa a cada 30 min (o
    // resto da rajada fica só no site) e 30 e-mails/hora disparados por quem
    // escreve. A mensagem em si SEMPRE é gravada — só o e-mail é contido.
    const podeAvisar =
      !!contact?.email &&
      (await dentroDoLimite(`msg-email:${conversationId}:${destinatarioId}`, 1, 30 * 60)) &&
      (await dentroDoLimite(`msg-email-remetente:${user.id}`, 30, HORA));
    if (contact?.email && podeAvisar) {
      const { data: me } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      // Identidade pós-aceite: só o PRIMEIRO nome no e-mail (nunca o sobrenome).
      const senderName = (me?.full_name ?? "").trim().split(/\s+/)[0] || "Um usuário";
      // Nome e prévia são texto do USUÁRIO: sem HTML ativo e sem links no e-mail.
      const nomeHtml = textoEmail(senderName, 40);
      const previewHtml = textoEmail(safeBody, 140);
      const previewTexto = textoPlano(safeBody, 140);
      const link = `${SITE_URL}/dashboard/mensagens`;
      await notify({
        event: "new_message",
        email: contact.email,
        name: contact.full_name ?? undefined,
        detailsHtml:
          `<p><strong>${nomeHtml}</strong> escreveu:</p>` +
          `<blockquote style="margin:8px 0;padding:8px 12px;border-left:3px solid #1c6b3a;color:#374151">${previewHtml}</blockquote>` +
          `<p><a href="${link}" style="display:inline-block;background:#1c6b3a;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Responder no Viva Nomads</a></p>` +
          `<p style="color:#6b7280;font-size:12px">Responda sempre pela plataforma — assim a conversa fica registrada e protegida. Não responda este e-mail.</p>`,
        detailsText: `${textoPlano(senderName, 40)}: ${previewTexto}\n\nResponda pela plataforma (a conversa fica registrada): ${link}`,
      });
    }
  } catch {
    /* notificação é best-effort */
  }

  return { ok: true, id: conversationId };
}

/**
 * Exclui um imóvel do proprietário logado (usado para descartar RASCUNHOS).
 * Apaga as tabelas-filhas (best-effort) e a linha do imóvel — sempre escopado a
 * owner_id (a RLS reforça). Demo/preview: no-op de sucesso.
 */
export async function deleteProperty(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  // Prompt 58: as fotos saem do bucket com o anúncio (o hash fica, antifraude). Só as do próprio dono.
  const { data: dono } = await supabase.from("properties").select("id").eq("id", id).eq("owner_id", user.id).maybeSingle();
  const { data: fotos } = dono ? await supabase.from("property_photos").select("url").eq("property_id", id) : { data: null };
  for (const table of ["property_photos", "property_amenities", "property_proximities"]) {
    try {
      await supabase.from(table).delete().eq("property_id", id);
    } catch {
      /* tabela ausente — ignora */
    }
  }
  const { error } = await supabase.from("properties").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return { ok: false, error: erroBancoPT(error) };
  if (fotos?.length) await apagarFotosDoAnuncio(createAdminClient(), (fotos as { url: string }[]).map((f) => f.url));
  revalidarAnuncio(id, revalidatePath);
  return { ok: true };
}

/** Quantos RASCUNHOS o proprietário logado tem (para o "Novo anúncio" oferecer retomar). */
export async function countMyDrafts(): Promise<number> {
  const supabase = await createClient();
  if (!supabase) return 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .eq("status", "draft");
  return count ?? 0;
}

/** Operação guardada no estado do editor (draft_data). */
function rascunhoOperacao(d: unknown): { ownershipType?: unknown; subleaseAuthorized?: unknown } {
  return d && typeof d === "object" ? (d as { ownershipType?: unknown; subleaseAuthorized?: unknown }) : {};
}

/**
 * Autosave do RASCUNHO no servidor (P0 — perda de dados). Faz upsert de uma
 * linha `properties` status='draft' guardando o estado COMPLETO do editor em
 * `draft_data` (migration 0043) + os poucos campos NOT NULL (title/city/price)
 * para o card de "Meus imóveis". Sem geocode, sem tabelas-filhas, sem checar
 * limite de plano (rascunho não consome vaga). Devolve o id do rascunho para as
 * próximas gravações atualizarem a mesma linha. Demo/preview: no-op de sucesso.
 */
export async function saveDraftData(snap: {
  id?: string | null;
  title?: string;
  city?: string;
  monthlyPrice?: number;
  neighborhood?: string;
  bathrooms?: number;
  areaM2?: number;
  description?: string;
  data: unknown;
}): Promise<{ ok: boolean; id?: string; error?: string; demo?: boolean }> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Não autenticado." };

  const op = rascunhoOperacao(snap.data);
  const fields = {
    owner_id: user.id,
    status: "draft" as const,
    title: (snap.title?.trim() || "Rascunho de anúncio").slice(0, 200),
    city: snap.city?.trim() || "Uberlândia",
    monthly_price: Number.isFinite(snap.monthlyPrice) ? (snap.monthlyPrice as number) : 0,
    // Colunas que a prontidão lê (Visão geral, Meus imóveis): endereço e detalhes não ficam só no draft_data.
    ...camposDeConteudoDoRascunho(snap),
    // 59-C1: a operação vai junto, pela regra do updateProperty — uma linha antiga "própria com sublocação" (que a
    // restrição da 0200 recusa em qualquer update) fica no permitido já no primeiro autosave.
    ...colunasDeOperacao(op.ownershipType, op.subleaseAuthorized),
    draft_data: snap.data as object,
  };

  // Anúncio novo (sem id): continua o rascunho vazio de menos de 72 h em vez de abrir outro igual (ordem 378c07c4).
  const rascunhoId = snap.id || (await rascunhoVazioRecente(supabase, user.id));
  if (rascunhoId) {
    const { atualizou, error } = await atualizarRascunhoDoDono(supabase, rascunhoId, user.id, fields);
    if (error) {
      // O erro do banco não some mais: o código fica no log do servidor e a causa em português vai para a tela.
      const e = error as Parameters<typeof erroBancoPT>[0];
      console.error("[saveDraftData]", rascunhoId, e?.code, e?.message);
      return { ok: false, error: erroBancoPT(e) };
    }
    // 0 linhas = rascunho de outro dono (ou já publicado): não liga foto nem qualificação.
    if (!atualizou) return { ok: true, id: rascunhoId };
    await gravarChegadaEPedido(supabase, user.id, rascunhoId, chegadaDoRascunho(snap.data));
    await sincronizarFotos(supabase, rascunhoId, user.id, urlsDoRascunho(snap.data));
    await ligarQualificacaoAoImovel(supabase, user.id, rascunhoId);
    await ligarMatriculaAoImovel(createAdminClient(), user.id, rascunhoId);
    return { ok: true, id: rascunhoId };
  }
  const { data, error } = await supabase.from("properties").insert(fields).select("id").single();
  if (error) {
    console.error("[saveDraftData] novo", error.code, error.message);
    return { ok: false, error: erroBancoPT(error) };
  }
  await gravarChegadaEPedido(supabase, user.id, data.id as string, chegadaDoRascunho(snap.data));
  await sincronizarFotos(supabase, data.id as string, user.id, urlsDoRascunho(snap.data));
  // A qualificação enviada antes do rascunho passa a pertencer a ele (prontidão "Em análise", não "Não enviado").
  await ligarQualificacaoAoImovel(supabase, user.id, data.id as string);
  await ligarMatriculaAoImovel(createAdminClient(), user.id, data.id as string);
  return { ok: true, id: data.id };
}

/**
 * 64-B: a situação do limite do plano (a MESMA conta da prontidão e do painel — situacaoLimite). `exceto` = o anúncio
 * que se quer (re)publicar: os publicados contam sem ele.
 */
async function situacaoDoLimite(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ownerId: string,
  exceto: string | null,
): Promise<SituacaoLimite> {
  const plan = await planoDoProprietario(supabase, ownerId);
  let q = supabase.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "active");
  if (exceto) q = q.neq("id", exceto);
  const { count } = await q;
  return situacaoLimite(plan as string, count ?? 0);
}

/**
 * Mensagem de bloqueio se publicar mais um anúncio estoura o limite de anúncios
 * ATIVOS do plano efetivo (assinatura ou Fundador); null se pode. `exceto` = o
 * próprio imóvel sendo (re)publicado (já ativo não conta duas vezes).
 */
async function limiteDePublicacao(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  ownerId: string,
  exceto: string | null
): Promise<string | null> {
  const s = await situacaoDoLimite(supabase, ownerId, exceto);
  return s.podePublicarNovo ? null : `${mensagemLimitePublicar(s)}.`;
}

/**
 * Grava as fotos do anúncio em `property_photos` (a 1ª é a capa) — é daí que
 * saem a contagem do "Meus imóveis", o photo_count e a trava de 8 fotos para
 * publicar. Só regrava quando a lista mudou (o autosave roda a cada edição).
 * Só fotos do bucket na pasta do dono. Best-effort: falha não derruba o salvar.
 */
async function sincronizarFotos(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  propertyId: string,
  ownerId: string,
  urls: readonly unknown[]
): Promise<void> {
  const novas = fotosDoDono(urls, ownerId);
  try {
    const { data: atuais } = await supabase
      .from("property_photos")
      .select("url")
      .eq("property_id", propertyId)
      .order("sort_order");
    const iguais =
      (atuais ?? []).length === novas.length && (atuais ?? []).every((r, i) => r.url === novas[i]);
    if (iguais) return;
    await supabase.from("property_photos").delete().eq("property_id", propertyId);
    if (novas.length > 0) {
      const { error } = await supabase
        .from("property_photos")
        .insert(novas.map((url, i) => ({ property_id: propertyId, url, sort_order: i })));
      if (error) console.error("[sincronizarFotos] falha ao gravar fotos:", error.message);
      else await ligarHashesAoImovel(createAdminClient(), propertyId, novas);
    }
    // Prompt 58: a foto que o dono tirou do anúncio sai do bucket (o hash fica).
    const sairam = ((atuais ?? []) as { url: string }[]).map((r) => r.url).filter((u) => !novas.includes(u));
    if (sairam.length) await apagarFotosDoAnuncio(createAdminClient(), sairam);
  } catch (e) {
    console.error("[sincronizarFotos] erro:", e);
  }
}

/** Carrega o estado salvo (draft_data) de um rascunho do dono, para retomar. */
export async function loadDraftData(id: string): Promise<unknown | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  // C4: draft_data saiu do SELECT por coluna; o dono lê pela RPC (checa owner).
  const { data } = await supabase.rpc("property_private_details", { prop_id: id });
  const row = Array.isArray(data) ? data[0] : data;
  return (row as { draft_data?: unknown } | null)?.draft_data ?? null;
}

/**
 * L1-1 (D-V3): o endereço já GRAVADO do imóvel do dono, para o "Enviar documento" do passo Onde fica não travar quando
 * a tela chega vazia ou em outro formato (rascunho retomado). Vem do rascunho (draft_data: CEP, rua, número) e, sem ele,
 * da linha exata gravada (exact_address: "Rua, número, complemento"). Só o dono lê (RPC confere). null sem nada.
 */
export async function enderecoGravadoDoImovel(id: string): Promise<{ cep: string; rua: string; numero: string } | null> {
  const supabase = await createClient();
  if (!supabase || !UUID_RE.test(id)) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("property_private_details", { prop_id: id });
  const row = (Array.isArray(data) ? data[0] : data) as { draft_data?: Record<string, unknown> | null; exact_address?: string | null } | null;
  if (!row) return null;
  const d = row.draft_data && typeof row.draft_data === "object" ? row.draft_data : {};
  const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const rua = txt(d.street) || txt(row.exact_address);
  const r = { cep: txt(d.cep), rua, numero: txt(d.street) ? txt(d.numero) : "" };
  return r.cep || r.rua || r.numero ? r : null;
}

/** Rascunho mais recente do dono (para "Novo anúncio detecta rascunho" e o card
 * de pendência da Visão geral). Devolve o snapshot completo (`data`) para o
 * cálculo honesto de "% completo". null se não houver. */
export async function getLatestDraft(): Promise<{
  id: string;
  title: string;
  data: unknown;
  /** Prontidão real (fonte única) — o "% completo" e o "falta" de todas as telas. */
  prontidao: Prontidao | null;
  /** Score de qualidade 0–100 com dicas clicáveis (ordem 0f9b9d58), calculado aqui no servidor. */
  score: ScoreAnuncio | null;
} | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("properties")
    .select("id, title")
    .eq("owner_id", user.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  // C4: draft_data vem pela RPC (coluna sensível fora do SELECT por coluna).
  const { data: priv } = await supabase.rpc("property_private_details", { prop_id: data.id });
  const row = Array.isArray(priv) ? priv[0] : priv;
  const fatos = (await fatosDosImoveis(supabase, user.id, [data.id as string])).get(data.id as string) ?? null;
  const prontidao = fatos ? prontidaoAnuncio(fatos) : null;
  let score: ScoreAnuncio | null = null;
  if (fatos && prontidao) {
    const [{ count: comodidades }, { data: pets }] = await Promise.all([
      supabase.from("property_amenities").select("id", { count: "exact", head: true }).eq("property_id", data.id),
      supabase.from("properties").select("pets_allowed, pets_regras").eq("id", data.id).eq("owner_id", user.id).maybeSingle(),
    ]);
    score = scoreAnuncio(prontidao, fatos, {
      comodidades: comodidades ?? 0,
      // Só cobra regras de pet de quem aceita pet.
      petsDefinido:
        (pets as { pets_allowed?: boolean | null } | null)?.pets_allowed !== true ||
        normalizarRegrasPets((pets as { pets_regras?: unknown } | null)?.pets_regras) !== null,
    });
  }
  return {
    id: data.id as string,
    title: (data.title as string) || "Rascunho de anúncio",
    data: (row as { draft_data?: unknown } | null)?.draft_data ?? null,
    prontidao,
    score,
  };
}

// ── 64-B: pausar e reativar anúncio pelo dono ──────────────────────────────────────────────────────────────────────

export type ResultadoPausa = { ok: true; mensagem?: string } | { ok: false; erro: string; faltas?: { rotulo: string; href: string }[] };

/** O dono do anúncio (pela sessão) — ou null. */
async function anuncioDoDono(id: string) {
  const supabase = await createClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("properties")
    .select("id, owner_id, status, pausa_motivo, city, descricao_gerada_por_ia")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return { supabase, userId: user.id, p: data as { id: string; owner_id: string; status: string; pausa_motivo: string | null; city: string | null; descricao_gerada_por_ia: boolean | null } };
}

function revalidarPausa(id: string) {
  revalidatePath("/dashboard/imoveis");
  revalidatePath("/dashboard");
  revalidatePath(`/imoveis/${id}`);
  revalidatePath("/buscar");
}

/**
 * 65-B: grava SÓ o arquivo do vídeo, na hora em que o dono envia, troca ou remove na seção Vídeo do editor. O
 * enviador já apaga o arquivo anterior do bucket; gravar na hora evita o anúncio apontar para um arquivo que não
 * existe mais se a pessoa sair sem "Salvar seção". Caminho só da pasta do próprio dono; "" remove.
 */
export async function gravarVideoArquivo(id: string, videoArquivo: string): Promise<ActionResult> {
  const a = await anuncioDoDono(id);
  if (!a) return { ok: false, error: "Anúncio não encontrado." };
  const coluna = colunaVideoArquivo(videoArquivo, a.userId);
  if (!("video_arquivo" in coluna)) return { ok: false, error: "Vídeo não encontrado." };
  const { error } = await a.supabase.from("properties").update(coluna).eq("id", id).eq("owner_id", a.userId);
  if (error) return { ok: false, error: "Não foi possível gravar o vídeo agora. Tente de novo." };
  revalidatePath(`/imoveis/${id}`);
  revalidatePath(`/dashboard/imoveis/${id}/editar`);
  return { ok: true };
}

/** O que está em andamento no anúncio e CONTINUA depois da pausa (a tela lista antes de confirmar). */
export async function emAndamentoDoAnuncio(id: string): Promise<EmAndamento | null> {
  const a = await anuncioDoDono(id);
  const adm = createAdminClient();
  if (!a || !adm) return null;
  const contar = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [candidaturasAbertas, propostasAceitas, visitasMarcadas, contratosVigentes] = await Promise.all([
    contar(adm.from("leads").select("id", { count: "exact", head: true }).eq("property_id", id).in("status", ["new", "accepted"])),
    contar(adm.from("propostas").select("id", { count: "exact", head: true }).eq("property_id", id).in("status", ["aceita", "em_contrato"])),
    contar(adm.from("visitas_video").select("id", { count: "exact", head: true }).eq("property_id", id).eq("status", "confirmado")),
    contar(adm.from("contratos").select("id", { count: "exact", head: true }).eq("property_id", id).eq("status", "ativo")),
  ]);
  return { candidaturasAbertas, propostasAceitas, visitasMarcadas, contratosVigentes };
}

/**
 * Pausar (dono): publicado → pausado com motivo "dono". Sai da busca, do mapa e dos alertas; a página pública diz que
 * está pausado; não aceita candidatura, proposta nem visita novas. O que está em andamento continua. Nunca bloqueado.
 */
export async function pausarAnuncio(id: string): Promise<ResultadoPausa> {
  const a = await anuncioDoDono(id);
  if (!a) return { ok: false, erro: "Anúncio não encontrado." };
  if (a.p.status !== "active") return { ok: false, erro: "Só um anúncio publicado pode ser pausado." };
  // O motivo só o servidor grava (a coluna não é do dono, 0223): cliente de serviço, depois de conferir o dono acima.
  const adm = createAdminClient();
  if (!adm) return { ok: false, erro: "Não foi possível pausar agora. Tente de novo." };
  const { data, error } = await adm
    .from("properties")
    .update({ status: "paused", pausa_motivo: "dono" })
    .eq("id", id)
    .eq("owner_id", a.userId)
    .eq("status", "active")
    .select("id");
  if (error || !data?.length) return { ok: false, erro: "Não foi possível pausar agora. Tente de novo." };
  revalidarPausa(id);
  return { ok: true, mensagem: "Anúncio pausado. Ele saiu da busca; o que já estava em andamento continua." };
}

/**
 * Reativar (dono): só o que ELE pausou, e pela MESMA porta da publicação — cidade aberta, prontidão (documento, fotos,
 * padrão mínimo…), aceite do termo de IA quando a descrição veio da IA, e a vaga no plano contando os publicados SEM
 * este. Faltando algo: a lista do que falta, cada item com o link para resolver. Os gatilhos do banco conferem de novo.
 */
export async function reativarAnuncio(id: string): Promise<ResultadoPausa> {
  const a = await anuncioDoDono(id);
  if (!a) return { ok: false, erro: "Anúncio não encontrado." };
  const { supabase, userId, p } = a;
  if (p.status !== "paused") return { ok: false, erro: "Este anúncio não está pausado." };
  if (!donoPodeReativar(p.pausa_motivo)) {
    const t = textoDaPausa(p.pausa_motivo);
    return { ok: false, erro: t.motivo, faltas: t.caminho ? [t.caminho] : [] };
  }
  const editar = `/dashboard/imoveis/${id}/editar`;
  const faltas: { rotulo: string; href: string }[] = [];
  const cidade = p.city ? await cidadeFechada(supabase, userId, p.city) : null;
  if (cidade) faltas.push({ rotulo: cidade, href: editar });
  const pr = await prontidaoDoImovel(supabase, userId, id);
  for (const i of pr?.obrigatorios ?? []) if (!i.ok && i.key !== "limite") faltas.push({ rotulo: i.detalhe ? `${i.label}: ${i.detalhe}` : i.label, href: editar });
  if (p.descricao_gerada_por_ia) {
    const { count } = await supabase.from("anuncio_aceites_ia").select("id", { count: "exact", head: true }).eq("property_id", id).eq("versao_termo", TERMO_IA_VERSAO);
    if (!count) faltas.push({ rotulo: "Aceite do termo da IA (confira o texto e aceite na etapa Revisar)", href: editar });
  }
  const lim = await situacaoDoLimite(supabase, userId, id);
  if (!lim.podePublicarNovo) faltas.push({ rotulo: `${mensagemLimiteReativar(lim)}.`, href: "/dashboard/imoveis" });
  if (faltas.length) return { ok: false, erro: "Para reativar, falta:", faltas };
  // Pela sessão do dono: os gatilhos de publicação do banco (documento, fotos, padrão mínimo, laudo, IA) valem aqui.
  const { data, error } = await supabase.from("properties").update({ status: "active" }).eq("id", id).eq("owner_id", userId).eq("status", "paused").select("id");
  if (error || !data?.length) return { ok: false, erro: error?.message ?? "Não foi possível reativar agora. Tente de novo." };
  await avisarBuscasDoImovel(id).catch(() => null);
  revalidarPausa(id);
  return { ok: true, mensagem: "Anúncio reativado: ele voltou para a busca." };
}

/** 64-B: o limite do plano do dono logado (painel e Meus imóveis) — a mesma conta da publicação. */
export async function minhaSituacaoLimite(): Promise<SituacaoLimite | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return situacaoDoLimite(supabase, user.id, null);
}
