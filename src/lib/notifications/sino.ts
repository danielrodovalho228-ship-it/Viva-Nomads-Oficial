/*
  E444 itens 3 e 4 (Relay 57 — Pista A): o sino nos topos e a faixa de crítico. PURO (a tela e a rota usam).
  A base (tabela "avisos", prioridade evento × papel, não lidas, marcar lido, resolvido pela ação) é da Pista B (0286,
  src/lib/notifications/avisos.ts e src/lib/data/avisos-actions.ts).
  Roda: node --test src/lib/notifications/sino.test.ts
*/
import { botaoDaRotina, rotinaDoTitulo } from "./avisos-rotinas-contrato.ts";
import { ACAO_RESOLVE, resumoDosAvisos, urlDoAviso, type PrioridadeAviso } from "./avisos.ts";
import type { NotificationEvent } from "./eventos-email.ts";

/** GET: resumo + os últimos do sino + críticos pendentes. POST {id}: marca lido. */
export const ROTA_AVISOS = "/api/painel/avisos";
/** "Ver todas": a lista completa (da tabela, com filtro por prioridade). */
export const VER_TODAS = "/dashboard/notificacoes#avisos";
export const ULTIMOS_DO_SINO = 8;

export interface AvisoTela {
  id: string;
  evento: string;
  prioridade: PrioridadeAviso;
  titulo: string;
  /** E482: a linha de texto do aviso (ex.: prévia da mensagem). */
  texto?: string | null;
  url: string | null;
  criado_em: string;
  lido_em: string | null;
  resolvido_em: string | null;
  /** E676: o objeto do aviso (para o aviso da estadia e do contrato, o id do contrato). */
  ref_id?: string | null;
}

export type FiltroAvisos = "todos" | PrioridadeAviso;
export const FILTROS_AVISOS: readonly { id: FiltroAvisos; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "critico", rotulo: "Críticos" },
  { id: "urgente", rotulo: "Urgentes" },
  { id: "normal", rotulo: "Normais" },
];

export const ROTULO_PRIORIDADE: Record<PrioridadeAviso, string> = { critico: "Crítico", urgente: "Urgente", normal: "Normal" };

/** Cor do número do sino e do selo de prioridade (contraste AA com o texto). */
export const COR_PRIORIDADE: Record<PrioridadeAviso, string> = {
  critico: "bg-red-700 text-white",
  urgente: "bg-amber-300 text-ink",
  normal: "bg-forest text-white",
};

export function rotuloContagem(n: number): string | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 9 ? "9+" : String(Math.floor(n));
}

const recente = (a: AvisoTela, b: AvisoTela) => Date.parse(b.criado_em) - Date.parse(a.criado_em);
// E586: desempate estável (mesma hora → a mesma ordem em qualquer carregamento).
const porId = (a: AvisoTela, b: AvisoTela) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/** E586: dois avisos IDÊNTICOS (mesmo evento, título, texto e destino) a menos de 2 min um do outro são o mesmo aviso. */
export const JANELA_REPETIDO_MS = 120_000;

/**
 * E586 (reprova de 05/11): o histórico ainda trazia três avisos idênticos no mesmo minuto (gravados antes da junção do
 * #2666). Não apagamos nada: na exibição, o repetido da janela some e fica o mais recente; se algum do grupo está
 * pendente, fica um pendente (nunca esconde um aviso que ainda pede ação). Avisos distintos ou distantes ficam todos.
 */
export function semRepetidos<T extends AvisoTela>(avisos: readonly T[]): T[] {
  const ordem = [...avisos].sort((a, b) => recente(a, b) || porId(a, b));
  const chave = (a: AvisoTela) => [a.evento, a.titulo, a.texto ?? "", a.url ?? ""].join("\u0001");
  const pendente = (a: AvisoTela) => !a.lido_em && !a.resolvido_em;
  const ultimo = new Map<string, { aviso: T }>();
  const fora = new Set<string>();
  for (const a of ordem) {
    const k = chave(a);
    const visto = ultimo.get(k);
    const t = Date.parse(a.criado_em);
    if (visto && Math.abs(Date.parse(visto.aviso.criado_em) - t) <= JANELA_REPETIDO_MS) {
      // Já há um mais recente no grupo: este sai, a menos que só ele esteja pendente.
      if (pendente(a) && !pendente(visto.aviso)) {
        fora.add(visto.aviso.id);
        visto.aviso = a;
      } else fora.add(a.id);
    } else ultimo.set(k, { aviso: a });
  }
  return ordem.filter((a) => !fora.has(a.id));
}

/** E586: a lista de avisos é estritamente cronológica — data/hora decrescente, desempate pelo id, sem repetido. */
export function ordemCronologica<T extends AvisoTela>(avisos: readonly T[]): T[] {
  return semRepetidos(avisos);
}

