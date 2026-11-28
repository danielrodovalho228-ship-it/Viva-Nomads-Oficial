"use server";

import { after } from "next/server";
// E1044: as listas de pagamentos do contrato com ordem fixa (como o admin).
import { ordenarPagamentos } from "@/lib/pagamentos/ordem-pagamentos";
import { anuladosAntesDaConfirmacao, linhaDoAnulado, type AnuladoAntesDaConfirmacao } from "@/lib/anulados-antes-da-confirmacao";
import { numeroPublicoContrato } from "@/lib/contrato-ref";
import { createClient } from "@/lib/supabase/server";
import { usuarioDaLeitura } from "@/lib/supabase/usuario-da-leitura";
import { createAdminClient } from "@/lib/supabase/admin";
import { emitirDoPagamentoComRegistro } from "@/lib/fiscal/emitir";
import { listMyProperties } from "@/lib/data/properties";
import { erroBancoPT } from "@/lib/erros-banco";
import { taxaDosContratosDoDono } from "@/lib/data/taxa-dono-servidor";
import type { EtapaContrato } from "@/lib/contrato-etapas";
import { estadoDoContratoUnico, type ChaveEstado, type EstadoContrato, type LinhaEstadoContrato } from "@/lib/contrato-estado";
import { podeAvaliarLocacao } from "@/lib/contrato-assinar";
import { rotuloPagamentoBloco } from "@/lib/pagamento-bloco";
import { acertoMaisRecente, estadoCaucao, type EstadoCaucao } from "@/lib/caucao-estado";
import { componentesDoPagamento, emAbertoNoBloco, encargosDosComponentes, parteDaColuna, proximaParte, somarComponentes, type ComponentesBloco } from "@/lib/pagamento-componentes";
import { componentesDosContratos } from "@/lib/data/contrato-componentes";
import { MSG_CAUCAO_ESCOLHA_O_BLOCO, MSG_CAUCAO_NADA_NO_BLOCO, MSG_CAUCAO_SEM_CAUCAO, MSG_CAUCAO_SEM_CONTA, linhasDaCaucaoPorBloco, msgCaucaoPassa, msgCaucaoRegistreAntes } from "@/lib/caucao-teto";

/**
 * Contratos & blocos do PROPRIETÁRIO + registro DECLARATÓRIO de pagamento
 * (Dashboard Fase 4).
 *
 * REGRA DE OURO: a plataforma NÃO movimenta dinheiro. Aqui o proprietário só
 * DOCUMENTA que recebeu o aluguel (direto do inquilino, fora da plataforma) e o
 * inquilino confirma. Nada é capturado — o registro vira histórico do contrato
 * (base do futuro dossiê). Nenhuma integração de pagamento.
 */

type ActionResult = { ok: boolean; demo?: boolean; id?: string; error?: string; jaRegistrado?: boolean; mensagem?: string };
/** Segundo envio do mesmo recebimento (0182): devolve o que já existe, sem erro técnico. */
const MSG_JA_REGISTRADO = "Este recebimento já foi registrado";
/** E1072 (fatia 2): o registro complementar não pode passar do que o contrato diz que falta no bloco. */
const MSG_PASSA_DO_QUE_FALTA = "O valor passa do que falta registrar neste bloco.";

/** Colunas de `contratos` que as partes leem pela sessão (sem a taxa — 0177). */
const COLUNAS_CONTRATO_PARTES =
  "id, property_id, tenant_id, lead_id, status, periodo, aluguel_mensal, prazo_total_dias, tamanho_bloco_meses, qtd_ocupantes, created_at, encerrado_em, assinado_proprietario_em, assinado_inquilino_em, garantia";

/** O acerto da devolução vem junto (o RLS deixa as partes lerem): entra no estado único da caução. */
const ACERTOS_CAUCAO = "caucao_acertos(status, valor_devolvido, created_at)";

