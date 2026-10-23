/*
  Prompt 62-A, Parte 2 — textos e regras de EXIBIÇÃO da execução, do laudo, do resultado do dono, da ficha
  "· vistoriado", dos strikes e do admin. PURO (node --test). As regras de negócio ficam com a Pista B
  (laudo.ts, strikes.ts, regras.ts); aqui só o que a tela mostra.
  Adendo 62-B1: depois de "reprovado" é NOVA avaliação pela tabela; desconto só se a condição de retorno da cidade existir
  (nenhum texto fala em "50%").
*/
import { GRUPOS_AVALIACAO, ITENS_CHECKLIST, type GrupoAvaliacao, type ItemChecklist, type ValorItem } from "../../config/checklist-avaliacao.ts";
import { ETIQUETA_BRASILIA, dataBRT, horaBRT } from "../datas-brasilia.ts";
import { DIAS_CONTESTACAO, prazoLaudo, type Resultado } from "./laudo.ts";
import { textoDegrau, type Degrau } from "./strikes.ts";

const ITENS = ITENS_CHECKLIST as readonly ItemChecklist[];

// ── Item 8: execução por passos ───────────────────────────────────────────────────────────────────────────────
export const AVISO_SEM_PESSOAS = "Sem pessoas e sem pertences nas fotos.";
export const TEXTO_TESTE_EM_USO = "Teste em uso";

export interface PassoGrupo {
  grupo: GrupoAvaliacao;
  rotulo: string;
  /** 1 a 9, na ordem do checklist. */
  passo: number;
  total: number;
  respondidos: number;
  completo: boolean;
}

/** Os 9 grupos como passos, com quantos itens já têm resposta. */
export function passosDoChecklist(respostas: Readonly<Record<string, { valor: ValorItem } | ValorItem | undefined>>): PassoGrupo[] {
  return GRUPOS_AVALIACAO.map((g, i) => {
    const doGrupo = ITENS.filter((it) => it.grupo === g.id);
    const respondidos = doGrupo.filter((it) => respostas[it.chave] != null).length;
    return { grupo: g.id, rotulo: g.rotulo, passo: i + 1, total: doGrupo.length, respondidos, completo: respondidos === doGrupo.length };
  });
}

export const rotuloPasso = (p: Pick<PassoGrupo, "passo" | "rotulo">) => `Passo ${p.passo} de ${GRUPOS_AVALIACAO.length} · ${p.rotulo}`;

/** "Falta enviar 1 foto" / "Falta enviar 3 fotos" (fila do aparelho, sem rede). */
export function textoFaltaFotos(n: number): string | null {
  if (n <= 0) return null;
  return n === 1 ? "Falta enviar 1 foto" : `Falta enviar ${n} fotos`;
}

/** A câmera aparece no item só quando o checklist pede foto: o item ficou não conforme (1 foto por item não conforme). */
export const pedeFotoDoItem = (valor: ValorItem | undefined) => valor === "nao_conforme" || valor === "leve" || valor === "nao_habitavel";

// ── Item 9: laudo do avaliador (revisão antes de emitir) ──────────────────────────────────────────────────────
/** Prazo das 48 horas úteis da visita: "Envie até 27/10/2026 às 10:00, horário de Brasília". */
export function prazoDoLaudo(visitaEm: string, agora: Date): { vencido: boolean; texto: string } {
  const fim = prazoLaudo(visitaEm);
  if (agora > fim) return { vencido: true, texto: `Prazo de 48 horas úteis vencido em ${dataBRT(fim)} às ${horaBRT(fim)}. Envie agora: a Viva acompanha os atrasos.` };
  return { vencido: false, texto: `Envie até ${dataBRT(fim)} às ${horaBRT(fim)}, ${ETIQUETA_BRASILIA} (48 horas úteis da visita).` };
}

// ── Item 10: resultado do dono ──────────────────────────────────────────────────────────────────────────────────
export type AcaoResultado = "enviar_correcao" | "nova_avaliacao" | "contestar";

/** As ações de cada resultado: correção nos 15 dias (com ressalvas), nova avaliação (reprovado), contestar em 7 dias. */
export function acoesDoResultado(l: { resultado: Resultado; emitidoEm: string; prazoRessalvaAte: string | null; corrigidoEm: string | null; ressalvaVencidaEm: string | null; contestadoEm: string | null }, agora: Date): AcaoResultado[] {
  const acoes: AcaoResultado[] = [];
  const noPrazo = !!l.prazoRessalvaAte && agora <= new Date(l.prazoRessalvaAte);
  if (l.resultado === "com_ressalvas" && noPrazo && !l.corrigidoEm && !l.ressalvaVencidaEm && !l.contestadoEm) acoes.push("enviar_correcao");
  if (l.resultado === "reprovado" || !!l.ressalvaVencidaEm) acoes.push("nova_avaliacao");
  if (l.resultado !== "aprovado" && !l.contestadoEm && agora.getTime() - Date.parse(l.emitidoEm) <= DIAS_CONTESTACAO * 86_400_000) acoes.push("contestar");
  return acoes;
}

export const ROTULO_ACAO: Record<AcaoResultado, string> = {
  enviar_correcao: "Enviar correção",
  nova_avaliacao: "Pedir nova avaliação",
  contestar: "Contestar",
};

// ── Item 11: ficha e cartão ─────────────────────────────────────────────────────────────────────────────────────
/** "Avaliado em 25/10/2026 por avaliador credenciado nº UDI-007". */
export const linhaAvaliadoEm = (vistoriadoEm: string, numero: string) => `Avaliado em ${dataBRT(vistoriadoEm)} por avaliador credenciado nº ${numero}`;
// A linha do cartão ("Conforto · vistoriado") fica em cartao-sintese.ts (textoNivelCartao), junto da síntese.
/** Resumo por grupo em uma linha: "8 de 8 conformes" / "6 conformes · 2 não conformes". */
export function linhaResumoGrupo(g: { conformes: number; naoConformes: readonly string[] }): string {
  return g.naoConformes.length ? `${g.conformes} conformes · ${g.naoConformes.length} não ${g.naoConformes.length === 1 ? "conforme" : "conformes"}` : `${g.conformes} conformes`;
}

// ── Item 12: strikes ────────────────────────────────────────────────────────────────────────────────────────────
export function avisoStrike(d: Degrau): { titulo: string; texto: string } | null {
  if (d === 0) return null;
  const titulo = d === 1 ? "Registro de verificação" : d === 2 ? "Aviso formal" : "Seus anúncios estão fora da busca";
  return { titulo, texto: textoDegrau(d) };
}

// ── Item 13: admin ──────────────────────────────────────────────────────────────────────────────────────────────
/** Os números do topo "Para decidir" que a Parte 2 soma ao admin (cada um leva à sua seção). */
export function contagemContestacoes(e: { contestacoes: number; devolucoes: number; laudosAtrasados: number; auditoria: number }) {
  return [
    { chave: "contestacoes", rotulo: "contestações abertas", valor: e.contestacoes, ancora: "#contestacoes" },
    { chave: "devolucoes", rotulo: "devoluções a devolver", valor: e.devolucoes, ancora: "#contestacoes" },
    { chave: "laudos-atrasados", rotulo: "laudos fora das 48 horas úteis", valor: e.laudosAtrasados, ancora: "#contestacoes" },
    { chave: "auditoria", rotulo: "laudos sorteados para auditoria", valor: e.auditoria, ancora: "#auditoria" },
  ];
}