/**
 * Os últimos do sino, na ordem cronológica (E586: a prioridade não fura a lista — um aviso de hoje nunca aparece entre
 * os de ontem). Os críticos pendentes têm a faixa própria do topo (criticosPendentes).
 */
export function ordenarParaOSino<T extends AvisoTela>(avisos: readonly T[]): T[] {
  return ordemCronologica(avisos).slice(0, ULTIMOS_DO_SINO);
}

export function filtrarAvisos<T extends AvisoTela>(avisos: readonly T[], filtro: FiltroAvisos): T[] {
  return filtro === "todos" ? [...avisos] : avisos.filter((a) => a.prioridade === filtro);
}

/** Destino do clique: a tela do evento (só caminho interno) ou a lista completa. */
export function destinoDoAviso(url: string | null | undefined): string {
  return urlDoAviso(url) ?? VER_TODAS;
}

/** Faixa do topo (item 4): críticos ainda não resolvidos (lidos ou não), o mais recente primeiro. */
export function criticosPendentes<T extends AvisoTela>(avisos: readonly T[]): T[] {
  return avisos.filter((a) => a.prioridade === "critico" && !a.resolvido_em).sort(recente);
}

// ── E676: a faixa de crítico confere a situação real do contrato ────────────────────────────────────────────────────

/** O que o banco diz agora sobre os contratos dos avisos: onde a pessoa ainda precisa assinar e onde há aditivo a responder. */
export interface SituacaoDosContratos {
  assinarPendente: ReadonlySet<string>;
  aditivoAberto: ReadonlySet<string>;
  /** E1060: as visitas do dono que ainda esperam a resposta dele (status "pedido"). Sem leitura, ausente: nada é escondido. */
  visitaPendente?: ReadonlySet<string>;
  /**
   * E1128: os pedidos de avaliação da pessoa (como dono, morador ou avaliador) que ainda têm VISITA POR ACONTECER, e os
   * imóveis deles. Sem leitura, ausente: nada é escondido.
   */
  avaliacaoComVisita?: { pedidos: ReadonlySet<string>; imoveis: ReadonlySet<string> };
}

/** E1128: os avisos que anunciam a visita de avaliação (a data marcada, a véspera, o pedido de concordância do morador). */
export const EVENTOS_VISITA_DE_AVALIACAO = ["vistoria_agendada", "vistoria_lembrete", "vistoria_concordancia"] as const;

export function ehAvisoDeVisitaDeAvaliacao(evento: string): boolean {
  return (EVENTOS_VISITA_DE_AVALIACAO as readonly string[]).includes(evento);
}

const IMOVEL_NO_CAMINHO = /\/dashboard\/imoveis\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** E1128: o imóvel do aviso, pelo endereço (o aviso do dono leva à página do nível do imóvel); sem imóvel, null. */
export function imovelDoAviso(url: string | null | undefined): string | null {
  return IMOVEL_NO_CAMINHO.exec(String(url ?? ""))?.[1]?.toLowerCase() ?? null;
}

const UUID_NO_CAMINHO = /\/dashboard\/(?:estadia|contratos)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** O contrato do aviso: o ref_id ou, nos avisos antigos gravados sem ele, o id no endereço da estadia/do contrato. */
export function contratoDoAviso(a: { ref_id?: string | null; url: string | null }): string | null {
  if (a.ref_id) return a.ref_id;
  return UUID_NO_CAMINHO.exec(String(a.url ?? ""))?.[1] ?? null;
}

/**
 * E676: o crítico "assinar o contrato" só vale enquanto a pessoa ainda precisa assinar; a "proposta de alteração da
 * estadia" só enquanto o aditivo espera resposta. Fora disso o aviso conta como resolvido (a faixa e o selo somem), mesmo
 * que a ação não o tenha marcado (aviso antigo, sem ref_id). Sem situação (leitura falhou) ou sem contrato no aviso, nada
 * é escondido.
 */
