"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notifications";
import { escaparHtml } from "@/lib/escapar-html";
import type { NotificationEvent } from "@/lib/notifications/eventos-email";
import { guardContactInfo } from "@/lib/messages/contact-guard";
import { conversationId as idConversa } from "@/lib/messages/conversation-id";
import { nomeNaConversa } from "@/lib/perfil/perfil-publico";
import { planoDoProprietario } from "@/lib/data/plano-efetivo";
import { temDocumento } from "@/lib/data/documento-servidor";
import { MSG_DOCUMENTO } from "@/lib/documento-pessoa";
import { normalizarLimpezaEstadia } from "@/lib/anuncio/limpeza-estadia";
import { avisoAbaixoDoMinimo, normalizarNegociacao, descontoParaMeses, type Negociacao } from "@/lib/anuncio/negociacao";
import { taxaDoDonoAgora } from "@/lib/cobranca/taxa-servidor";
import { comissaoSobreContrato } from "@/lib/cobranca/regra";
import { conflitoNoImovel } from "@/lib/data/periodo-servidor";
import { periodoDaEstadia } from "@/lib/contrato-periodo";
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
}

async function lerImovel(admin: Admin, propertyId: string): Promise<ImovelProposta | null> {
  const { data } = await admin
    .from("properties")
    .select(
      "id, owner_id, title, monthly_price, min_period_days, max_period_days, max_guests, condo_fee, utilities_mode, utilities_estimate, prep_fee, checkout_cleaning_enabled, checkout_cleaning_fee, limpeza_estadia, negociacao",
    )
    .eq("id", propertyId)
    .maybeSingle();
  return (data as ImovelProposta | null) ?? null;
}

function limitesDoImovel(im: ImovelProposta) {
  const m = mesesDoAnuncio(im.min_period_days, im.max_period_days);
  return { mesesMin: m.min, mesesMax: m.max, capacidade: im.max_guests && im.max_guests > 0 ? im.max_guests : null };
}

/** Valores que a montagem abre preenchidos (do anúncio), todos editáveis pelo proprietário. */
function termosDoAnuncio(im: ImovelProposta, meses: number, dataEntrada: string, neg: Negociacao): TermosProposta {
  const limpeza = normalizarLimpezaEstadia(im.limpeza_estadia);
  const porMes = limpeza?.porMes ?? 0;
  return {
    valorBase: Number(im.monthly_price) || 0,
    descontoPct: 0,
    descontoValor: 0,
    motivoDesconto: null,
    descontoEstadiaPct: descontoParaMeses(neg.descontos, meses),
    meses,
    dataEntrada,
    condominio: Number(im.condo_fee) || 0,
    consumo: im.utilities_mode === "fixed" ? Number(im.utilities_estimate) || 0 : 0,
    limpezasMes: porMes,
    valorLimpeza: porMes > 0 && limpeza ? Math.round((limpeza.valorMes / porMes) * 100) / 100 : 0,
    taxaPet: 0,
    limpezaUnica: (Number(im.prep_fee) || 0) + (im.checkout_cleaning_enabled ? Number(im.checkout_cleaning_fee) || 0 : 0),
  };
}

async function nomeDe(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  const n = (data?.full_name as string | undefined) ?? null;
  return n && !n.includes("@") ? n : null;
}

