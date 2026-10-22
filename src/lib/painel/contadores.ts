/*
  Contadores do menu do painel (Prompt 42, item 5) — PURO.

  Antes, a casca do painel chamava ~8 server actions (POST pelo roteador) em useEffect a cada troca de rota; na
  navegação elas eram abortadas (net::ERR_ABORTED) e disputavam a fila com as ações da própria tela. Agora a casca faz
  UM GET em ROTA_CONTADORES ao montar, ao voltar o foco, a cada INTERVALO_CONTADORES_MS com a aba visível e quando
  uma tela avisa que algo mudou (EVENTOS_CONTADORES) — nunca a cada rota.
  Roda: node --test src/lib/painel/contadores.test.ts
*/
import { EVENTO_FILA_DOCUMENTOS } from "../admin/fila-evento.ts";

export const ROTA_CONTADORES = "/api/painel/contadores";
export const INTERVALO_CONTADORES_MS = 60_000;

/** Qualquer tela pode pedir uma nova leitura dos números do menu: window.dispatchEvent(new Event(EVENTO_CONTADORES)). */
export const EVENTO_CONTADORES = "vn:contadores-mudaram";

/** Eventos do navegador que pedem uma nova leitura (a casca soma o aviso de assinatura do contrato). */
export const EVENTOS_CONTADORES: readonly string[] = [EVENTO_CONTADORES, EVENTO_FILA_DOCUMENTOS];

export interface ContadoresPainel {
  /** Contratos esperando a assinatura do inquilino (item "Contratos"). */
  contratosParaAssinar: number;
  /** Propostas esperando a resposta do inquilino (item "Propostas"). */
  propostasAguardando: number;
  /** Só admin: documentos e matrículas na fila (item "Documentos"). */
  documentosPendentes: number;
  /** Só admin: aprovações esperando o OK (item "Agentes"). */
  aprovacoesPendentes: number;
  /** A conta já anunciou algum imóvel (revela as seções de dono). */
  temImovel: boolean;
  /** Imóveis ativos (a "Análise da carteira" abre a partir de 3). */
  imoveisAtivos: number;
  /** Papel de parceiro ou pedido de parceria (item "Parceiro"). */
  parceiro: boolean;
  /** Locação ativa como inquilino (revela "Solicitações" e "Serviços"). */
  estadiaAtiva: boolean;
}

export const CONTADORES_VAZIOS: ContadoresPainel = Object.freeze({
  contratosParaAssinar: 0,
  propostasAguardando: 0,
  documentosPendentes: 0,
  aprovacoesPendentes: 0,
  temImovel: false,
  imoveisAtivos: 0,
  parceiro: false,
  estadiaAtiva: false,
});

function contagem(v: unknown): number {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Resposta da rota → contadores. Campo ausente, negativo ou de outro tipo vira 0/false (nunca quebra o menu). */
export function normalizarContadores(json: unknown): ContadoresPainel {
  const o = json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  return {
    contratosParaAssinar: contagem(o.contratosParaAssinar),
    propostasAguardando: contagem(o.propostasAguardando),
    documentosPendentes: contagem(o.documentosPendentes),
    aprovacoesPendentes: contagem(o.aprovacoesPendentes),
    temImovel: o.temImovel === true,
    imoveisAtivos: contagem(o.imoveisAtivos),
    parceiro: o.parceiro === true,
    estadiaAtiva: o.estadiaAtiva === true,
  };
}

/** O que a rota devolve para quem não é admin: os números da equipe nunca saem (sempre 0). */
export function contadoresVisiveis(c: ContadoresPainel, admin: boolean): ContadoresPainel {
  return admin ? c : { ...c, documentosPendentes: 0, aprovacoesPendentes: 0 };
}

/** Selo da aba "Equipe" da barra inferior: documentos na fila + aprovações. */
export function badgeDaEquipe(c: Pick<ContadoresPainel, "documentosPendentes" | "aprovacoesPendentes">): number {
  return c.documentosPendentes + c.aprovacoesPendentes;
}
