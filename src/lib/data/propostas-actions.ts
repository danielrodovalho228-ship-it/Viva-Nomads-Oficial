"use server";

import { resolverAvisos } from "@/lib/notifications/avisos-servidor";
import { moradorNoEmail } from "@/lib/notifications/morador-email-servidor";
import { normalizarRegrasPets } from "@/lib/anuncio/pets-regras";
import type { SupabaseClient } from "@supabase/supabase-js";
import { linkedinConectados } from "@/lib/linkedin/servidor";
import { vinculosConfirmados } from "@/lib/vinculo/servidor";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { ASSUNTOS } from "@/lib/notifications/assuntos";
import { blocoDados } from "@/lib/notifications/modelo-email";
import { aberturaProposta, linhasProposta, proximoPassoProposta, type Desfecho } from "@/lib/notifications/dados-negociacao";
import { escaparHtml } from "@/lib/escapar-html";
import type { NotificationEvent } from "@/lib/notifications/eventos-email";
import { detalhes, propostaAceitaDono, propostaAceitaMorador, propostaRecusada } from "@/lib/notifications/emails-e205b";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { conversationId as idConversa } from "@/lib/messages/conversation-id";
import { nomeNaProposta } from "@/lib/perfil/perfil-publico";
import { planoDoProprietario } from "@/lib/data/plano-efetivo";
import { temDocumento } from "@/lib/data/documento-servidor";
import { MSG_DOCUMENTO } from "@/lib/documento-pessoa";
import { normalizarLimpezaEstadia } from "@/lib/anuncio/limpeza-estadia";
import { avisoAbaixoDoMinimo, normalizarNegociacao, descontoParaMeses, type Negociacao } from "@/lib/anuncio/negociacao";
import { taxaDoDonoAgora, MSG_TAXA_SEM_LEITURA } from "@/lib/cobranca/taxa-servidor";
import { conflitoNoImovel } from "@/lib/data/periodo-servidor";
import { dataDeSaida, periodoEmDias } from "@/lib/contrato-periodo";
import { periodoDaCandidatura } from "@/lib/notifications/dados-candidatura";
import { mesesCompletos, mesesDeReferencia } from "@/lib/estadia-em-dias";
import {
  aguardandoResposta,
  aplicarContraproposta,
  bloqueioContraproposta,
  calcularTotais,
  camposAlterados,
  daVez,
  diferencas,
  estaAberta,
  MAX_VERSOES,
  MENSAGEM_MAX,
  mesesDoAnuncio,
  diasDoAnuncio,
  diasDosTermos,
  taxaServicoProposta,
  motivoRecusaValido,
  MOTIVOS_RECUSA,
  STATUS_ABERTOS,
  mudancasProibidas,
  taxaEfetivaDaProposta,
  avisoTaxaCaiu,
  textoSeAceitaHoje,
  origemDaTaxaDaProposta,
  textoTaxaCongeladaParaDono,
  validaAteDe,
  validarTermos,
  VALIDADES_DIAS,
  type Autor,
  type Diferenca,
  type Mudancas,
  type StatusProposta,
  type TermosProposta,
  type TotaisProposta,
} from "@/lib/propostas/regras";
import {
  COLUNAS_PROPOSTA,
  lerTaxaDaProposta,
  COLUNAS_VERSAO,
  expirarVencidas,
  linhaDaVersao,
  termosDaLinha,
  type LinhaProposta,
  type LinhaVersao,
} from "@/lib/data/propostas-servidor";
import { hojeBR } from "@/lib/utils";
import { precoDaProposta, termosDaEstadiaDoImovel } from "@/lib/precos";
import { PRE_ACEITACAO_72H_ATIVA } from "@/lib/flags";
import { estadoDaPreAceitacao, podeReabrir, prazoDaPreAceitacao, TEXTO_REGRA_CORRIDA, TEXTO_SEM_PUNICAO, TEXTO_TAXA_CONTINUA, textoDoPrazo } from "@/lib/propostas/pre-aceitacao";
import { reabrirNoBanco } from "@/lib/propostas/pre-aceitacao-servidor";

/**
 * E189 (QA 25/10): a conta aberta do total do contrato é UMA só — a mesma da tabela e do detalhe (precoDaProposta:
 * "4 × R$ 2.700 + preparação R$ 450 = R$ 11.250"). Antes, a mensagem e a lista diziam "R$ 2.500/mês × 4, total
 * R$ 11.250", que não fecha a conta (o total inclui condomínio, contas e a preparação).
 */
function contaDaProposta(termos: TermosProposta): string {
  const tot = calcularTotais(termos);
  return precoDaProposta({ ...termos, valorMensal: tot.valorMensal }).conta ?? brl(tot.totalContrato);
}

/**
 * E202: o corpo do e-mail de proposta — abertura com o desfecho e o imóvel, quadro com período, valor mensal, total
 * (a mesma conta aberta da tela), prazo de resposta e número, e o próximo passo de quem recebe.
 */
function dadosDoEmailDaProposta(
  numero: string,
  imovel: { id?: string | null; titulo: string | null; bairro: string | null; cidade: string | null },
  c: { desfecho: Desfecho; termos: TermosProposta; responderAte?: string | null; motivo?: string | null },
  quemRecebe: "owner" | "tenant",
) {
  const tot = calcularTotais(c.termos);
  const entrada = String(c.termos.dataEntrada).slice(0, 10);
  const linhas = linhasProposta({
    numero: String(numero),
    imovel,
    entrada,
    // E599: a data de SAÍDA (entrada + dias), a mesma do formulário e da candidatura — não o fim inclusivo (um dia antes).
    saida: dataDeSaida(entrada, tot.dias),
    meses: mesesDeReferencia(tot.dias),
    dias: tot.dias,
    valorMensal: tot.valorMensal,
    contaTotal: contaDaProposta(c.termos),
    responderAte: c.desfecho === "nova" || c.desfecho === "contraproposta" ? c.responderAte : null,
  });
  const passo = proximoPassoProposta(c.desfecho, quemRecebe);
  return {
    abertura: (nome?: string) => aberturaProposta(c.desfecho, { nome, imovel, novoValorMensal: tot.valorMensal, motivo: c.motivo }),
    html: blocoDados(linhas.map((l) => ({ rotulo: escaparHtml(l.rotulo), valor: escaparHtml(l.valor) }))) + `<p>${escaparHtml(passo)}</p>`,
    texto: [...linhas.map((l) => `${l.rotulo}: ${l.valor}`), passo].join("\n"),
  };
}
import { registrarDocumento } from "@/lib/fiscal/registro";
import { linhaConferir, numeroExibido } from "@/lib/fiscal/prefixos";
import { SITE_URL } from "@/lib/site";

/*
  Propostas (prompt 17): proposta → contraproposta → aceite/recusa → fechamento. Tudo pelo SERVIDOR: a tela manda
  só a intenção e os campos editáveis; valores, limites, totais, rodadas e taxa são conferidos e calculados aqui.
  A proposta é documento, não cobrança — a Viva não recebe nem guarda valor. Contato nunca aparece: as mensagens
  passam pelo mesmo filtro da conversa.
*/

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string; aviso?: string };
type Admin = SupabaseClient;

async function sessao() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, admin, user };
}

interface ImovelProposta {
  id: string;
  owner_id: string;
  status?: string | null;
  title: string;
  monthly_price: number;
  min_period_days: number | null;
  max_period_days: number | null;
  max_guests: number | null;
  condo_fee: number | null;
  utilities_mode: string | null;
  utilities_estimate: number | null;
  prep_fee: number | null;
  checkout_cleaning_enabled: boolean | null;
  checkout_cleaning_fee: number | null;
  limpeza_estadia: unknown;
  negociacao: unknown;
  pets_allowed?: boolean | null;
  pets_regras?: unknown;
}

async function lerImovel(admin: Admin, propertyId: string): Promise<ImovelProposta | null> {
  const { data } = await admin
    .from("properties")
    .select(
      "id, owner_id, status, title, monthly_price, min_period_days, max_period_days, max_guests, condo_fee, utilities_mode, utilities_estimate, prep_fee, checkout_cleaning_enabled, checkout_cleaning_fee, limpeza_estadia, negociacao, pets_allowed, pets_regras",
    )
    .eq("id", propertyId)
    .maybeSingle();
  return (data as ImovelProposta | null) ?? null;
}