export function resolvidosNaPratica<T extends AvisoTela>(avisos: readonly T[], situacao: SituacaoDosContratos | null, agoraISO: string): T[] {
  if (!situacao) return [...avisos];
  return avisos.map((a) => {
    // E1128: o aviso da visita de avaliação só vale enquanto o pedido tem visita por acontecer — seja qual for a
    // prioridade. Com o pedido no aviso, confere o pedido; aviso antigo sem ele, confere o imóvel do endereço; sem
    // imóvel (o do avaliador), só sai quando a pessoa não tem nenhuma visita por acontecer (na dúvida, não esconde).
    if (!a.resolvido_em && ehAvisoDeVisitaDeAvaliacao(a.evento)) {
      const comVisita = situacao.avaliacaoComVisita;
      if (!comVisita) return a;
      const imovel = imovelDoAviso(a.url);
      const pendente = a.ref_id ? comVisita.pedidos.has(a.ref_id) : imovel ? comVisita.imoveis.has(imovel) : comVisita.pedidos.size > 0;
      return pendente ? a : { ...a, resolvido_em: agoraISO };
    }
    if (a.resolvido_em || a.prioridade !== "critico") return a;
    // E1060: o "Pedido de visita" só vale enquanto a visita espera a resposta do dono. Aviso antigo sem a visita: sai só
    // quando o dono não tem nenhum pedido à espera (na dúvida, não esconde).
    if (a.evento === "visita_pedida") {
      const pendentes = situacao.visitaPendente;
      if (!pendentes) return a;
      const pendente = a.ref_id ? pendentes.has(a.ref_id) : pendentes.size > 0;
      return pendente ? a : { ...a, resolvido_em: agoraISO };
    }
    // E1247: o aviso de uma rotina do contrato (caução, parcela, pré-aceite) não é o de assinar — não se dá por resolvido
    // por o contrato já estar assinado.
    if (a.evento === "contract_status" && rotinaDoTitulo(a.titulo)) return a;
    const contrato = contratoDoAviso(a);
    if (!contrato) return a;
    const pendente =
      a.evento === "contract_status" ? situacao.assinarPendente.has(contrato) : a.evento === "estadia_aditivo_proposto" ? situacao.aditivoAberto.has(contrato) : true;
    return pendente ? a : { ...a, resolvido_em: agoraISO };
  });
}

/** E1242: os avisos que a conferência do sino confere pelo contrato (assinar o contrato e a proposta de aditivo). */
const EVENTOS_CONFERIDOS_PELO_CONTRATO = ["contract_status", "estadia_aditivo_proposto"] as const;
const ehConferidoPeloContrato = (evento: string) => (EVENTOS_CONFERIDOS_PELO_CONTRATO as readonly string[]).includes(evento);

/**
 * E1128 + E1242: o aviso que já não vale sai do sino. O da visita de avaliação, resolvido pela ação ou pela conferência.
 * O de assinar o contrato / do aditivo (E1242), quando a resolução veio do banco (a assinatura resolve) ou quando a
 * conferência o resolveu e ele tem referência. Sem referência e só conferido pelo endereço, fica: pode ser de outra
 * rotina que partilha o evento (E1247, ORDEM-1224).
 */
function saiDoSino(a: AvisoTela, resolvidosNoBanco: ReadonlySet<string> | undefined): boolean {
  if (!a.resolvido_em) return false;
  if (ehAvisoDeVisitaDeAvaliacao(a.evento)) return true;
  if (!resolvidosNoBanco || !ehConferidoPeloContrato(a.evento)) return false;
  return resolvidosNoBanco.has(a.id) || !!a.ref_id;
}

/**
 * E1128: "um laudo assinado apaga o alerta de visita". O aviso de visita de avaliação já resolvido (pela ação ou pela
 * conferência do estado atual) sai do sino: não aparece entre os recentes nem conta como não lido. Na lista de todos os
 * avisos ele continua, marcado "resolvido" (é o histórico). E1242: com `resolvidosNoBanco` (os ids que já vinham
 * resolvidos do banco), o mesmo para o aviso de assinar o contrato e o do aditivo (ver saiDoSino).
 */
export function semVisitaDeAvaliacaoVencida<T extends AvisoTela>(avisos: readonly T[], resolvidosNoBanco?: ReadonlySet<string>): { visiveis: T[]; naoLidasADescontar: number } {
  const vencido = (a: T) => saiDoSino(a, resolvidosNoBanco);
  return { visiveis: avisos.filter((a) => !vencido(a)), naoLidasADescontar: avisos.filter((a) => vencido(a) && !a.lido_em).length };
}

/**
 * E1128: o resumo do sino depois da conferência. O resumo (contagem e maior prioridade) é lido do banco ANTES de a
 * conferência dar o aviso por vencido; aqui o vencido sai da lista, da contagem e também da COR: se a maior
 * prioridade era a de um vencido ainda não lido, é relida dos avisos que ficam. Só baixa nesse caso — a prioridade de
 * outro aviso (um crítico mais antigo, fora da lista) não se perde.
 */