/** Estado único da caução (L2-B, item 13) a partir da linha do banco. */
function caucaoDaLinha(c: Record<string, unknown>, blocos: { caucao: number; caucaoStatus: string }[], pagamentos: PagamentoView[]): EstadoCaucao {
  const acerto = acertoMaisRecente((c.caucao_acertos as { status: string; valor_devolvido: number | null; created_at: string }[] | null) ?? []);
  return estadoCaucao({
    garantia: (c.garantia as string | null) ?? null,
    blocos,
    pagamentos,
    acerto: acerto ? { status: acerto.status, valorDevolvido: acerto.valor_devolvido } : null,
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface BlocoView {
  /** E1072: o que o contrato diz que o bloco custa (aluguel, contas do período, limpeza de preparação). */
  componentes?: ComponentesBloco;
  id: string;
  numeroBloco: number;
  inicio: string;
  fim: string;
  meses: number;
  valor: number;
  caucao: number;
  caucaoForma: string;
  caucaoStatus: string;
  status: string;
}

export interface PagamentoView {
  /** E1072: o que este registro cobre (o aluguel + as contas e a limpeza registradas com ele). */
  componentes?: ComponentesBloco;
  /** E1072 (fatia 2): 2 em diante = registro complementar do mesmo bloco. */
  parte?: number;
  id: string;
  /** null na Caução: ela é do contrato, não do bloco (0182). */
  blocoId: string | null;
  tipo: string;
  valor: number;
  forma: string;
  dataPagamento: string;
  confirmado: boolean;
  observacao: string | null;
  /** Rótulo único: "Bloco 1 (2 meses: 19/10 a 18/12) — R$ 6.400 (2 × R$ 3.200)" (jornada de assinatura, 19/10). */
  rotulo: string;
}

export interface ContratoView {
  id: string;
  propertyId: string;
  propertyTitle: string;
  tenantId: string;
  city: string;
  aluguelMensal: number;
  prazoTotalDias: number;
  tamanhoBlocoMeses: number;
  comissaoValor: number; // taxa × valor total (aluguel × meses), UMA vez (snapshot no fechamento)
  comissaoPercent: number; // 0..1 — taxa aplicada (para exibir "X% do valor total")
  /** Prompt 23: data do aceite da candidatura (a base da taxa segue a regra vigente nesse dia). */
  aceiteEm?: string | null;
  qtdOcupantes: number;
  status: string;
  /** F33: etapa real (assinatura → 1º pagamento → vigência); só vale com status "ativo". */
  etapa: EtapaContrato;
  /** Estado da fonte única (selo igual ao do detalhe e da carteira), visão do proprietário. */
  estado: EstadoContrato;
  criadoEm: string;
  blocos: BlocoView[];
  pagamentos: PagamentoView[];
  /** E1241: os anulados antes da confirmação, só para a linha com o selo (fora dos totais). */
  anuladosPendentes: AnuladoAntesDaConfirmacao[];
  /** Estado único da caução (o mesmo da Garantias e da tela do inquilino). */
  caucao: EstadoCaucao;
  /** E544: janela de avaliação aberta (contrato encerrado há até 14 dias) — a mesma regra do servidor (0089). */
  podeAvaliar: boolean;
  /** E544: fim do contrato para o prazo da avaliação — o encerramento ou, antes dele, o fim do último bloco. */
  fimParaAvaliacao: string | null;
  /** E719: estado REAL da avaliação que EU fiz deste contrato (enviada, publicada, em_moderacao, removida); null = ainda não avaliei. */
  minhaAvaliacao: string | null;
}

function toBloco(b: Record<string, unknown>): BlocoView {
  return {
    id: String(b.id),
    numeroBloco: Number(b.numero_bloco),
    inicio: String(b.inicio),
    fim: String(b.fim),
    meses: Number(b.meses),
    valor: Number(b.valor),
    caucao: Number(b.caucao),
    caucaoForma: String(b.caucao_forma ?? "avista"),
    caucaoStatus: String(b.caucao_status ?? "pendente"),
    status: String(b.status ?? "agendado"),
  };
}

function toPagamento(p: Record<string, unknown>, valorMensal: number | null, prazoTotalDias: number): PagamentoView {
  // ORDEM-DUET-1104: a parte é a da coluna registada (0348), nunca a ordem dos registros.
  const parte = String(p.tipo ?? "aluguel") === "caucao" ? 1 : parteDaColuna(p.parte);
  const componentes = componentesDoPagamento({ valor: Number(p.valor), encargos: String(p.tipo ?? "aluguel") === "caucao" ? [] : p.encargos });
  const b = p.contrato_blocos as { numero_bloco?: number | null; meses?: number | null; inicio?: string | null; fim?: string | null } | null | undefined;
  return {
    rotulo: rotuloPagamentoBloco({
      tipo: String(p.tipo ?? "aluguel"),
      valor: Number(p.valor),
      bloco: b?.numero_bloco ? { numero: Number(b.numero_bloco), meses: Number(b.meses ?? 1), inicio: b.inicio ?? null, fim: b.fim ?? null } : null,
      valorMensal: valorMensal ?? null,
      parte,
      total: componentes.total,
      // E1067 (fusão): o prazo do contrato decide "em dias"; a página do contrato leva a conta (ORDEM-DUET-1140, decisão 2).
      prazoTotalDias,
      comConta: true,
    }),
    componentes,
    parte,
    id: String(p.id),
    blocoId: p.bloco_id ? String(p.bloco_id) : null,
    tipo: String(p.tipo ?? "aluguel"),
    valor: Number(p.valor),
    forma: String(p.forma ?? "pix"),
    dataPagamento: String(p.data_pagamento),
    confirmado: Boolean(p.confirmado_pelo_inquilino),
    observacao: (p.observacao as string | null) ?? null,
  };
}

/** Estado pela fonte única, a partir da linha do banco (com pagamentos_bloco). */
function estadoDaLinha(c: Record<string, unknown>, papel: "inquilino" | "proprietario"): EstadoContrato {
  return estadoDoContratoUnico(c as LinhaEstadoContrato, papel);
}

/** Prompt 28: estado REAL de um contrato (o RLS deixa as duas partes lerem), para o Resumo do fechamento. */
export interface EstadoContratoView {
  id: string;
  chave: ChaveEstado;
  texto: string;
  /** Ainda falta alguma assinatura. */
  assinando: boolean;
  criadoEm: string;
}

export async function lerEstadoDoContrato(contratoId: string, papel: "inquilino" | "proprietario"): Promise<EstadoContratoView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(String(contratoId))) return null;
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("contratos")
    .select("id, status, periodo, created_at, assinado_proprietario_em, assinado_inquilino_em, pagamentos_bloco(*)")
    .eq("id", contratoId)
    .maybeSingle();
  // Achado 106: a falha LANÇA (o Fechamento já trata) — nunca "contrato não existe" logo depois de registrá-lo.
  if (error) throw new Error("Não foi possível ler o estado do contrato.");
  if (!data) return null;
  const e = estadoDaLinha(data as Record<string, unknown>, papel);
  return { id: String(data.id), chave: e.chave, texto: e.selo, assinando: e.etapa === "aguardando_assinatura", criadoEm: String(data.created_at) };
}

/** Contrato do INQUILINO (prompt 28): a seção "Contratos" — aguardando assinatura ainda não é locação. */
export interface ContratoInquilinoView {
  id: string;
  numero: string;
  propertyTitle: string;
  aluguelMensal: number;
  chave: ChaveEstado;
  texto: string;
  faltaVoce: boolean;
  assinando: boolean;
  criadoEm: string;
}

const MSG_CONTRATOS_NAO_CARREGARAM = "Não foi possível carregar os seus contratos agora.";

/** Auditoria de erros e estados vazios, achado nº 7: com `exigir` (a tela da lista), a falha do banco LANÇA — o painel
 * mostra "Não conseguimos abrir esta tela" com "Tentar de novo" — em vez de dizer "nenhum". Sem `exigir` (home, ganhos,
 * garantias, carteira), segue a lista vazia. */
export async function getContratosDoInquilino(opcoes: { exigir?: boolean } = {}): Promise<ContratoInquilinoView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("contratos")
    .select("id, status, periodo, aluguel_mensal, created_at, assinado_proprietario_em, assinado_inquilino_em, properties(title), pagamentos_bloco(*)")
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });
  if (error && opcoes.exigir) throw new Error(MSG_CONTRATOS_NAO_CARREGARAM);
  return ((data ?? []) as Record<string, unknown>[]).map((c) => {
    const e = estadoDaLinha(c, "inquilino");
    return {
      id: String(c.id),
      numero: numeroPublicoContrato(String(c.id)),
      propertyTitle: (c.properties as { title?: string } | null)?.title ?? "Imóvel",
      aluguelMensal: Number(c.aluguel_mensal),
      chave: e.chave,
      texto: e.selo,
      faltaVoce: e.faltaVoce,
      assinando: e.etapa === "aguardando_assinatura",
      criadoEm: String(c.created_at),
    };
  });
}