function limitesDoImovel(im: ImovelProposta) {
  const m = mesesDoAnuncio(im.min_period_days, im.max_period_days);
  // E562: os limites em dias exatos do anúncio (30 a 180).
  const d = diasDoAnuncio(im.min_period_days, im.max_period_days);
  return { mesesMin: m.min, mesesMax: m.max, diasMin: d.min, diasMax: d.max, capacidade: im.max_guests && im.max_guests > 0 ? im.max_guests : null };
}

/**
 * E263-A: a taxa mensal de pet do anúncio entra na proposta só quando o morador tem pet no perfil ("Meus pets");
 * sem pet (ou sem taxa no anúncio), 0. O proprietário pode mudar ao montar.
 */
async function taxaPetDaProposta(admin: Admin, im: ImovelProposta, tenantId: string): Promise<number> {
  if (!im.pets_allowed) return 0;
  const taxa = normalizarRegrasPets(im.pets_regras)?.taxaMensal ?? 0;
  if (taxa <= 0) return 0;
  const { count } = await admin.from("pets_inquilino").select("id", { count: "exact", head: true }).eq("user_id", tenantId);
  return (count ?? 0) > 0 ? taxa : 0;
}

/** Valores que a montagem abre preenchidos (do anúncio), todos editáveis pelo proprietário. */
function termosDoAnuncio(im: ImovelProposta, dias: number, dataEntrada: string, neg: Negociacao, taxaPet = 0): TermosProposta {
  // E562 (telas): os MESMOS termos da barra lateral do anúncio e do "Pedir para morar" (termosDaEstadiaDoImovel).
  const t = termosDaEstadiaDoImovel({
    monthlyPrice: Number(im.monthly_price) || 0,
    condoFee: Number(im.condo_fee) || 0,
    utilitiesMode: im.utilities_mode === "fixed" ? "fixed" : "real",
    utilitiesEstimate: Number(im.utilities_estimate) || 0,
    limpezaEstadia: normalizarLimpezaEstadia(im.limpeza_estadia) ?? undefined,
    prepFee: Number(im.prep_fee) || 0,
    checkoutCleaningEnabled: !!im.checkout_cleaning_enabled,
    checkoutCleaningFee: Number(im.checkout_cleaning_fee) || 0,
  });
  return {
    valorBase: Number(im.monthly_price) || 0,
    descontoPct: 0,
    descontoValor: 0,
    motivoDesconto: null,
    // E562: a faixa de desconto conta os meses completos da estadia.
    descontoEstadiaPct: descontoParaMeses(neg.descontos, mesesCompletos(dias)),
    meses: mesesDeReferencia(dias),
    dias,
    dataEntrada,
    condominio: t.condominio,
    consumo: t.consumo,
    limpezasMes: t.limpezasMes,
    valorLimpeza: t.valorLimpeza,
    taxaPet,
    limpezaUnica: t.limpezaUnica,
  };
}

async function nomeDe(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const n = (data?.full_name as string | undefined) ?? null;
  return n && !n.includes("@") ? n : null;
}

/**
 * Registro da proposta (Prompt 56): cada versão enviada é o ORC no registro único — o mesmo número com a versão
 * ("ORC-2026-0002 v2"), o hash do conteúdo daquela versão e o código de conferência. Sem PDF por enquanto. A falha
 * fica no log e não desfaz o envio (a proposta já está gravada e avisada).
 */
async function registrarVersaoDaProposta(admin: Admin, p: Pick<LinhaProposta, "id" | "numero" | "owner_id" | "tenant_id">, versao: number, linha: object, autorId: string): Promise<void> {
  try {
    await registrarDocumento(admin, {
      prefixo: "ORC",
      tipo: "proposta",
      ref: { tabela: "propostas", id: p.id },
      partes: [p.owner_id, p.tenant_id],
      emitidoPor: autorId,
      numero: p.numero,
      novaVersao: true,
      versao,
      conteudo: ({ numero, versao: v, codigo }) => JSON.stringify({ numero, versao: v, codigo, proposta: linha }),
    });
  } catch (e) {
    console.error(`[propostas] registro de ${p.numero} v${versao}:`, e instanceof Error ? e.message : e);
  }
}

/** Cartão da proposta na conversa + aviso no site/app/e-mail à outra parte. Best-effort: nunca quebra o fluxo. */
/** E269: "Você recusou a proposta" a quem recusou (só e-mail; o cartão na conversa já registra a recusa). */
async function copiaDaRecusa(admin: Admin, p: Pick<LinhaProposta, "id" | "owner_id" | "tenant_id" | "property_id">, papel: Autor, motivo: string, texto: string | null) {
  try {
    const quem = papel === "owner" ? p.owner_id : p.tenant_id;
    const outro = papel === "owner" ? p.tenant_id : p.owner_id;
    const [{ data: eu }, { data: ele }, { data: im }] = await Promise.all([
      admin.from("profiles").select("email, full_name, notif_email").eq("id", quem).maybeSingle(),
      admin.from("profiles").select("full_name").eq("id", outro).maybeSingle(),
      admin.from("properties").select("city").eq("id", p.property_id).maybeSingle(),
    ]);
    const d = eu as { email: string | null; full_name: string | null; notif_email: boolean | null } | null;
    if (!d?.email || d.notif_email === false) return;
    const e = propostaRecusada({
      quemRecusou: papel,
      motivo,
      texto,
      propostaId: p.id,
      cidade: (im as { city?: string | null } | null)?.city ?? null,
      paraQuemRecusou: true,
      nomeDaOutraParte: (ele as { full_name?: string | null } | null)?.full_name ?? null,
    });
    await notify({ event: "proposta_recusada", email: d.email, name: d.full_name ?? undefined, userId: quem, pushUrl: e.url, imovelId: p.property_id, subject: e.assunto, body: e.abertura, ctaLabel: e.cta, semPush: true });
  } catch {
    /* notificação nunca quebra o fluxo */
  }
}

