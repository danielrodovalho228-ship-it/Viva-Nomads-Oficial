/*
  E222-B — renovar = ADITIVO DE PRORROGAÇÃO já preenchido. Um caminho só: o botão "Renovar a estadia" abre o mesmo
  fluxo do aditivo (proporAlteracao → aceite → as duas assinaturas → aplicarAditivo), com os meses já somados de mais
  1 bloco do tamanho padrão do contrato, até o teto de 180 dias. O aditivo assinado cria os blocos novos e dispara
  estadia_remarcada (E213) e o lembrete do bloco (E205-B2). O antigo renovarBloco (aceite por clique, sem documento
  e sem estadia_remarcada) saiu.
  PURO. Roda: node --test src/lib/estadia/renovacao.test.ts
*/
import { DIAS_POR_MES, MAX_MESES_BLOCO, PRAZO_MAX_MESES, addDiasISO, fimInclusivoISO } from "../contrato-blocos.ts";
import { HREF_ESTADIA } from "./estadia.ts";

/** O teto da estadia em dias (6 meses de 30 dias). */
export const TETO_DIAS = PRAZO_MAX_MESES * DIAS_POR_MES;
export const TEXTO_NO_MAXIMO = `Esta estadia já chegou ao máximo de ${TETO_DIAS} dias.`;
export const ROTULO_RENOVAR = "Renovar a estadia";

/** O fluxo da renovação: o formulário do aditivo aberto já como prorrogação. Destino do botão, do e-mail e da carteira. */
export const HREF_RENOVAR = (contratoId: string): string => `${HREF_ESTADIA(contratoId)}/alteracao?renovar=1`;

export interface BlocoParaRenovar {
  inicio: string;
  fim: string;
  meses: number;
}

export interface Renovacao {
  /** Meses do contrato hoje (blocos válidos). */
  mesesAtuais: number;
  /** Quanto ainda cabe até o teto. */
  mesesQueCabem: number;
  /** Meses do contrato já com a renovação sugerida (mais 1 bloco padrão, limitado ao teto). */
  mesesSugeridos: number;
  /** As durações que a pessoa pode escolher (sempre maiores que a atual, até o teto). */
  opcoes: number[];
}

/** null = sem espaço até o teto (o botão não aparece; a tela mostra TEXTO_NO_MAXIMO). */
export function renovacaoPossivel(blocos: Pick<BlocoParaRenovar, "meses">[], tamanhoBlocoMeses: number): Renovacao | null {
  const mesesAtuais = blocos.reduce((s, b) => s + Number(b.meses || 0), 0);
  const mesesQueCabem = PRAZO_MAX_MESES - mesesAtuais;
  if (mesesAtuais <= 0 || mesesQueCabem <= 0) return null;
  const passo = Math.min(Math.max(1, Math.round(tamanhoBlocoMeses) || 1), MAX_MESES_BLOCO);
  const mesesSugeridos = mesesAtuais + Math.min(passo, mesesQueCabem);
  const opcoes = Array.from({ length: mesesQueCabem }, (_, i) => mesesAtuais + i + 1);
  return { mesesAtuais, mesesQueCabem, mesesSugeridos, opcoes };
}

export interface PreviaRenovacao {
  meses: number;
  /** O período acrescentado: do dia seguinte à saída atual até a nova saída. */
  inicio: string;
  fim: string;
  /** Valor do período acrescentado (valor mensal × meses acrescentados). */
  valor: number;
}

/** O que a renovação acrescenta para `mesesTotal` meses de contrato (as datas e o valor que o formulário mostra). */
export function previaDaRenovacao(blocos: Pick<BlocoParaRenovar, "fim" | "meses">[], valorMensal: number, mesesTotal: number): PreviaRenovacao | null {
  const atuais = blocos.reduce((s, b) => s + Number(b.meses || 0), 0);
  const meses = mesesTotal - atuais;
  const ultimoFim = blocos.map((b) => b.fim).sort().at(-1);
  if (!ultimoFim || meses <= 0 || mesesTotal > PRAZO_MAX_MESES) return null;
  const inicio = addDiasISO(ultimoFim, 1);
  return { meses, inicio, fim: fimInclusivoISO(inicio, meses * DIAS_POR_MES), valor: Math.round(valorMensal * meses * 100) / 100 };
}