/** Quantos contratos esperam a assinatura do inquilino (o número no menu "Contratos"). */
export async function contarContratosParaAssinar(): Promise<number> {
  return (await getContratosDoInquilino()).filter((c) => c.faltaVoce).length;
}

/** Locação do INQUILINO (visão simplificada) para avaliar o proprietário. */
export interface LocacaoView {
  id: string; // contrato_id
  /** E680: a conta para quem a lista foi montada (o cliente só mostra a lista da conta que está nele). */
  paraUsuario?: string;
  propertyId: string;
  propertyTitle: string;
  ownerId: string;
  aluguelMensal: number;
  status: string;
  etapa: EtapaContrato;
  /** Estado da fonte única, visão do inquilino. */
  estado: EstadoContrato;
  criadoEm: string;
  /** Janela de avaliação aberta (contrato encerrado há até 14 dias). Nunca em contrato aguardando assinatura. */
  podeAvaliar: boolean;
  /** Fim do contrato (dá o prazo da avaliação, Prompt 43). */
  encerradoEm: string | null;
  /** E719: estado REAL da avaliação que EU fiz desta locação (enviada, publicada, em_moderacao, removida); null = ainda não avaliei. */
  minhaAvaliacao: string | null;
  /** Pagamentos registrados pelo proprietário (o inquilino confirma → recibo). */
  pagamentos: PagamentoView[];
  /** E1241: os anulados antes da confirmação, só para a linha com o selo (fora dos totais). */
  anuladosPendentes: AnuladoAntesDaConfirmacao[];
  /** Valor e estado da caução, pela mesma função dos Contratos e da Garantias (L2-B, item 12). */
  caucao: EstadoCaucao;
}