export function resumoSemVisitaVencida<T extends AvisoTela>(
  resumo: { naoLidas: number; maiorPrioridade: PrioridadeAviso | null },
  avisos: readonly T[],
  resolvidosNoBanco?: ReadonlySet<string>,
): { visiveis: T[]; naoLidas: number; maiorPrioridade: PrioridadeAviso | null } {
  const { visiveis, naoLidasADescontar } = semVisitaDeAvaliacaoVencida(avisos, resolvidosNoBanco);
  const naoLidas = Math.max(0, resumo.naoLidas - naoLidasADescontar);
  let maiorPrioridade = resumo.maiorPrioridade;
  if (naoLidas === 0) maiorPrioridade = null;
  else if (maiorPrioridade && avisos.some((a) => saiDoSino(a, resolvidosNoBanco) && !a.lido_em && a.prioridade === maiorPrioridade)) {
    maiorPrioridade = resumoDosAvisos(visiveis.filter((a) => !a.lido_em)).maiorPrioridade;
  }
  return { visiveis, naoLidas, maiorPrioridade };
}

/**
 * E1128 + E1242 (a rede): os avisos que a conferência acabou de dar por resolvidos e que ficam gravados no banco, para
 * todas as telas concordarem. A visita de avaliação, como no E1128; o de assinar e o do aditivo SÓ com referência
 * (ORDEM-1224): sem ela, o aviso pode ser de outra rotina com o mesmo evento, e a rede não o resolve.
 */
export function resolucoesConferidasAGravar<T extends AvisoTela>(antes: readonly T[], conferidos: readonly T[]): string[] {
  const jaResolvido = new Map(antes.map((a) => [a.id, a.resolvido_em]));
  return conferidos
    .filter((a) => a.resolvido_em && !jaResolvido.get(a.id) && (ehAvisoDeVisitaDeAvaliacao(a.evento) || (ehConferidoPeloContrato(a.evento) && !!a.ref_id)))
    .map((a) => a.id);
}

const ROTULO_ACAO = { assinou: "Assinar o contrato", respondeu: "Responder a proposta", confirmou: "Confirmar a visita" } as const;

/** O texto do botão da faixa: a ação que resolve o evento. */
export function acaoDaFaixa(evento: string, titulo?: string | null): string {
  // E1247 (ORDEM-DUET 1233): os avisos das rotinas que viajam com o evento do contrato levam ao lugar da ação deles.
  const daRotina = evento === "contract_status" ? botaoDaRotina(titulo) : null;
  if (daRotina) return daRotina;
  const acao = ACAO_RESOLVE[evento as NotificationEvent];
  return acao ? ROTULO_ACAO[acao] : "Resolver agora";
}

/**
 * E1242 reaberto (ORDEM-DUET 1247; a lei do E777): a UMA regra de resolução de TODAS as superfícies de avisos — o painel
 * do sino, a faixa crítica, a página completa, os filtros dela e a contagem de não lidas.
 * Resolvido = resolvido no banco (de qualquer evento), ou resolvido AGORA pela conferência com o mesmo critério da
 * gravação (resolucoesConferidasAGravar: a visita de avaliação; assinar/aditivo com referência — ORDEM-1224). O
 * resolvido sai da lista e da faixa; as não lidas (lidas no banco já sem os resolvidos) descontam os resolvidos agora.
 * O crítico sem referência que a conferência dá por cumprido fica na lista (não é gravado) mas sai da faixa, como hoje.
 */
export function superficieDosAvisos<T extends AvisoTela>(
  resumo: { naoLidas: number; maiorPrioridade: PrioridadeAviso | null },
  antes: readonly T[],
  conferidos: readonly T[],
): { visiveis: T[]; criticos: T[]; naoLidas: number; maiorPrioridade: PrioridadeAviso | null } {
  const noBanco = new Set(antes.filter((a) => a.resolvido_em).map((a) => a.id));
  const agora = new Set(resolucoesConferidasAGravar(antes, conferidos));
  const visiveis = conferidos.filter((a) => !noBanco.has(a.id) && !agora.has(a.id));
  const naoLidas = Math.max(0, resumo.naoLidas - conferidos.filter((a) => agora.has(a.id) && !a.lido_em).length);
  let maiorPrioridade = resumo.maiorPrioridade;
  const pendentesNaoLidos = () => visiveis.filter((a) => !a.lido_em && !a.resolvido_em);
  if (naoLidas === 0) maiorPrioridade = null;
  else if (maiorPrioridade && conferidos.some((a) => agora.has(a.id) && !a.lido_em && a.prioridade === maiorPrioridade)) maiorPrioridade = resumoDosAvisos(pendentesNaoLidos()).maiorPrioridade;
  // E676: o crítico que a conferência dá por cumprido (sem referência) não pinta o sino de vermelho.
  if (maiorPrioridade === "critico" && !criticosPendentes(visiveis).length) maiorPrioridade = resumoDosAvisos(pendentesNaoLidos()).maiorPrioridade;
  return { visiveis, criticos: criticosPendentes(visiveis).slice(0, 5), naoLidas, maiorPrioridade };
}