async function avisarOutraParte(
  admin: Admin,
  p: Pick<LinhaProposta, "id" | "numero" | "owner_id" | "tenant_id" | "property_id">,
  de: Autor,
  texto: string,
  evento: NotificationEvent,
  /** Só vai no e-mail quando o destino é o DONO (a taxa nunca chega ao morador — especificação da taxa, R8). */
  detalhesSoDono?: string,
  /** Prompt 44: valor mensal e validade para o texto do push ("Nova proposta de R$ 3.200 … responda até amanhã"). */
  decisao?: { valorMensal: number; validaAte: string | null },
  /** E202: o desfecho e os termos da versão — o e-mail diz imóvel, período, valores, prazo e o próximo passo. */
  contexto?: { desfecho: Desfecho; termos: TermosProposta; responderAte?: string | null; motivo?: string | null },
  /**
   * E205-B: e-mail próprio no lugar do genérico. `false` = só o cartão na conversa (o aceite manda os dois e-mails
   * dele); função = recebe o primeiro nome de quem respondeu e a cidade e devolve assunto, abertura e botão.
   */
  email?: false | ((o: { nomeRemetente: string | null; cidade: string | null }) => { event: NotificationEvent; assunto: string; abertura: (n?: string) => string; cta: string; url: string }),
) {
  const remetente = de === "owner" ? p.owner_id : p.tenant_id;
  const destino = de === "owner" ? p.tenant_id : p.owner_id;
  try {
    await admin.from("messages").insert({
      conversation_id: idConversa(p.tenant_id, p.owner_id, p.property_id),
      sender_id: remetente,
      receiver_id: destino,
      property_id: p.property_id,
      body: guardContactInfo(texto).text,
      proposta_id: p.id,
    });
  } catch {
    /* o cartão é complemento; a proposta já está gravada */
  }
  if (email === false) {
    revalidatePath("/dashboard/orcamentos");
    revalidatePath(`/dashboard/propostas/${p.id}`);
    revalidatePath("/dashboard/mensagens");
    return;
  }
  try {
    const [{ data: d }, { data: im }, { data: r }] = await Promise.all([
      admin.from("profiles").select("email, full_name").eq("id", destino).maybeSingle(),
      admin.from("properties").select("title, address, city").eq("id", p.property_id).maybeSingle(),
      email ? admin.from("profiles").select("full_name").eq("id", remetente).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const proprio = email
      ? email({ nomeRemetente: ((r as { full_name?: string | null } | null)?.full_name as string | null) ?? null, cidade: (im as { city?: string | null } | null)?.city ?? null })
      : null;
    const imovel = { id: p.property_id, titulo: (im as { title?: string | null } | null)?.title ?? null, bairro: (im as { address?: string | null } | null)?.address ?? null, cidade: (im as { city?: string | null } | null)?.city ?? null };
    const papelDestino = destino === p.owner_id ? "owner" : "tenant";
    const dados = contexto ? dadosDoEmailDaProposta(p.numero, imovel, contexto, papelDestino) : null;
    // E441: proposta (orçamento) do MORADOR ao dono — a foto (ou as iniciais) e o nome dele, clicáveis para o detalhe.
    const pessoa =
      papelDestino === "owner" && de === "tenant"
        ? await moradorNoEmail({ donoId: p.owner_id, moradorId: p.tenant_id, caminho: proprio?.url ?? `/dashboard/propostas/${p.id}`, rotuloLink: "Ver a proposta" }).catch(() => null)
        : null;
    await notify({
      event: proprio?.event ?? evento,
      // E444: o objeto do aviso (resolvido quando quem recebe responder).
      refId: p.id,
      // Quem recebe é parte da proposta (dono ou morador do lead): o valor pode ir no push.
      decisao: decisao
        ? { imovel: (im as { title?: string | null } | null)?.title ?? null, valor: decisao.valorMensal, prazo: decisao.validaAte, destinatarioEhParte: true }
        : undefined,
      email: (d?.email as string | undefined) ?? undefined,
      name: (d?.full_name as string | undefined) ?? undefined,
      userId: destino,
      pushUrl: proprio?.url ?? `/dashboard/propostas/${p.id}`,
      imovelId: p.property_id,
      // O número da proposta vai no corpo, nunca no assunto (rota rápida dos e-mails, item 2).
      subject: proprio?.assunto ?? (evento === "proposta_recebida" ? ASSUNTOS.propostaRecebida : ASSUNTOS.propostaRespondida),
      ...(proprio ? { body: proprio.abertura, ctaLabel: proprio.cta } : dados ? { body: (nome?: string) => dados.abertura(nome) } : {}),
      detailsHtml:
        (pessoa?.html ?? "") +
        (dados ? dados.html : blocoDados([{ rotulo: "Proposta", valor: escaparHtml(String(p.numero)) }])) +
        (detalhesSoDono && destino === p.owner_id ? `<p>${escaparHtml(detalhesSoDono)}</p>` : ""),
      detailsText: [pessoa?.texto ?? "", dados ? dados.texto : `Proposta ${p.numero}`].filter(Boolean).join("\n"),
    });
  } catch {
    /* notificação nunca quebra o fluxo */
  }
  revalidatePath("/dashboard/orcamentos");
  revalidatePath(`/dashboard/propostas/${p.id}`);
  revalidatePath("/dashboard/mensagens");
}

/**
 * E205-B (b): os dois e-mails do aceite. Dono: "Proposta aceita: {primeiro nome} quer morar no seu imóvel", o quadro
 * da negociação, a taxa de serviço congelada e "Preparar o contrato". Morador: "Você garantiu o seu próximo lar", o
 * quadro e a linha do tempo (contrato → Caução → 1º pagamento → instruções de chegada), cada etapa com o prazo do
 * sistema quando existe. Best-effort: nunca quebra o aceite.
 */
async function emailsDoAceite(
  admin: Admin,
  p: Pick<LinhaProposta, "id" | "numero" | "owner_id" | "tenant_id" | "property_id" | "lead_id">,
  termos: TermosProposta,
  linhaTaxa: string,
): Promise<void> {
  try {
    const [{ data: dono }, { data: morador }, { data: im }] = await Promise.all([
      admin.from("profiles").select("email, full_name").eq("id", p.owner_id).maybeSingle(),
      admin.from("profiles").select("email, full_name").eq("id", p.tenant_id).maybeSingle(),
      admin.from("properties").select("title, address, city").eq("id", p.property_id).maybeSingle(),
    ]);
    const i = (im ?? {}) as { title?: string | null; address?: string | null; city?: string | null };
    const imovel = { id: p.property_id, titulo: i.title ?? null, bairro: i.address ?? null, cidade: i.city ?? null };
    const d = (dono ?? {}) as { email?: string | null; full_name?: string | null };
    const m = (morador ?? {}) as { email?: string | null; full_name?: string | null };
    const quadroDono = dadosDoEmailDaProposta(p.numero, imovel, { desfecho: "aceita", termos }, "owner");
    const paraDono = propostaAceitaDono({ nomeMorador: m.full_name, leadId: p.lead_id });
    const passoDono = detalhes({ titulo: paraDono.titulo, passos: paraDono.passos });
    await notify({
      event: "proposta_aceita",
      email: d.email ?? undefined,
      name: d.full_name ?? undefined,
      userId: p.owner_id,
      pushUrl: paraDono.url,
      imovelId: p.property_id,
      subject: paraDono.assunto,
      body: paraDono.abertura,
      ctaLabel: paraDono.cta,
      detailsHtml: quadroDono.html + `<p>${escaparHtml(linhaTaxa)}</p>` + passoDono.html,
      detailsText: `${quadroDono.texto}\n${linhaTaxa}\n${passoDono.texto}`,
    }).catch(() => null);
    const quadroMorador = dadosDoEmailDaProposta(p.numero, imovel, { desfecho: "aceita", termos }, "tenant");
    const paraMorador = propostaAceitaMorador({ dataEntrada: termos.dataEntrada, propostaId: p.id });
    const passos = detalhes({ titulo: paraMorador.titulo, passos: paraMorador.passos, rodape: paraMorador.rodape });
    await notify({
      event: "proposta_aceita",
      email: m.email ?? undefined,
      name: m.full_name ?? undefined,
      userId: p.tenant_id,
      pushUrl: paraMorador.url,
      imovelId: p.property_id,
      subject: paraMorador.assunto,
      body: paraMorador.abertura,
      ctaLabel: paraMorador.cta,
      detailsHtml: quadroMorador.html + passos.html,
      detailsText: `${quadroMorador.texto}\n${passos.texto}`,
    }).catch(() => null);
  } catch {
    /* notificação nunca quebra o fluxo */
  }
}

/* ── Montagem (proprietário) ─────────────────────────────────────────────── */

export interface InteressadoParaProposta {
  leadId: string;
  nome: string;
  imovel: { id: string; titulo: string };
  aceito: boolean;
  temPropostaAberta: boolean;
}

/** "Nova proposta": só interessados REAIS do proprietário (nada de nome ou contato digitado à mão). */
export async function interessadosParaProposta(): Promise<InteressadoParaProposta[]> {
  const s = await sessao();
  if (!s) return [];
  // Achado 49: a falha de leitura LANÇA (a tela abre o aviso de erro com "Tentar de novo") — antes virava "Nenhum
  // interessado" e, na 2ª leitura, perdia a marca de proposta em andamento (dava para mandar outra por cima).
  const { data, error } = await s.supabase
    .from("leads")
    .select("id, status, tenant_id, property_id, property:properties!leads_property_id_fkey ( title )")
    .eq("owner_id", s.user.id)
    .in("status", ["new", "accepted"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Não foi possível ler os interessados agora.");
  const linhas = (data ?? []) as unknown as { id: string; status: string; tenant_id: string; property_id: string; property: { title: string | null } | null }[];
  if (!linhas.length) return [];
  const { data: abertas, error: eAbertas } = await s.admin
    .from("propostas")
    .select("lead_id")
    .in("lead_id", linhas.map((l) => l.id))
    .in("status", ["enviada", "vista", "contraproposta"]);
  if (eAbertas) throw new Error("Não foi possível ler as propostas em andamento agora.");
  const comAberta = new Set(((abertas ?? []) as { lead_id: string }[]).map((a) => a.lead_id));
  const out: InteressadoParaProposta[] = [];
  for (const l of linhas) {
    const aceito = l.status === "accepted";
    out.push({
      leadId: l.id,
      nome: nomeNaProposta({ quemVe: "owner", nomeCompleto: aceito ? await nomeDe(s.admin, l.tenant_id) : null, aceito }),
      imovel: { id: l.property_id, titulo: l.property?.title ?? "Imóvel" },
      aceito,
      temPropostaAberta: comAberta.has(l.id),
    });
  }
  return out;
}

export interface DadosMontagem {
  leadId: string;
  interessado: string;
  imovel: { id: string; titulo: string };
  termos: TermosProposta;
  limites: { mesesMin: number; mesesMax: number; diasMin?: number; diasMax?: number; capacidade: number | null };
  negociacao: Negociacao;
  /** Taxa de serviço prevista (só o proprietário vê). */
  taxa: number;
  /** E582: o documento do dono está completo? Sem ele, o formulário mostra a trava ao lado do botão. */
  documentoOk: boolean;
}

/** Valores do anúncio para abrir a montagem preenchida (só o dono do interessado). */
export async function dadosNovaProposta(leadId: string): Promise<DadosMontagem | null> {
  const s = await sessao();
  if (!s) return null;
  const { data: lead, error: erroLead } = await s.admin.from("leads").select("id, owner_id, tenant_id, property_id, status, inicio_desejado, fim_desejado").eq("id", leadId).maybeSingle();
  // Achado 112: a falha LANÇA (error.tsx) — nunca "Escolha um interessado" quando o interessado existe.
  if (erroLead) throw new Error("Não foi possível ler o interessado.");
  if (!lead || lead.owner_id !== s.user.id || !["new", "accepted"].includes(lead.status as string)) return null;
  const im = await lerImovel(s.admin, lead.property_id as string);
  if (!im) return null;
  const neg = normalizarNegociacao(im.negociacao);
  const lim = limitesDoImovel(im);
  const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const desejada = (lead.inicio_desejado as string | null) ?? null;
  const entrada = desejada && desejada > hojeBR() ? desejada : amanha;
  const aceito = lead.status === "accepted";
  return {
    leadId,
    interessado: nomeNaProposta({ quemVe: "owner", nomeCompleto: aceito ? await nomeDe(s.admin, lead.tenant_id as string) : null, aceito }),
    imovel: { id: im.id, titulo: im.title },
    termos: termosDoAnuncio(im, diasDaMontagem(desejada, (lead.fim_desejado as string | null) ?? null, lim), entrada, neg, await taxaPetDaProposta(s.admin, im, lead.tenant_id as string)),
    limites: lim,
    negociacao: neg,
    taxa: (await taxaDoDonoAgora(s.admin, s.user.id)).taxa,
    documentoOk: await temDocumento(s.admin, s.user.id),
  };
}

/**
 * E562: a montagem abre com os DIAS da candidatura (entrada → saída, sem arredondar para meses), dentro do prazo do
 * anúncio. Sem período na candidatura, 4 meses (120 dias) como antes, dentro dos limites.
 */
function diasDaMontagem(entrada: string | null, saida: string | null, lim: { diasMin: number; diasMax: number }): number {
  const p = periodoDaCandidatura(entrada, saida);
  const desejado = p ? p.dias : 120;
  return Math.min(lim.diasMax, Math.max(lim.diasMin, desejado));
}

export interface EntradaProposta {
  leadId: string;
  valorBase: number;
  descontoPct?: number;
  descontoValor?: number;
  motivoDesconto?: string | null;
  meses: number;
  /** E562: dias exatos (30 a 180). Sem eles (tela antiga), meses × 30. */
  dias?: number | null;
  dataEntrada: string;
  condominio?: number;
  consumo?: number;
  limpezasMes?: number;
  valorLimpeza?: number;
  taxaPet?: number;
  limpezaUnica?: number;
  /** E562: ajuste do dono no pacote de limpezas (vazio = round(limpezas por mês × dias ÷ 30)). */
  limpezasPacote?: number | null;
  pessoas?: number | null;
  validadeDias: number;
  mensagem?: string;
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);

/** Envia a proposta (versão 1): número do servidor ORC-AAAA-NNNN, status "Enviada", cartão na conversa e aviso. */
export async function enviarProposta(e: EntradaProposta): Promise<Resultado<{ id: string; numero: string }>> {
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre para enviar a proposta." };
  const { data: lead } = await s.admin.from("leads").select("id, owner_id, tenant_id, property_id, status").eq("id", e.leadId).maybeSingle();
  if (!lead || lead.owner_id !== s.user.id) return { ok: false, error: "Escolha um interessado da sua lista." };
  if (!["new", "accepted"].includes(lead.status as string)) return { ok: false, error: "Esta candidatura não está mais em andamento." };
  // O aceite da proposta pode valer como aceite da candidatura: o documento do dono vai no contrato.
  if (!(await temDocumento(s.admin, s.user.id))) return { ok: false, error: MSG_DOCUMENTO.proposta };
  if (!VALIDADES_DIAS.includes(Number(e.validadeDias) as 3 | 7 | 15)) return { ok: false, error: "Escolha a validade: 3, 7 ou 15 dias." };

  const im = await lerImovel(s.admin, lead.property_id as string);
  if (!im || im.owner_id !== s.user.id) return { ok: false, error: "Imóvel não encontrado." };
  // 64-B: anúncio pausado não recebe proposta nova (as candidaturas abertas continuam e seguem nas mensagens).
  if (im.status === "paused") return { ok: false, error: "Este anúncio está pausado: reative para enviar uma proposta nova. As candidaturas abertas continuam nas mensagens." };
  const neg = normalizarNegociacao(im.negociacao);
  // E562: a duração é em DIAS; meses vira a referência derivada.
  const dias = e.dias != null && Number.isFinite(Number(e.dias)) ? Number(e.dias) : Math.round(num(e.meses)) * 30;
  const meses = mesesDeReferencia(dias);
  const termos: TermosProposta = {
    valorBase: Math.round(num(e.valorBase) * 100) / 100,
    descontoPct: Math.round(num(e.descontoPct) * 100) / 100,
    descontoValor: Math.round(num(e.descontoValor) * 100) / 100,
    motivoDesconto: e.motivoDesconto ? String(e.motivoDesconto).slice(0, 80) : null,
    descontoEstadiaPct: descontoParaMeses(neg.descontos, mesesCompletos(dias)),
    meses,
    dias,
    dataEntrada: String(e.dataEntrada ?? ""),
    condominio: num(e.condominio),
    consumo: num(e.consumo),
    limpezasMes: Math.round(num(e.limpezasMes)),
    valorLimpeza: num(e.valorLimpeza),
    taxaPet: num(e.taxaPet),
    limpezaUnica: num(e.limpezaUnica),
    limpezasPacote: e.limpezasPacote == null ? null : Math.min(48, Math.round(num(e.limpezasPacote))),
  };
  const pessoas = e.pessoas == null ? null : Math.round(num(e.pessoas)) || null;
  const erro = validarTermos(termos, limitesDoImovel(im), hojeBR(), pessoas);
  if (erro) return { ok: false, error: erro };

  // Achado 83: a taxa do envio congela o teto desta proposta; sem lê-la, a proposta não sai (antes de numerar: a falha não gasta um ORC).
  const taxaEnvio = await taxaDoDonoAgora(s.admin, s.user.id).catch(() => null);
  if (!taxaEnvio) return { ok: false, error: MSG_TAXA_SEM_LEITURA };
  const { data: numero, error: eNum } = await s.admin.rpc("next_document_number", { p_type: "orcamento", p_year: new Date().getFullYear() });
  if (eNum || typeof numero !== "string") return { ok: false, error: "Não foi possível numerar a proposta. Tente de novo." };
  const validade = Number(e.validadeDias);
  const { data: p, error: eP } = await s.admin
    .from("propostas")
    .insert({
      numero,
      lead_id: lead.id,
      property_id: im.id,
      owner_id: s.user.id,
      tenant_id: lead.tenant_id,
      status: "enviada",
      versao_atual: 1,
      validade_dias: validade,
      valida_ate: validaAteDe(validade, new Date()),
      // A faixa do dono AGORA: a taxa desta proposta nunca sobe depois do envio (complemento do prompt 27, parte B).
      taxa_no_envio: taxaEnvio.taxa,
    })
    .select(COLUNAS_PROPOSTA)
    .single();
  if (eP || !p) {
    if (eP?.code === "23505") return { ok: false, error: "Já há uma proposta em andamento com este interessado." };
    return { ok: false, error: "Não foi possível enviar a proposta." };
  }
  const mensagem = e.mensagem ? guardContactInfo(String(e.mensagem).slice(0, MENSAGEM_MAX)).text : null;
  const linhaV1 = linhaDaVersao(p.id as string, 1, "owner", termos, pessoas, mensagem);
  const { error: eV } = await s.admin.from("proposta_versoes").insert(linhaV1);
  if (eV) {
    await s.admin.from("propostas").delete().eq("id", p.id);
    return { ok: false, error: "Não foi possível enviar a proposta." };
  }
  await registrarVersaoDaProposta(s.admin, p as LinhaProposta, 1, linhaV1, s.user.id);
  const tot = calcularTotais(termos);
  await avisarOutraParte(
    s.admin,
    p as LinhaProposta,
    "owner",
    `Proposta ${numero} enviada. Total do contrato: ${contaDaProposta(termos)}.`,
    "proposta_recebida",
    undefined,
    { valorMensal: tot.valorMensal, validaAte: (p as LinhaProposta).valida_ate ?? null },
    { desfecho: "nova", termos, responderAte: (p as LinhaProposta).valida_ate ?? null },
  );
  return { ok: true, id: p.id as string, numero: numero as string };
}

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;

/* ── Leitura (as duas partes) ────────────────────────────────────────────── */

export interface VersaoView {
  versao: number;
  autor: Autor;
  termos: TermosProposta;
  totais: TotaisProposta;
  pessoas: number | null;
  mensagem: string | null;
  criadaEm: string;
  /** O que mudou em relação à versão anterior (vazio na 1ª). */
  mudou: Diferenca[];
}

/** E722: o que a tela mostra da pré-aceitação de 72 h (só com a chave ligada e a proposta aceita ou expirada). */
export interface PreAceitacaoView {
  estado: "vigente" | "expirada";
  /** Fim da janela do morador (ISO) e o mesmo em texto, com data e hora exatas de Brasília. Só aparece enquanto o prazo é do morador. */
  ateIso: string;
  ateTexto: string;
  /** Um prazo por vez: com a candidatura de volta ao dono, só o prazo DELE (1 dia útil) aparece; o do morador some. */
  donoAteTexto: string | null;
  /** Candidatura encerrada na 3ª expiração: não há mais reabertura. */
  encerrada: boolean;
  /** Perdeu a corrida: só o dono reabre. */
  perdeuACorrida: boolean;
  reaberturas: number;
  podeReabrir: boolean;
  regraCorrida: string;
  semPunicao: string;
  taxaContinua: string;
}

export interface PropostaView {
  /** E722: pré-aceitação de 72 h (null = chave desligada ou proposta sem janela). */
  preAceitacao: PreAceitacaoView | null;
  id: string;
  numero: string;
  status: StatusProposta;
  papel: Autor;
  leadId: string;
  imovel: { id: string; titulo: string };
  outraParte: string;
  /** 63-B: na tela do dono, o interessado tem o selo "LinkedIn conectado" (só o sim). */
  outraParteLinkedin: boolean;
  /** E174-B: na tela do dono, o domínio do vínculo profissional confirmado do interessado (só o domínio). */
  outraParteVinculo: string | null;
  /** As duas partes pelo nome completo, sem CPF/CNPJ (Prompt 56, D4). */
  partes: { proprietario: string; interessado: string };
  /** Registro da versão vigente (Prompt 56): número com a versão e a linha do /conferir. */
  registro: { numero: string; conferir: string } | null;
  versaoAtual: number;
  validaAte: string;
  vistoEm: string | null;
  recusa: { por: Autor; motivo: string; texto: string | null } | null;
  versoes: VersaoView[];
  atual: VersaoView;
  vez: Autor;
  podeResponder: boolean;
  /** Motivo de NÃO poder contrapropor (null = pode). */
  bloqueioContraproposta: string | null;
  itensLiberados: string[];
  descontos: { mesesMin: number; pct: number }[];
  limites: { mesesMin: number; mesesMax: number };
  /** Só o proprietário vê a taxa de serviço. */
  taxa: { pct: number; valor: number; congelada: boolean; valorMensal: number; meses: number; seAceitaHoje: string | null; caiu: string | null } | null;
  fechamentoUrl: string | null;
}

export interface PropostaResumo {
  id: string;
  numero: string;
  status: StatusProposta;
  papel: Autor;
  imovel: string;
  outraParte: string;
  totalContrato: number;
  valorMensal: number;
  /** PROP-2: "Total por mês (com contas)" e a conta aberta do total do contrato (fonte única). */
  totalPorMes: number;
  conta: string | null;
  meses: number;
  validaAte: string;
  versaoAtual: number;
  /** Aberta e esperando a resposta desta pessoa (prompt 27). */
  aguardandoVoce: boolean;
}

/** O outro lado da proposta pelo NOME COMPLETO (Prompt 56, D4); o interessado só depois do aceite da candidatura. */
async function nomeOutraParte(admin: Admin, p: LinhaProposta, papel: Autor): Promise<string> {
  if (papel === "owner") {
    const { data: lead } = await admin.from("leads").select("status").eq("id", p.lead_id).maybeSingle();
    const aceito = lead?.status === "accepted";
    return nomeNaProposta({ quemVe: "owner", nomeCompleto: aceito ? await nomeDe(admin, p.tenant_id) : null, aceito });
  }
  return nomeNaProposta({ quemVe: "tenant", nomeCompleto: await nomeDe(admin, p.owner_id), aceito: true });
}

/** As duas partes pelo nome completo (o interessado só depois do aceite da candidatura, para o proprietário). */
async function partesDaProposta(admin: Admin, p: LinhaProposta, papel: Autor): Promise<PropostaView["partes"]> {
  const outra = await nomeOutraParte(admin, p, papel);
  const minha = nomeNaProposta({ quemVe: "tenant", nomeCompleto: await nomeDe(admin, papel === "owner" ? p.owner_id : p.tenant_id), aceito: true });
  return papel === "owner" ? { proprietario: minha === "Proprietário" ? "Você" : minha, interessado: outra } : { proprietario: outra, interessado: minha === "Proprietário" ? "Você" : minha };
}

/** Número exibido ("ORC-2026-0002 v2") e a linha do /conferir da versão vigente da proposta, quando registrada. */
async function registroDaProposta(admin: Admin, propostaId: string): Promise<PropostaView["registro"]> {
  const { data } = await admin
    .from("documentos_registro")
    .select("numero, versao, codigo_verificacao")
    .eq("ref_tabela", "propostas")
    .eq("ref_id", propostaId)
    .eq("status", "valido")
    .order("versao", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { numero: numeroExibido(data.numero as string, Number(data.versao)), conferir: linhaConferir(SITE_URL, data.codigo_verificacao as string) } : null;
}

/**
 * Lista de Orçamentos: as propostas em que a pessoa é parte (dono ou interessado). E677: a ordem é a do ENVIO (criada_em),
 * que só muda quando nasce uma proposta; ordenar por atualizada_em reembaralhava as linhas a cada "vista"/resposta, e a
 * linha de uma posição passava a ser outra proposta (as do mesmo imóvel só se distinguem pelo número).
 */
const MSG_PROPOSTAS_NAO_CARREGARAM = "Não foi possível carregar as propostas agora.";

/** Auditoria de erros e estados vazios, achado nº 6: com `exigir` (a tela da lista), a falha do banco LANÇA — o painel
 * mostra "Não conseguimos abrir esta tela" com "Tentar de novo" — em vez de dizer "nenhuma". Sem `exigir` (contadores,
 * home, notificações), segue a lista vazia. */
export async function listarPropostas(opcoes: { exigir?: boolean } = {}): Promise<PropostaResumo[]> {
  const s = await sessao();
  if (!s) return [];
  await expirarVencidas(s.admin, s.user.id);
  // RLS: só as propostas das partes.
  const { data, error } = await s.supabase.from("propostas").select(COLUNAS_PROPOSTA).order("criada_em", { ascending: false }).order("numero", { ascending: false }).limit(200);
  if (error && opcoes.exigir) throw new Error(MSG_PROPOSTAS_NAO_CARREGARAM);
  const ps = (data ?? []) as LinhaProposta[];
  if (!ps.length) return [];
  const [{ data: vs }, { data: ims }] = await Promise.all([
    s.supabase.from("proposta_versoes").select(COLUNAS_VERSAO).in("proposta_id", ps.map((p) => p.id)),
    s.admin.from("properties").select("id, title").in("id", [...new Set(ps.map((p) => p.property_id))]),
  ]);
  const titulo = new Map(((ims ?? []) as { id: string; title: string }[]).map((i) => [i.id, i.title]));
  const versoes = (vs ?? []) as LinhaVersao[];
  const out: PropostaResumo[] = [];
  for (const p of ps) {
    const papel: Autor = p.owner_id === s.user.id ? "owner" : "tenant";
    const v = versoes.find((x) => x.proposta_id === p.id && x.versao === p.versao_atual);
    if (!v) continue;
    const preco = precoDaProposta({ ...termosDaLinha(v), valorMensal: Number(v.valor_mensal) });
    out.push({
      id: p.id,
      numero: p.numero,
      status: p.status,
      papel,
      imovel: titulo.get(p.property_id) ?? "Imóvel",
      outraParte: await nomeOutraParte(s.admin, p, papel),
      totalContrato: Number(v.total_contrato),
      valorMensal: Number(v.valor_mensal),
      totalPorMes: preco.totalPorMes,
      conta: preco.conta,
      meses: Number(v.meses),
      validaAte: p.valida_ate,
      versaoAtual: p.versao_atual,
      aguardandoVoce: aguardandoResposta(p.status, v.autor, papel),
    });
  }
  return out;
}

/** Número do menu "Propostas" do inquilino: propostas abertas esperando a resposta dele (prompt 27). */
export async function contarPropostasAguardando(): Promise<number> {
  const s = await sessao();
  if (!s) return 0;
  const { data } = await s.supabase
    .from("propostas")
    .select("id, versao_atual, valida_ate, proposta_versoes(versao, autor)")
    .eq("tenant_id", s.user.id)
    .in("status", STATUS_ABERTOS as string[])
    .gt("valida_ate", new Date().toISOString())
    .limit(50);
  return ((data ?? []) as { versao_atual: number; proposta_versoes: { versao: number; autor: Autor }[] | null }[]).filter((p) => {
    const v = (p.proposta_versoes ?? []).find((x) => x.versao === p.versao_atual);
    return !!v && daVez(v.autor) === "tenant";
  }).length;
}

/** Detalhe da proposta (as duas partes). O interessado abrindo uma proposta "Enviada" a marca como "Vista". */
export async function lerProposta(id: string): Promise<PropostaView | null> {
  const s = await sessao();
  if (!s || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  await expirarVencidas(s.admin, s.user.id);
  // Leitura pela sessão (RLS): quem não é parte não vê nada (404).
  const { data: pRow } = await s.supabase.from("propostas").select(COLUNAS_PROPOSTA).eq("id", id).maybeSingle();
  let p = pRow as LinhaProposta | null;
  if (!p) return null;
  const papel: Autor = p.owner_id === s.user.id ? "owner" : "tenant";
  if (papel === "tenant" && p.status === "enviada") {
    const agora = new Date().toISOString();
    const { data: vista } = await s.admin
      .from("propostas")
      .update({ status: "vista", visto_em: agora, atualizada_em: agora })
      .eq("id", p.id)
      .eq("status", "enviada")
      .select(COLUNAS_PROPOSTA)
      .maybeSingle();
    if (vista) p = vista as LinhaProposta;
  }
  const { data: vs } = await s.supabase.from("proposta_versoes").select(COLUNAS_VERSAO).eq("proposta_id", p.id).order("versao");
  const linhas = (vs ?? []) as LinhaVersao[];
  if (!linhas.length) return null;
  const versoes: VersaoView[] = linhas.map((v, i) => {
    const termos = termosDaLinha(v);
    return {
      versao: v.versao,
      autor: v.autor,
      termos,
      totais: calcularTotais(termos),
      pessoas: v.pessoas,
      mensagem: v.mensagem,
      criadaEm: v.criada_em,
      mudou: i === 0 ? [] : diferencas(termosDaLinha(linhas[i - 1]), termos),
    };
  });
  const atual = versoes[versoes.length - 1];
  const im = await lerImovel(s.admin, p.property_id);
  const neg = normalizarNegociacao(im?.negociacao);
  const lim = im ? limitesDoImovel(im) : { mesesMin: 1, mesesMax: 6 };
  const vez = daVez(atual.autor);
  const aberta = estaAberta(p.status);
  let taxa: PropostaView["taxa"] = null;
  if (papel === "owner") {
    // Antes do aceite: a taxa DO ENVIO (com a base) e, se a faixa de hoje for menor, "Se aceita hoje: X%".
    // Depois do aceite: a congelada e, se ela ficou abaixo da do envio, "Sua taxa caiu para X%…".
    // Leitura falha: a taxa não aparece (nunca a de hoje no lugar da do envio).
    const tx = await lerTaxaDaProposta(s.admin, p.id).catch(() => null);
    if (tx) {
      const congelada = tx.taxa_congelada != null;
      // Achado 83: sem ler a taxa de hoje, nada de "Se aceita hoje" (e, sem a do envio, a taxa não aparece).
      const hoje = congelada ? null : await taxaDoDonoAgora(s.admin, s.user.id).then((t) => t.taxa).catch(() => null);
      const pct = congelada ? (tx.taxa_congelada as number) : (tx.taxa_no_envio ?? hoje);
      if (pct != null) taxa = {
        pct,
        // E562: a taxa sobre o aluguel × dias ÷ 30 (em meses cheios, × meses como antes).
        valor: taxaServicoProposta(atual.termos, pct),
        congelada,
        valorMensal: atual.totais.valorMensal,
        meses: atual.totais.dias / 30,
        seAceitaHoje: !congelada && hoje != null ? textoSeAceitaHoje(tx.taxa_no_envio, hoje) : null,
        caiu: congelada ? avisoTaxaCaiu(tx.taxa_no_envio, tx.taxa_congelada as number) : null,
      };
    }
  }
  const preAceitacao = PRE_ACEITACAO_72H_ATIVA && ["aceita", "expirada"].includes(p.status) ? await preAceitacaoDaProposta(s.admin, p.id, papel) : null;
  return {
    preAceitacao,
    id: p.id,
    numero: p.numero,
    status: p.status,
    papel,
    leadId: p.lead_id,
    imovel: { id: p.property_id, titulo: im?.title ?? "Imóvel" },
    outraParte: await nomeOutraParte(s.admin, p, papel),
    outraParteLinkedin: papel === "owner" && (await linkedinConectados([p.tenant_id], s.admin)).has(p.tenant_id),
    outraParteVinculo: papel === "owner" ? ((await vinculosConfirmados([p.tenant_id], s.admin)).get(p.tenant_id) ?? null) : null,
    partes: await partesDaProposta(s.admin, p, papel),
    registro: await registroDaProposta(s.admin, p.id),
    versaoAtual: p.versao_atual,
    validaAte: p.valida_ate,
    vistoEm: p.visto_em,
    recusa:
      p.status === "recusada" && p.recusada_por
        ? { por: p.recusada_por, motivo: MOTIVOS_RECUSA.find((m) => m.chave === p!.recusa_motivo)?.rotulo ?? "Outro", texto: p.recusa_texto }
        : null,
    versoes,
    atual,
    vez,
    podeResponder: aberta && vez === papel,
    bloqueioContraproposta: bloqueioContraproposta({ status: p.status, versaoAtual: p.versao_atual, quem: papel, autorUltimaVersao: atual.autor, negociacao: neg }),
    itensLiberados: papel === "owner" ? ["valor_mensal", "meses", "data_entrada", "limpeza", "taxa_pet"] : neg.itens,
    descontos: neg.descontos,
    limites: { mesesMin: lim.mesesMin, mesesMax: lim.mesesMax },
    taxa,
    fechamentoUrl: papel === "owner" && ["aceita", "em_contrato"].includes(p.status) ? `/dashboard/fechamento?c=${p.lead_id}` : null,
  };
}

/* ── Resposta (a parte da vez) ───────────────────────────────────────────── */

export type Resposta =
  | { acao: "aceitar" }
  | { acao: "recusar"; motivo: string; texto?: string }
  | { acao: "contrapropor"; mudancas: Mudancas; mensagem?: string; mesmoAbaixoDoMinimo?: boolean };

async function carregarParaResponder(s: NonNullable<Awaited<ReturnType<typeof sessao>>>, id: string) {
  await expirarVencidas(s.admin, s.user.id);
  const { data } = await s.supabase.from("propostas").select(COLUNAS_PROPOSTA).eq("id", id).maybeSingle();
  const p = data as LinhaProposta | null;
  if (!p) return null;
  const { data: v } = await s.admin.from("proposta_versoes").select(COLUNAS_VERSAO).eq("proposta_id", p.id).eq("versao", p.versao_atual).maybeSingle();
  if (!v) return null;
  return { p, v: v as LinhaVersao, papel: (p.owner_id === s.user.id ? "owner" : "tenant") as Autor };
}

/** E444: responder (aceitar, recusar ou contrapropor) resolve estes avisos críticos da proposta. */
const EVENTOS_RESPONDER: NotificationEvent[] = ["proposta_recebida", "proposta_vencendo"];

export async function responderProposta(id: string, r: Resposta): Promise<Resultado<{ fechamentoUrl?: string | null; versao?: number }>> {
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre para responder." };
  const c = await carregarParaResponder(s, id);
  if (!c) return { ok: false, error: "Proposta não encontrada." };
  const { p, v, papel } = c;
  if (!estaAberta(p.status)) return { ok: false, error: p.status === "expirada" ? "Esta proposta expirou." : "Esta proposta não está mais em andamento." };
  if (v.autor === papel) return { ok: false, error: "Aguarde a resposta da outra parte." };

  if (r.acao === "recusar") {
    if (!motivoRecusaValido(r.motivo)) return { ok: false, error: "Escolha o motivo da recusa." };
    const texto = r.texto ? guardContactInfo(String(r.texto).slice(0, 500)).text : null;
    const agora = new Date().toISOString();
    const { data: ok } = await s.admin
      .from("propostas")
      .update({ status: "recusada", recusada_por: papel, recusa_motivo: r.motivo, recusa_texto: texto, atualizada_em: agora })
      .eq("id", p.id)
      .eq("versao_atual", p.versao_atual)
      .in("status", ["enviada", "vista", "contraproposta"])
      .select("id")
      .maybeSingle();
    if (!ok) return { ok: false, error: "A proposta mudou enquanto você respondia. Abra de novo." };
    const motivo = MOTIVOS_RECUSA.find((m) => m.chave === r.motivo)!.rotulo;
    await avisarOutraParte(
      s.admin,
      p,
      papel,
      `Proposta ${p.numero} recusada. Motivo: ${motivo}.${texto ? ` ${texto}` : ""}`,
      "proposta_respondida",
      undefined,
      undefined,
      { desfecho: "recusada", termos: termosDaLinha(v), motivo },
      // E205-B (c): "{Primeiro nome} recusou a proposta", o motivo e o botão de cada lado.
      ({ nomeRemetente, cidade }) => {
        const e = propostaRecusada({ quemRecusou: papel, nomeDeQuemRecusou: nomeRemetente, motivo, texto, propostaId: p.id, cidade });
        return { event: "proposta_recusada", assunto: e.assunto, abertura: e.abertura, cta: e.cta, url: e.url };
      },
    );
    // E269: a cópia de quem recusou (os dois lados recebem, 1 cada) — a moradora que recusa vê imóveis parecidos.
    await copiaDaRecusa(s.admin, p, papel, motivo, texto);
    await resolverAvisos({ usuarioId: s.user.id, eventos: EVENTOS_RESPONDER, refId: p.id });
    return { ok: true };
  }

  if (r.acao === "aceitar") {
    const res = await aceitar(s.admin, p, v, papel);
    // E444: respondeu (aceitou) → o aviso crítico "responder a proposta" fica resolvido.
    if (res.ok) await resolverAvisos({ usuarioId: s.user.id, eventos: EVENTOS_RESPONDER, refId: p.id });
    return res;
  }

  // Contraproposta.
  const im = await lerImovel(s.admin, p.property_id);
  if (!im) return { ok: false, error: "Imóvel não encontrado." };
  const neg = normalizarNegociacao(im.negociacao);
  const bloqueio = bloqueioContraproposta({ status: p.status, versaoAtual: p.versao_atual, quem: papel, autorUltimaVersao: v.autor, negociacao: neg });
  if (bloqueio) return { ok: false, error: bloqueio };
  const anterior = termosDaLinha(v);
  const m = (r.mudancas ?? {}) as Mudancas;
  const mudancas: Mudancas = {};
  if (m.valorBase !== undefined) mudancas.valorBase = num(m.valorBase);
  if (m.meses !== undefined) mudancas.meses = num(m.meses);
  // E562: contraproposta em dias exatos (vence `meses` quando os dois vêm).
  if (m.dias !== undefined && m.dias !== null) mudancas.dias = num(m.dias);
  if (m.dataEntrada !== undefined) mudancas.dataEntrada = String(m.dataEntrada);
  if (m.limpezasMes !== undefined) mudancas.limpezasMes = num(m.limpezasMes);
  if (m.taxaPet !== undefined) mudancas.taxaPet = num(m.taxaPet);
  const nova = aplicarContraproposta(anterior, mudancas, neg.descontos);
  if (camposAlterados(anterior, nova).length === 0) return { ok: false, error: "Mude ao menos um valor para contrapropor." };
  const proibidas = mudancasProibidas(anterior, nova, papel, neg.itens);
  if (proibidas.length) return { ok: false, error: `O proprietário não abriu para negociação: ${proibidas.join(", ").toLowerCase()}.` };
  const erro = validarTermos(nova, limitesDoImovel(im), hojeBR(), v.pessoas);
  if (erro) return { ok: false, error: erro };

  if (papel === "tenant") {
    const { data: lim, error: erroLim } = await s.admin.from("property_negociacao_limites").select("valor_minimo, limpezas_max").eq("property_id", im.id).maybeSingle();
    // Leitura falha não vira "o proprietário não tem mínimo": a contraproposta abaixo do limite não sai sem o aviso.
    if (erroLim) return { ok: false, error: "Não foi possível conferir os limites do proprietário agora. Tente de novo." };
    // Limite PRIVADO: o número exato nunca sai do servidor (só a próxima centena acima).
    const abaixo = avisoAbaixoDoMinimo(calcularTotais(nova).valorMensal, lim?.valor_minimo == null ? null : Number(lim.valor_minimo));
    if (abaixo && !r.mesmoAbaixoDoMinimo)
      return {
        ok: false,
        error: "Abaixo do que o proprietário aceita.",
        aviso: `Abaixo do que o proprietário aceita; tente a partir de ${brl(abaixo.tenteAPartirDe)}.`,
      };
    if (lim?.limpezas_max != null && nova.limpezasMes > Number(lim.limpezas_max) && nova.limpezasMes > anterior.limpezasMes)
      return { ok: false, error: "O proprietário não inclui tantas limpezas por mês. Escolha menos." };
  }

  const versao = p.versao_atual + 1;
  if (versao > MAX_VERSOES) return { ok: false, error: "Esta proposta já teve 3 rodadas: agora é aceitar ou recusar." };
  const mensagem = r.mensagem ? guardContactInfo(String(r.mensagem).slice(0, MENSAGEM_MAX)).text : null;
  const linhaNova = linhaDaVersao(p.id, versao, papel, nova, v.pessoas, mensagem);
  const { error: eV } = await s.admin.from("proposta_versoes").insert(linhaNova);
  if (eV) return { ok: false, error: eV.code === "23505" ? "A proposta mudou enquanto você respondia. Abra de novo." : "Não foi possível enviar a contraproposta." };
  await registrarVersaoDaProposta(s.admin, p, versao, linhaNova, s.user.id);
  const agora = new Date();
  await s.admin
    .from("propostas")
    .update({ status: "contraproposta", versao_atual: versao, valida_ate: validaAteDe(p.validade_dias, agora), atualizada_em: agora.toISOString() })
    .eq("id", p.id);
  const tot = calcularTotais(nova);
  await avisarOutraParte(
    s.admin,
    p,
    papel,
    `Contraproposta ${p.numero} (versão ${versao}). Total do contrato: ${contaDaProposta(nova)}.${mensagem ? ` ${mensagem}` : ""}`,
    "proposta_recebida",
    undefined,
    { valorMensal: tot.valorMensal, validaAte: validaAteDe(p.validade_dias, agora) },
    { desfecho: "contraproposta", termos: nova, responderAte: validaAteDe(p.validade_dias, agora) },
  );
  await resolverAvisos({ usuarioId: s.user.id, eventos: EVENTOS_RESPONDER, refId: p.id });
  return { ok: true, versao };
}

/**
 * Aceite final: congela os valores da versão atual e a taxa da faixa (imóveis ativos do proprietário agora).
 * Se a candidatura ainda não estava aceita, este aceite vale como aceite dela (libera a identidade).
 */
async function aceitar(admin: Admin, p: LinhaProposta, v: LinhaVersao, papel: Autor): Promise<Resultado<{ fechamentoUrl?: string | null }>> {
  const agora = new Date();
  // A menor entre a taxa do envio e a do dono agora (faixa, queda de 30 dias, fixação do admin): nunca sobe depois
  // de enviada (complemento do prompt 27, parte B; especificação da taxa, R5).
  // Sem a taxa do envio, o aceite congelaria a de hoje (que pode ser maior): não aceita.
  const tx = await lerTaxaDaProposta(admin, p.id).catch(() => null);
  if (!tx) return { ok: false, error: MSG_TAXA_SEM_LEITURA };
  // Achado 83: o aceite congela a taxa; sem lê-la, não aceita.
  const hoje = await taxaDoDonoAgora(admin, p.owner_id, agora).catch(() => null);
  if (!hoje) return { ok: false, error: MSG_TAXA_SEM_LEITURA };
  const taxa = taxaEfetivaDaProposta(tx.taxa_no_envio, hoje.taxa);
  const origem = origemDaTaxaDaProposta(tx.taxa_no_envio, hoje);
  const { data: lead } = await admin.from("leads").select("id, status").eq("id", p.lead_id).maybeSingle();
  if (!lead || !["new", "accepted"].includes(lead.status as string)) return { ok: false, error: "Esta candidatura não está mais em andamento." };
  if (lead.status === "new" && !(await temDocumento(admin, p.owner_id)))
    return { ok: false, error: papel === "owner" ? MSG_DOCUMENTO.aceitar : "O proprietário ainda precisa completar o cadastro. Tente mais tarde." };
  // Disponibilidade por datas (0176): a entrada e os meses da versão aceita não podem cruzar outro contrato ativo.
  const conflito = await conflitoNoImovel(admin, p.property_id, periodoEmDias(String(v.data_entrada).slice(0, 10), diasDosTermos(termosDaLinha(v))));
  if (conflito) return { ok: false, error: conflito };

  const { data: ok } = await admin
    .from("propostas")
    // E722 (atrás da chave, desligada): 72 h corridas para concluir o contrato, limitadas pela data de entrada.
    .update({ status: "aceita", aceita_em: agora.toISOString(), taxa_congelada: taxa, taxa_origem: origem, atualizada_em: agora.toISOString(), ...(PRE_ACEITACAO_72H_ATIVA ? { pre_aceitacao_ate: prazoDaPreAceitacao(agora, String(v.data_entrada).slice(0, 10)).toISOString(), pre_aceitacao_reaberturas: 0 } : {}) })
    .eq("id", p.id)
    .eq("versao_atual", v.versao)
    .in("status", ["enviada", "vista", "contraproposta"])
    .select("id")
    .maybeSingle();
  if (!ok) return { ok: false, error: "A proposta mudou enquanto você respondia. Abra de novo." };

  // A taxa do contrato passa a ser a congelada no aceite da proposta (mesma regra de accepted_commission_rate).
  if (lead.status === "new") {
    await admin
      .from("leads")
      .update({
        status: "accepted",
        accepted_at: agora.toISOString(),
        decided_by: p.owner_id,
        accepted_plan: await planoDoProprietario(admin as never, p.owner_id),
        accepted_commission_rate: taxa,
        accepted_commission_origem: origem,
        accepted_commission_faixa: hoje.faixaNoFechamento.taxa,
      })
      .eq("id", p.lead_id)
      .eq("status", "new");
  } else {
    await admin
      .from("leads")
      .update({ accepted_commission_rate: taxa, accepted_commission_origem: origem, accepted_commission_faixa: hoje.faixaNoFechamento.taxa })
      .eq("id", p.lead_id)
      .eq("status", "accepted");
  }
  const tot = calcularTotais(termosDaLinha(v));
  // Item 34: o dono recebe a taxa congelada com a base escrita; o morador, nunca.
  const linhaTaxa = textoTaxaCongeladaParaDono(taxa, tot.valorMensal, tot.dias / 30, tx.taxa_no_envio);
  await avisarOutraParte(
    admin,
    p,
    papel,
    `Proposta ${p.numero} aceita. Total do contrato: ${contaDaProposta(termosDaLinha(v))}. Próximo passo: o fechamento.`,
    "proposta_respondida",
    linhaTaxa,
    undefined,
    { desfecho: "aceita", termos: termosDaLinha(v) },
    false,
  );
  // E205-B (b): o aceite manda DOIS e-mails, seja quem for que aceitou — ao dono ("Preparar o contrato", com a taxa
  // congelada) e ao morador (linha do tempo com os prazos que o sistema tem). Os dois com o quadro da negociação.
  await emailsDoAceite(admin, p, termosDaLinha(v), linhaTaxa);
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/fechamento");
  return { ok: true, fechamentoUrl: papel === "owner" ? `/dashboard/fechamento?c=${p.lead_id}` : null };
}

/**
 * E722 — reabre uma pré-aceitação que expirou (no máximo 2 vezes). Qualquer das duas partes pode pedir; quem perdeu a corrida só volta
 * por reabertura do DONO. A 3ª expiração encerra a candidatura (não reabre).
 * A taxa congelada na pré-aceitação CONTINUA VALENDO: a reabertura não a recalcula. Atrás de PRE_ACEITACAO_72H_ATIVA.
 */
export async function reabrirPreAceitacao(id: string): Promise<Resultado<{ prazoAte: string }>> {
  if (!PRE_ACEITACAO_72H_ATIVA) return { ok: false, error: "A pré-aceitação de 72 horas ainda não está ativa." };
  const s = await sessao();
  if (!s) return { ok: false, error: "Entre para reabrir." };
  const { data, error } = await s.supabase.from("propostas").select("id, owner_id, tenant_id, lead_id").eq("id", id).maybeSingle();
  if (error) return { ok: false, error: "Não foi possível ler a proposta agora. Tente de novo em instantes." };
  const p = data as { id: string; owner_id: string; tenant_id: string; lead_id: string } | null;
  if (!p || (p.owner_id !== s.user.id && p.tenant_id !== s.user.id)) return { ok: false, error: "Proposta não encontrada." };
  const r = await reabrirNoBanco(s.admin, p.id, p.owner_id === s.user.id ? "owner" : "tenant");
  if (!r.ok) return { ok: false, error: r.error };
  revalidatePath(`/dashboard/propostas/${p.id}`);
  revalidatePath("/dashboard/fechamento");
  return { ok: true, prazoAte: r.prazo.toISOString() };
}

/** E722: a janela de 72 h da proposta, pronta para a tela (data e hora exatas, regra de corrida, sem punição, taxa que continua). */
async function preAceitacaoDaProposta(admin: Admin, propostaId: string, papel: Autor): Promise<PreAceitacaoView | null> {
  const { data, error } = await admin.from("propostas").select("pre_aceitacao_ate, pre_aceitacao_reaberturas, pre_aceitacao_dono_ate, pre_aceitacao_encerrada_em, pre_aceitacao_perdeu_em").eq("id", propostaId).maybeSingle();
  const d = data as { pre_aceitacao_ate: string | null; pre_aceitacao_reaberturas: number | null; pre_aceitacao_dono_ate: string | null; pre_aceitacao_encerrada_em: string | null; pre_aceitacao_perdeu_em: string | null } | null;
  if (error || !d?.pre_aceitacao_ate) return null;
  const ate = new Date(d.pre_aceitacao_ate);
  const reaberturas = Number(d.pre_aceitacao_reaberturas ?? 0);
  const encerrada = !!d.pre_aceitacao_encerrada_em;
  const perdeu = !!d.pre_aceitacao_perdeu_em;
  const estado = estadoDaPreAceitacao(ate, new Date()).chave;
  return {
    estado,
    ateIso: ate.toISOString(),
    ateTexto: textoDoPrazo(ate),
    donoAteTexto: estado === "expirada" && !encerrada && d.pre_aceitacao_dono_ate ? textoDoPrazo(new Date(d.pre_aceitacao_dono_ate)) : null,
    encerrada,
    perdeuACorrida: perdeu,
    reaberturas,
    podeReabrir: podeReabrir(reaberturas) && !encerrada && (!perdeu || papel === "owner"),
    regraCorrida: TEXTO_REGRA_CORRIDA,
    semPunicao: TEXTO_SEM_PUNICAO,
    taxaContinua: TEXTO_TAXA_CONTINUA,
  };
}