/**
 * Minhas locações (visão do INQUILINO): contratos onde tenant_id = eu, com o
 * proprietário do imóvel (para avaliar). Best-effort: [] em demo/sem sessão.
 */
/**
 * E719: o estado real da avaliação que a pessoa fez de cada contrato (a mais recente que não é rascunho). Sem isso o
 * cartão do contrato só sabia "enviei nesta visita" e seguia dizendo "Aguardando a outra parte" depois de publicada.
 * Falha de leitura: sem mapa (o cartão cai no comportamento anterior), nunca "não avaliei" inventado.
 */
async function avaliacoesMinhasPorContrato(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, userId: string, contratoIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (contratoIds.length === 0) return mapa;
  const { data, error } = await supabase
    .from("avaliacoes")
    .select("contrato_id, status, criado_em")
    .eq("autor_id", userId)
    .in("contrato_id", contratoIds)
    .neq("status", "rascunho")
    .order("criado_em", { ascending: true });
  if (error) return mapa;
  for (const l of (data ?? []) as { contrato_id: string; status: string }[]) mapa.set(l.contrato_id, l.status);
  return mapa;
}

const MSG_LOCACOES_NAO_CARREGARAM = "Não foi possível carregar as suas locações agora.";

/** Auditoria de erros e estados vazios, achado nº 6: com `exigir` (a tela da lista), a falha do banco LANÇA — o painel
 * mostra "Não conseguimos abrir esta tela" com "Tentar de novo" — em vez de dizer "nenhuma". Sem `exigir` (contadores,
 * home, notificações), segue a lista vazia. */
export async function getMinhasLocacoes(opcoes: { exigir?: boolean } = {}): Promise<LocacaoView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const user = await usuarioDaLeitura(supabase, opcoes);
  if (!user) return [];

  const { data, error } = await supabase
    .from("contratos")
    .select(`id, property_id, aluguel_mensal, status, periodo, created_at, encerrado_em, assinado_proprietario_em, assinado_inquilino_em, garantia, prazo_total_dias, properties(title, owner_id), contrato_blocos(caucao, caucao_status), pagamentos_bloco(*, contrato_blocos(numero_bloco, meses, inicio, fim)), ${ACERTOS_CAUCAO}`)
    .eq("tenant_id", user.id)
    .order("created_at", { ascending: false });
  if (error && opcoes.exigir) throw new Error(MSG_LOCACOES_NAO_CARREGARAM);

  // E182 (QA 25/10): o RLS de properties só mostra ao morador os imóveis ATIVOS — de um imóvel pausado ou encerrado o
  // join volta vazio e o cartão virava "Imóvel". Para os contratos DELE (tenant_id = eu, já filtrados acima), o
  // servidor lê só o título e o dono desses imóveis.
  const linhas = (data ?? []) as Record<string, unknown>[];
  const semTitulo = [...new Set(linhas.filter((c) => !(c.properties as { title?: string } | null)?.title).map((c) => String(c.property_id)))];
  const doServidor = new Map<string, { title?: string; owner_id?: string }>();
  if (semTitulo.length) {
    const admin = createAdminClient();
    const { data: props } = admin ? await admin.from("properties").select("id, title, owner_id").in("id", semTitulo) : { data: null };
    for (const pr of (props ?? []) as { id: string; title: string | null; owner_id: string | null }[]) doServidor.set(pr.id, { title: pr.title ?? undefined, owner_id: pr.owner_id ?? undefined });
  }

  const minhasAvaliacoes = await avaliacoesMinhasPorContrato(supabase, user.id, linhas.map((c) => String(c.id)));
  return linhas.map((c) => {
    const prop = (c.properties as { title?: string; owner_id?: string } | null)?.title ? (c.properties as { title?: string; owner_id?: string }) : (doServidor.get(String(c.property_id)) ?? {});
    const pagamentos = ordenarPagamentos(((c.pagamentos_bloco as Record<string, unknown>[]) ?? []).filter((pg) => !pg.anulado_em)).map((pg) => toPagamento(pg, Number(c.aluguel_mensal), Number(c.prazo_total_dias)));
    const estado = estadoDaLinha(c, "inquilino");
    return {
      id: String(c.id),
      paraUsuario: user.id,
      propertyId: String(c.property_id),
      propertyTitle: prop.title ?? "Imóvel",
      ownerId: String(prop.owner_id ?? ""),
      aluguelMensal: Number(c.aluguel_mensal),
      status: String(c.status ?? "ativo"),
      etapa: estado.etapa ?? "em_vigencia",
      estado,
      criadoEm: String(c.created_at),
      podeAvaliar: podeAvaliarLocacao(String(c.status ?? "ativo"), (c.encerrado_em as string | null) ?? null),
      encerradoEm: (c.encerrado_em as string | null) ?? null,
      minhaAvaliacao: minhasAvaliacoes.get(String(c.id)) ?? null,
      pagamentos,
      anuladosPendentes: anuladosAntesDaConfirmacao(ordenarPagamentos((c.pagamentos_bloco as Record<string, unknown>[]) ?? []), linhaDoAnulado),
      caucao: caucaoDaLinha(
        c,
        ((c.contrato_blocos as Record<string, unknown>[]) ?? []).map((b) => ({ caucao: Number(b.caucao) || 0, caucaoStatus: String(b.caucao_status ?? "pendente") })),
        pagamentos,
      ),
    };
  });
}