/** Cartão da proposta na conversa + aviso no site/app/e-mail à outra parte. Best-effort: nunca quebra o fluxo. */
async function avisarOutraParte(
  admin: Admin,
  p: Pick<LinhaProposta, "id" | "numero" | "owner_id" | "tenant_id" | "property_id">,
  de: Autor,
  texto: string,
  evento: NotificationEvent,
  /** Só vai no e-mail quando o destino é o DONO (a taxa nunca chega ao morador — especificação da taxa, R8). */
  detalhesSoDono?: string,
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
  try {
    const { data: d } = await admin.from("profiles").select("email, full_name").eq("id", destino).maybeSingle();
    await notify({
      event: evento,
      email: (d?.email as string | undefined) ?? undefined,
      name: (d?.full_name as string | undefined) ?? undefined,
      userId: destino,
      pushUrl: `/dashboard/propostas/${p.id}`,
      subject: evento === "proposta_recebida" ? `Proposta ${p.numero}` : `Proposta ${p.numero} respondida`,
      ...(detalhesSoDono && destino === p.owner_id ? { detailsHtml: `<p>${escaparHtml(detalhesSoDono)}</p>` } : {}),
    });
  } catch {
    /* notificação nunca quebra o fluxo */
  }
  revalidatePath("/dashboard/orcamentos");
  revalidatePath(`/dashboard/propostas/${p.id}`);
  revalidatePath("/dashboard/mensagens");
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
  const { data } = await s.supabase
    .from("leads")
    .select("id, status, tenant_id, property_id, property:properties!leads_property_id_fkey ( title )")
    .eq("owner_id", s.user.id)
    .in("status", ["new", "accepted"])
    .order("created_at", { ascending: false })
    .limit(100);
  const linhas = (data ?? []) as unknown as { id: string; status: string; tenant_id: string; property_id: string; property: { title: string | null } | null }[];
  if (!linhas.length) return [];
  const { data: abertas } = await s.admin
    .from("propostas")
    .select("lead_id")
    .in("lead_id", linhas.map((l) => l.id))
    .in("status", ["enviada", "vista", "contraproposta"]);
  const comAberta = new Set(((abertas ?? []) as { lead_id: string }[]).map((a) => a.lead_id));
  const out: InteressadoParaProposta[] = [];
  for (const l of linhas) {
    const aceito = l.status === "accepted";
    out.push({
      leadId: l.id,
      nome: nomeNaConversa({ papel: "proprietario", nomeCompleto: aceito ? await nomeDe(s.admin, l.tenant_id) : null, aceito }),
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
  limites: { mesesMin: number; mesesMax: number; capacidade: number | null };
  negociacao: Negociacao;
  /** Taxa de serviço prevista (só o proprietário vê). */
  taxa: number;
}

/** Valores do anúncio para abrir a montagem preenchida (só o dono do interessado). */
export async function dadosNovaProposta(leadId: string): Promise<DadosMontagem | null> {
  const s = await sessao();
  if (!s) return null;
  const { data: lead } = await s.admin.from("leads").select("id, owner_id, tenant_id, property_id, status, inicio_desejado").eq("id", leadId).maybeSingle();
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
    interessado: nomeNaConversa({ papel: "proprietario", nomeCompleto: aceito ? await nomeDe(s.admin, lead.tenant_id as string) : null, aceito }),
    imovel: { id: im.id, titulo: im.title },
    termos: termosDoAnuncio(im, Math.min(lim.mesesMax, Math.max(lim.mesesMin, 4)), entrada, neg),
    limites: lim,
    negociacao: neg,
    taxa: (await taxaDoDonoAgora(s.admin, s.user.id)).taxa,
  };
}

export interface EntradaProposta {
  leadId: string;
  valorBase: number;
  descontoPct?: number;
  descontoValor?: number;
  motivoDesconto?: string | null;
  meses: number;
  dataEntrada: string;
  condominio?: number;
  consumo?: number;
  limpezasMes?: number;
  valorLimpeza?: number;
  taxaPet?: number;
  limpezaUnica?: number;
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
  if (!(await temDocumento(s.admin, s.user.id))) return { ok: false, error: MSG_DOCUMENTO.aceitar };
  if (!VALIDADES_DIAS.includes(Number(e.validadeDias) as 3 | 7 | 15)) return { ok: false, error: "Escolha a validade: 3, 7 ou 15 dias." };

  const im = await lerImovel(s.admin, lead.property_id as string);
  if (!im || im.owner_id !== s.user.id) return { ok: false, error: "Imóvel não encontrado." };
  const neg = normalizarNegociacao(im.negociacao);
  const meses = Math.round(num(e.meses));
  const termos: TermosProposta = {
    valorBase: Math.round(num(e.valorBase) * 100) / 100,
    descontoPct: Math.round(num(e.descontoPct) * 100) / 100,
    descontoValor: Math.round(num(e.descontoValor) * 100) / 100,
    motivoDesconto: e.motivoDesconto ? String(e.motivoDesconto).slice(0, 80) : null,
    descontoEstadiaPct: descontoParaMeses(neg.descontos, meses),
    meses,
    dataEntrada: String(e.dataEntrada ?? ""),
    condominio: num(e.condominio),
    consumo: num(e.consumo),
    limpezasMes: Math.round(num(e.limpezasMes)),
    valorLimpeza: num(e.valorLimpeza),
    taxaPet: num(e.taxaPet),
    limpezaUnica: num(e.limpezaUnica),
  };
  const pessoas = e.pessoas == null ? null : Math.round(num(e.pessoas)) || null;
  const erro = validarTermos(termos, limitesDoImovel(im), hojeBR(), pessoas);
  if (erro) return { ok: false, error: erro };

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
      taxa_no_envio: (await taxaDoDonoAgora(s.admin, s.user.id)).taxa,
    })
    .select(COLUNAS_PROPOSTA)
    .single();
  if (eP || !p) {
    if (eP?.code === "23505") return { ok: false, error: "Já há uma proposta em andamento com este interessado." };
    return { ok: false, error: "Não foi possível enviar a proposta." };
  }
  const mensagem = e.mensagem ? guardContactInfo(String(e.mensagem).slice(0, MENSAGEM_MAX)).text : null;
  const { error: eV } = await s.admin.from("proposta_versoes").insert(linhaDaVersao(p.id as string, 1, "owner", termos, pessoas, mensagem));
  if (eV) {
    await s.admin.from("propostas").delete().eq("id", p.id);
    return { ok: false, error: "Não foi possível enviar a proposta." };
  }
  const tot = calcularTotais(termos);
  await avisarOutraParte(
    s.admin,
    p as LinhaProposta,
    "owner",
    `Proposta ${numero} enviada: ${brl(tot.valorMensal)}/mês × ${termos.meses} ${termos.meses === 1 ? "mês" : "meses"}, total do contrato ${brl(tot.totalContrato)}.`,
    "proposta_recebida",
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

export interface PropostaView {
  id: string;
  numero: string;
  status: StatusProposta;
  papel: Autor;
  leadId: string;
  imovel: { id: string; titulo: string };
  outraParte: string;
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
  meses: number;
  validaAte: string;
  versaoAtual: number;
  /** Aberta e esperando a resposta desta pessoa (prompt 27). */
  aguardandoVoce: boolean;
}

async function nomeOutraParte(admin: Admin, p: LinhaProposta, papel: Autor): Promise<string> {
  if (papel === "owner") {
    const { data: lead } = await admin.from("leads").select("status").eq("id", p.lead_id).maybeSingle();
    const aceito = lead?.status === "accepted";
    return nomeNaConversa({ papel: "proprietario", nomeCompleto: aceito ? await nomeDe(admin, p.tenant_id) : null, aceito });
  }
  return nomeNaConversa({ papel: "inquilino", nomeCompleto: await nomeDe(admin, p.owner_id), aceito: true });
}

/** Lista de Orçamentos: as propostas em que a pessoa é parte (dono ou interessado). */
export async function listarPropostas(): Promise<PropostaResumo[]> {
  const s = await sessao();
  if (!s) return [];
  await expirarVencidas(s.admin, s.user.id);
  // RLS: só as propostas das partes.
  const { data } = await s.supabase.from("propostas").select(COLUNAS_PROPOSTA).order("atualizada_em", { ascending: false }).limit(200);
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
    out.push({
      id: p.id,
      numero: p.numero,
      status: p.status,
      papel,
      imovel: titulo.get(p.property_id) ?? "Imóvel",
      outraParte: await nomeOutraParte(s.admin, p, papel),
      totalContrato: Number(v.total_contrato),
      valorMensal: Number(v.valor_mensal),
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
    const tx = await lerTaxaDaProposta(s.admin, p.id);
    const congelada = tx.taxa_congelada != null;
    const hoje = congelada ? null : (await taxaDoDonoAgora(s.admin, s.user.id)).taxa;
    const pct = congelada ? (tx.taxa_congelada as number) : (tx.taxa_no_envio ?? (hoje as number));
    taxa = {
      pct,
      valor: comissaoSobreContrato(atual.totais.valorMensal, atual.termos.meses, pct),
      congelada,
      valorMensal: atual.totais.valorMensal,
      meses: atual.termos.meses,
      seAceitaHoje: !congelada && hoje != null ? textoSeAceitaHoje(tx.taxa_no_envio, hoje) : null,
      caiu: congelada ? avisoTaxaCaiu(tx.taxa_no_envio, tx.taxa_congelada as number) : null,
    };
  }
  return {
    id: p.id,
    numero: p.numero,
    status: p.status,
    papel,
    leadId: p.lead_id,
    imovel: { id: p.property_id, titulo: im?.title ?? "Imóvel" },
    outraParte: await nomeOutraParte(s.admin, p, papel),
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
    await avisarOutraParte(s.admin, p, papel, `Proposta ${p.numero} recusada. Motivo: ${motivo}.${texto ? ` ${texto}` : ""}`, "proposta_respondida");
    return { ok: true };
  }

  if (r.acao === "aceitar") return aceitar(s.admin, p, v, papel);

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
    const { data: lim } = await s.admin.from("property_negociacao_limites").select("valor_minimo, limpezas_max").eq("property_id", im.id).maybeSingle();
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
  const { error: eV } = await s.admin.from("proposta_versoes").insert(linhaDaVersao(p.id, versao, papel, nova, v.pessoas, mensagem));
  if (eV) return { ok: false, error: eV.code === "23505" ? "A proposta mudou enquanto você respondia. Abra de novo." : "Não foi possível enviar a contraproposta." };
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
    `Contraproposta ${p.numero} (versão ${versao}): ${brl(tot.valorMensal)}/mês × ${nova.meses} ${nova.meses === 1 ? "mês" : "meses"}, total ${brl(tot.totalContrato)}.${mensagem ? ` ${mensagem}` : ""}`,
    "proposta_recebida",
  );
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
  const tx = await lerTaxaDaProposta(admin, p.id);
  const hoje = await taxaDoDonoAgora(admin, p.owner_id, agora);
  const taxa = taxaEfetivaDaProposta(tx.taxa_no_envio, hoje.taxa);
  const origem = origemDaTaxaDaProposta(tx.taxa_no_envio, hoje);
  const { data: lead } = await admin.from("leads").select("id, status").eq("id", p.lead_id).maybeSingle();
  if (!lead || !["new", "accepted"].includes(lead.status as string)) return { ok: false, error: "Esta candidatura não está mais em andamento." };
  if (lead.status === "new" && !(await temDocumento(admin, p.owner_id)))
    return { ok: false, error: papel === "owner" ? MSG_DOCUMENTO.aceitar : "O proprietário ainda precisa completar o cadastro. Tente mais tarde." };
  // Disponibilidade por datas (0176): a entrada e os meses da versão aceita não podem cruzar outro contrato ativo.
  const conflito = await conflitoNoImovel(admin, p.property_id, periodoDaEstadia(String(v.data_entrada).slice(0, 10), Number(v.meses)));
  if (conflito) return { ok: false, error: conflito };

  const { data: ok } = await admin
    .from("propostas")
    .update({ status: "aceita", aceita_em: agora.toISOString(), taxa_congelada: taxa, taxa_origem: origem, atualizada_em: agora.toISOString() })
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
  const linhaTaxa = textoTaxaCongeladaParaDono(taxa, tot.valorMensal, Number(v.meses), tx.taxa_no_envio);
  await avisarOutraParte(
    admin,
    p,
    papel,
    `Proposta ${p.numero} aceita: ${brl(tot.valorMensal)}/mês × ${v.meses} ${Number(v.meses) === 1 ? "mês" : "meses"}, total ${brl(tot.totalContrato)}. Próximo passo: o fechamento.`,
    "proposta_respondida",
    linhaTaxa,
  );
  if (papel === "owner") {
    // Quem aceitou foi o próprio dono: o aviso acima foi ao morador (sem taxa); o dono recebe o dele.
    try {
      const { data: d } = await admin.from("profiles").select("email, full_name").eq("id", p.owner_id).maybeSingle();
      await notify({
        event: "proposta_respondida",
        email: (d?.email as string | undefined) ?? undefined,
        name: (d?.full_name as string | undefined) ?? undefined,
        userId: p.owner_id,
        pushUrl: `/dashboard/propostas/${p.id}`,
        subject: `Proposta ${p.numero} aceita`,
        detailsHtml: `<p>${escaparHtml(linhaTaxa)}</p>`,
      });
    } catch {
      /* notificação nunca quebra o fluxo */
    }
  }
  revalidatePath("/dashboard/leads");
  revalidatePath("/dashboard/fechamento");
  return { ok: true, fechamentoUrl: papel === "owner" ? `/dashboard/fechamento?c=${p.lead_id}` : null };
}
