/*
  E444 itens 3 e 4 (Relay 57 — Pista A): o sino nos topos e a faixa de crítico. PURO (a tela e a rota usam).
  A base (tabela "avisos", prioridade evento × papel, não lidas, marcar lido, resolvido pela ação) é da Pista B (0286,
  src/lib/notifications/avisos.ts e src/lib/data/avisos-actions.ts).
  Roda: node --test src/lib/notifications/sino.test.ts
*/
import { ACAO_RESOLVE, urlDoAviso, type PrioridadeAviso } from "./avisos.ts";
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

const ROTULO_ACAO = { assinou: "Assinar o contrato", respondeu: "Responder a proposta", confirmou: "Confirmar a visita" } as const;

/** O texto do botão da faixa: a ação que resolve o evento. */
export function acaoDaFaixa(evento: string): string {
  const acao = ACAO_RESOLVE[evento as NotificationEvent];
  return acao ? ROTULO_ACAO[acao] : "Resolver agora";
}