/**
 * Contratos do proprietário (contrato-mãe + blocos + pagamentos declarados).
 * Filtra pelos imóveis DELE (a RLS também restringe às partes do contrato).
 * Roda a checagem lazy do ciclo de blocos antes de listar. Best-effort: [] em
 * demo/sem sessão.
 */
/** Auditoria de erros e estados vazios, achado nº 7: com `exigir` (a tela da lista), a falha do banco LANÇA — o painel
 * mostra "Não conseguimos abrir esta tela" com "Tentar de novo" — em vez de dizer "nenhum". Sem `exigir` (home, ganhos,
 * garantias, carteira), segue a lista vazia. */
export async function getMeusContratos(opcoes: { exigir?: boolean } = {}): Promise<ContratoView[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Avança o ciclo de blocos (encerramento por não-renovação etc.) — o pg_cron
  // cobre quando ninguém abre o painel. Best-effort.
  try {
    await createAdminClient()?.rpc("avancar_ciclo_blocos"); // só o servidor executa (0070)
  } catch {
    /* best-effort */
  }

  const props = await listMyProperties({ exigir: opcoes.exigir });
  const ids = props.map((p) => p.id).filter((id) => UUID_RE.test(id));
  if (ids.length === 0) return [];
  const titleById = new Map(props.map((p) => [p.id, { title: p.title, city: p.city }]));

  // Lista fechada de colunas: a taxa (comissao_*) não sai mais pela API (0177) e vem do servidor logo abaixo.
  const { data, error } = await supabase
    .from("contratos")
    .select(`${COLUNAS_CONTRATO_PARTES}, contrato_blocos(*), pagamentos_bloco(*, contrato_blocos(numero_bloco, meses, inicio, fim)), ${ACERTOS_CAUCAO}`)
    .in("property_id", ids)
    .order("created_at", { ascending: false });
  if (error && opcoes.exigir) throw new Error(MSG_CONTRATOS_NAO_CARREGARAM);

  const contratos = (data ?? []) as unknown as Record<string, unknown>[];
  // A taxa de cada contrato, lida com o cliente de serviço só para imóveis DESTE dono.
  const admin = createAdminClient();
  // Achado 80: com `exigir` (telas Contratos, Garantias, Carteira), a taxa que não foi lida derruba a tela com o aviso
  // de "Tentar de novo" — nunca "taxa R$ 0".
  const taxas = admin
    ? await taxaDosContratosDoDono(admin, user.id, contratos.map((c) => String(c.id))).catch((e: unknown) => {
        if (opcoes.exigir) throw new Error(MSG_CONTRATOS_NAO_CARREGARAM, { cause: e });
        return new Map<string, { comissaoValor: number; comissaoPercent: number }>();
      })
    : new Map();
  // Data do aceite de cada candidatura (o RLS deixa o dono ler as próprias).
  const leadIds = [...new Set(contratos.map((c) => c.lead_id).filter((x): x is string => typeof x === "string"))];
  const { data: leads } = leadIds.length
    ? await supabase.from("leads").select("id, accepted_at").in("id", leadIds)
    : { data: [] as { id: string; accepted_at: string | null }[] };
  const aceiteDoLead = new Map(((leads ?? []) as { id: string; accepted_at: string | null }[]).map((l) => [l.id, l.accepted_at]));
  const minhasAvaliacoes = await avaliacoesMinhasPorContrato(supabase, user.id, contratos.map((c) => String(c.id)));
  // E1072: o que o contrato diz que cada bloco custa (aluguel, contas e limpeza), para o registro e o quitado.
  // Com `exigir`, a leitura que falha derruba a tela ("Tentar de novo") — nunca um bloco "quitado" pela metade.
  const componentes = admin
    ? await componentesDosContratos(
        admin,
        contratos.map((c) => ({
          id: String(c.id),
          prazoTotalDias: Number(c.prazo_total_dias),
          blocos: ((c.contrato_blocos as Record<string, unknown>[]) ?? []).map((b) => ({ numero: Number(b.numero_bloco), meses: Number(b.meses), inicio: (b.inicio as string | null) ?? null, fim: (b.fim as string | null) ?? null, valor: Number(b.valor) })),
        })),
      ).catch((e: unknown) => {
        if (opcoes.exigir) throw new Error(MSG_CONTRATOS_NAO_CARREGARAM, { cause: e });
        return new Map<string, Map<number, ComponentesBloco>>();
      })
    : new Map<string, Map<number, ComponentesBloco>>();
  return contratos.map((c) => {
    const meta = titleById.get(String(c.property_id));
    const blocos = ((c.contrato_blocos as Record<string, unknown>[]) ?? [])
      .map(toBloco)
      .map((b) => ({ ...b, componentes: componentes.get(String(c.id))?.get(b.numeroBloco) ?? b.componentes }))
      .sort((a, b) => a.numeroBloco - b.numeroBloco);
    const pagamentos = ordenarPagamentos(((c.pagamentos_bloco as Record<string, unknown>[]) ?? []).filter((pg) => !pg.anulado_em)).map((pg) => toPagamento(pg, Number(c.aluguel_mensal), Number(c.prazo_total_dias)));
    const estado = estadoDaLinha(c, "proprietario");
    return {
      id: String(c.id),
      propertyId: String(c.property_id),
      propertyTitle: meta?.title ?? "Imóvel",
      tenantId: String(c.tenant_id ?? ""),
      city: meta?.city ?? "",
      aluguelMensal: Number(c.aluguel_mensal),
      prazoTotalDias: Number(c.prazo_total_dias),
      tamanhoBlocoMeses: Number(c.tamanho_bloco_meses ?? 2),
      comissaoValor: taxas.get(String(c.id))?.comissaoValor ?? 0,
      comissaoPercent: taxas.get(String(c.id))?.comissaoPercent ?? 0,
      aceiteEm: aceiteDoLead.get(String(c.lead_id)) ?? null,
      qtdOcupantes: Number(c.qtd_ocupantes ?? 1),
      status: String(c.status ?? "ativo"),
      etapa: estado.etapa ?? "em_vigencia",
      estado,
      criadoEm: String(c.created_at),
      blocos,
      pagamentos,
      anuladosPendentes: anuladosAntesDaConfirmacao(ordenarPagamentos((c.pagamentos_bloco as Record<string, unknown>[]) ?? []), linhaDoAnulado),
      caucao: caucaoDaLinha(c, blocos, pagamentos),
      podeAvaliar: podeAvaliarLocacao(String(c.status ?? "ativo"), (c.encerrado_em as string | null) ?? null),
      fimParaAvaliacao: (c.encerrado_em as string | null) ?? blocos[blocos.length - 1]?.fim ?? null,
      minhaAvaliacao: minhasAvaliacoes.get(String(c.id)) ?? null,
    };
  });
}

export interface PagamentoInput {
  blocoId: string;
  contratoId: string;
  tipo?: "aluguel" | "caucao";
  valor: number;
  forma?: "pix" | "boleto" | "transferencia" | "dinheiro" | "outro";
  dataPagamento: string; // ISO yyyy-mm-dd
  observacao?: string;
  /** Encargos pagos junto (condomínio, IPTU, contas) — vão para o recibo. */
  encargos?: { rotulo: string; valor: number }[];
  /** E1072: as contas do período e a limpeza de preparação registradas com o aluguel (rótulo fixo de cada uma). */
  componentes?: { contas?: number | null; limpeza?: number | null };
}

/**
 * O PROPRIETÁRIO registra que recebeu um pagamento (declaratório). NÃO há
 * captura de valores — só se documenta a data e a forma. A RLS garante que só
 * o dono do imóvel do contrato consegue inserir (marcado_por = ele).
 * Best-effort: no-op em demo/sem sessão/ids não-UUID (exemplos).
 */
export async function marcarPagamentoRecebido(input: PagamentoInput): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para registrar o recebimento." };
  // Exemplos (ids não-UUID) são só demonstração. A Caução não tem bloco (0182): só o contrato precisa ser real.
  if (!UUID_RE.test(input.contratoId) || ((input.tipo ?? "aluguel") === "aluguel" && !UUID_RE.test(input.blocoId)))
    return { ok: true, demo: true };
  if (!(input.valor >= 0)) return { ok: false, error: "Informe um valor válido." };
  if (!input.dataPagamento) return { ok: false, error: "Informe a data do pagamento." };

  const tipo = input.tipo ?? "aluguel";
  const encargosDoRegistro = (tipo === "caucao" ? [] : input.componentes ? encargosDosComponentes(input.componentes) : (input.encargos ?? []))
    .filter((e) => e.rotulo?.trim() && Number(e.valor) > 0)
    .slice(0, 8)
    .map((e) => ({ rotulo: e.rotulo.trim().slice(0, 60), valor: Math.round(Number(e.valor) * 100) / 100 }));
  // E1072 (fatia 2): o bloco pode ser pago em partes. Já havendo registro ativo no bloco, este é COMPLEMENTAR: só
  // entra se ainda faltar algo pelo contrato e sem passar do que falta. Bloco já todo registrado → "já registrado".
  // Nota do desenho da pilha (ORDENS-DUET 1054 e 1095): o teto vale para TODO o registro, incluindo o 1º — o 1º também
  // não passa do que o contrato diz que o bloco custa, e sem essa conta lida não grava.
  let parte = 1;
  if (tipo === "aluguel") {
    const { data: ativos, error: erroAtivos } = await supabase.from("pagamentos_bloco").select("id, parte, valor, encargos").eq("bloco_id", input.blocoId).eq("tipo", "aluguel").is("anulado_em", null);
    if (erroAtivos) return { ok: false, error: erroBancoPT(erroAtivos) };
    const registros = (ativos ?? []) as { id: string; parte: number | null; valor: number | string; encargos: unknown }[];
    const esperado = await esperadoDoBloco(supabase, input.contratoId, input.blocoId);
    if (!esperado) return { ok: false, error: "Não foi possível conferir o que falta neste bloco. Tente de novo em instantes." };
    const aberto = emAbertoNoBloco(esperado, somarComponentes(registros.map((r) => componentesDoPagamento(r))));
    const novo = componentesDoPagamento({ valor: input.valor, encargos: encargosDoRegistro });
    if (registros.length > 0) {
      if (aberto.quitado) return { ok: true, id: registros[0].id, jaRegistrado: true, mensagem: MSG_JA_REGISTRADO };
      if (!(novo.total > 0)) return { ok: false, error: "Informe um valor válido." };
    }
    if (novo.aluguel > aberto.aluguel + 0.005 || novo.contas > aberto.contas + 0.005 || novo.limpeza > aberto.limpeza + 0.005) return { ok: false, error: MSG_PASSA_DO_QUE_FALTA };
    // E1229 (ORDEM-DUET-1160): um número dado não volta — o próximo é o maior já dado no bloco, ativo ou ANULADO, mais 1.
    const { data: todas, error: erroTodas } = await supabase.from("pagamentos_bloco").select("parte").eq("bloco_id", input.blocoId).eq("tipo", "aluguel");
    if (erroTodas) return { ok: false, error: erroBancoPT(erroTodas) };
    const dadas = ((todas ?? []) as { parte: number | null }[]).map((r) => Number(r.parte ?? 1));
    if (dadas.length > 0) parte = proximaParte(dadas);
  }
  // A caução (ORDENS-DUET 1098, 1107, 1112, 1120, 1127 e 1132) é registrada POR BLOCO (E1225, 0367) e usa a MESMA regra
  // da tela (linhasDaCaucaoPorBloco): só entra no 1.º bloco em aberto e só até ao que falta nessa linha — min(caução do
  // bloco, a soma das cauções dos blocos 1..k menos a caução já registrada e ativa, com ou sem bloco). As de antes, sem
  // bloco, contam no teto e nada se reescreve; um registro NOVO exige o bloco. Sem a conta lida, não grava (falha fechado).
  if (tipo === "caucao") {
    if (!UUID_RE.test(input.blocoId)) return { ok: false, error: MSG_CAUCAO_ESCOLHA_O_BLOCO };
    const [{ data: ct, error: erroCt }, { data: ativas, error: erroAtivas }] = await Promise.all([
      supabase.from("contratos").select("id, contrato_blocos(id, numero_bloco, caucao)").eq("id", input.contratoId).maybeSingle(),
      supabase.from("pagamentos_bloco").select("id, valor, bloco_id, confirmado_pelo_inquilino").eq("contrato_id", input.contratoId).eq("tipo", "caucao").is("anulado_em", null),
    ]);
    if (erroCt || erroAtivas || !ct) return { ok: false, error: MSG_CAUCAO_SEM_CONTA };
    const registradas = (ativas ?? []) as { id: string; valor: number | string; bloco_id: string | null; confirmado_pelo_inquilino?: boolean | null }[];
    const noBloco = registradas.find((r) => r.bloco_id === input.blocoId);
    if (noBloco) return { ok: true, id: noBloco.id, jaRegistrado: true, mensagem: MSG_JA_REGISTRADO };
    const lidos = (((ct as { contrato_blocos?: unknown }).contrato_blocos as { id: string; numero_bloco: number; caucao: number | string | null }[] | null) ?? []).map((b) => ({ id: String(b.id), numero: Number(b.numero_bloco), caucao: Number(b.caucao) || 0 }));
    // ORDEM-DUET-1112: antes da regra, os casos que não são teto. Nenhum bloco lido é falta de leitura (não teto zero);
    // um bloco que não é deste contrato também; blocos lidos com caução 0 em todos são um contrato sem caução.
    if (lidos.length === 0 || !lidos.some((b) => b.id === input.blocoId)) return { ok: false, error: MSG_CAUCAO_SEM_CONTA };
    if (lidos.every((b) => b.caucao <= 0)) return { ok: false, error: MSG_CAUCAO_SEM_CAUCAO };
    const linhas = linhasDaCaucaoPorBloco(
      lidos,
      registradas.map((r) => ({ id: r.id, blocoId: r.bloco_id, tipo: "caucao", valor: Number(r.valor) || 0, confirmado: Boolean(r.confirmado_pelo_inquilino) })),
    );
    const linha = linhas.find((l) => l.id === input.blocoId);
    if (!linha || !(linha.emAberto > 0)) return { ok: false, error: MSG_CAUCAO_NADA_NO_BLOCO };
    if (!linha.oferecer) {
      const primeiro = linhas.find((l) => l.oferecer);
      return { ok: false, error: msgCaucaoRegistreAntes(primeiro?.numero ?? linha.numero) };
    }
    if (input.valor > linha.emAberto + 0.005) return { ok: false, error: msgCaucaoPassa(linha.emAberto) };
  }
  // A caução e o valor mensal gravam o bloco (a caução por bloco desde o E1225, 0367).
  const { data, error } = await supabase
    .from("pagamentos_bloco")
    .insert({
      ...(tipo === "aluguel" ? { parte } : {}),
      bloco_id: input.blocoId,
      contrato_id: input.contratoId,
      tipo,
      valor: input.valor,
      forma: input.forma ?? "pix",
      data_pagamento: input.dataPagamento,
      marcado_por: user.id,
      observacao: input.observacao?.trim() || null,
      encargos: encargosDoRegistro,
    })
    .select("id")
    .single();
  if (error) {
    // Clique duplo ou segundo envio: o índice único (uma Caução por contrato, um valor mensal por bloco) recusa e
    // devolvemos o registro que já existe, sem erro técnico.
    if (error.code === "23505") {
      const existente = await pagamentoJaRegistrado(supabase, input.contratoId, tipo, input.blocoId);
      return { ok: true, id: existente ?? undefined, jaRegistrado: true, mensagem: MSG_JA_REGISTRADO };
    }
    return { ok: false, error: erroBancoPT(error) };
  }
  return { ok: true, id: data?.id };
}

/** E1072 (fatia 2): o que o contrato diz que o bloco custa, lido no servidor para conferir o registro complementar. */
async function esperadoDoBloco(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, contratoId: string, blocoId: string): Promise<ComponentesBloco | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  // O RLS da sessão prova que a pessoa é parte do contrato; só depois o cliente de serviço lê a conta do contrato.
  const { data: c, error } = await supabase.from("contratos").select("id, prazo_total_dias, contrato_blocos(id, numero_bloco, meses, inicio, fim, valor)").eq("id", contratoId).maybeSingle();
  if (error || !c) return null;
  const blocos = ((c.contrato_blocos as Record<string, unknown>[] | null) ?? []).map((b) => ({ id: String(b.id), numero: Number(b.numero_bloco), meses: Number(b.meses), inicio: (b.inicio as string | null) ?? null, fim: (b.fim as string | null) ?? null, valor: Number(b.valor) }));
  const alvo = blocos.find((b) => b.id === blocoId);
  if (!alvo) return null;
  try {
    return (await componentesDosContratos(admin, [{ id: String(c.id), prazoTotalDias: Number(c.prazo_total_dias), blocos }])).get(String(c.id))?.get(alvo.numero) ?? null;
  } catch {
    return null;
  }
}

async function pagamentoJaRegistrado(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  contratoId: string,
  tipo: "aluguel" | "caucao",
  blocoId: string | null
): Promise<string | null> {
  let q = supabase.from("pagamentos_bloco").select("id").eq("contrato_id", contratoId).eq("tipo", tipo).is("anulado_em", null);
  // O valor mensal e a caução com bloco (E1225) procuram no bloco; a caução sem bloco, a do contrato.
  if (blocoId) q = q.eq("bloco_id", blocoId);
  else if (tipo === "caucao") q = q.is("bloco_id", null);
  const { data } = await q.order("created_at", { ascending: true }).limit(1).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/**
 * O INQUILINO confirma um pagamento declarado pelo proprietário. A RLS garante
 * que só o inquilino do contrato consegue atualizar. Best-effort.
 */
export async function confirmarPagamento(pagamentoId: string): Promise<ActionResult> {
  const supabase = await createClient();
  if (!supabase) return { ok: true, demo: true };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Entre para confirmar." };
  if (!UUID_RE.test(pagamentoId)) return { ok: true, demo: true };

  const { error } = await supabase
    .from("pagamentos_bloco")
    // confirmado_em é carimbado pelo banco (0057: o inquilino só grava a confirmação).
    .update({ confirmado_pelo_inquilino: true })
    .eq("id", pagamentoId);
  if (error) return { ok: false, error: erroBancoPT(error) };
  // Registrado pelo dono + confirmado pelo inquilino → recibo (ou comprovante da
  // caução) em PDF, por e-mail às duas partes. Depois da resposta: não atrasa a tela.
  after(() => emitirDoPagamentoComRegistro(pagamentoId));
  return { ok: true, id: pagamentoId };
}
