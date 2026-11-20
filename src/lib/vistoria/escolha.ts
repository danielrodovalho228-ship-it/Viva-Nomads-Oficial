/*
  E648 (parte 1) — redesenho do avaliador (anti-subordinação). Regras puras:
   • a Viva SUGERE avaliadores; o DONO ESCOLHE (fim do rodízio designado);
   • a faixa de referência (da tabela da cidade) é só exibida; o avaliador define o PRÓPRIO preço e o PRÓPRIO prazo;
   • o laudo é emitido e ASSINADO pelo avaliador (a Viva fornece o modelo e guarda a prova/hash);
   • sem suspensão automática e sem descredenciamento discricionário: critérios públicos de qualidade, revisão e direito de resposta.
  Tudo atrás de VISTORIA_ATIVA. Nenhuma regra aqui toca em cobrança: o pagamento segue direto, a plataforma só registra.
*/
import { createHash } from "node:crypto";
import { impedimento, type AvaliadorFila, type HistoricoDesignacao, type MotivoImpedimento, type PedidoParaDesignar } from "./regras.ts";

// ── 1. O sistema sugere, o dono escolhe ────────────────────────────────────────────────────────────────────────
export interface Sugestoes {
  /** Elegíveis para este pedido, em ordem NEUTRA de exibição (quem foi menos procurado primeiro). Não é uma designação. */
  sugeridos: AvaliadorFila[];
  impedidos: { id: string; motivo: MotivoImpedimento }[];
}

/**
 * Quem o dono pode escolher neste pedido. Os impedimentos de independência (serviço ao dono em 12 meses, relação
 * declarada, avaliação anterior, 1ª da contestação) continuam valendo: são proteção ao dono e à confiança do laudo,
 * não ordem da Viva. A ordem é só de exibição (rotação), sem peso para quem avalia.
 */
export function sugerirAvaliadores(fila: AvaliadorFila[], pedido: PedidoParaDesignar, historico: HistoricoDesignacao, agora: Date): Sugestoes {
  const impedidos: Sugestoes["impedidos"] = [];
  const sugeridos: AvaliadorFila[] = [];
  for (const a of fila) {
    const m = impedimento(a, pedido, historico, agora);
    if (!m) sugeridos.push(a);
    else if (m !== "outra_cidade") impedidos.push({ id: a.id, motivo: m });
  }
  const t = (s: string | null) => (s ? Date.parse(s) : -Infinity);
  sugeridos.sort((x, y) => t(x.ultimaDesignacaoEm) - t(y.ultimaDesignacaoEm) || Date.parse(x.credenciadoEm) - Date.parse(y.credenciadoEm) || x.id.localeCompare(y.id));
  return { sugeridos, impedidos };
}

// ── 2. Faixa de referência e proposta própria ──────────────────────────────────────────────────────────────────
/** Percentuais PROVISÓRIOS da faixa em torno do valor da tabela (a confirmar com o Daniel); só afetam o que é exibido. */
export const FAIXA_REFERENCIA = { abaixo: 0.8, acima: 1.25 } as const;
export const PRAZO_PROPOSTA_MAX_DIAS = 30;

export interface FaixaReferencia {
  referencia: number;
  min: number;
  max: number;
}

export function faixaDeReferencia(valorTabela: number): FaixaReferencia {
  return { referencia: valorTabela, min: Math.round(valorTabela * FAIXA_REFERENCIA.abaixo), max: Math.round(valorTabela * FAIXA_REFERENCIA.acima) };
}

export type ResultadoProposta = { ok: true; valor: number; prazoDias: number; foraDaFaixa: boolean } | { ok: false; erro: string };

/**
 * O preço e o prazo são do avaliador. Só se recusa o que não faz sentido (valor não positivo, prazo que não é um número
 * inteiro de dias entre 1 e 30). Fora da faixa de referência NÃO bloqueia: o dono vê a sinalização e decide.
 */
export function validarProposta(e: { valor: number; prazoDias: number }, faixa: FaixaReferencia): ResultadoProposta {
  if (!Number.isFinite(e.valor) || e.valor <= 0) return { ok: false, erro: "Informe o valor da avaliação (maior que zero)." };
  if (!Number.isInteger(e.prazoDias) || e.prazoDias < 1 || e.prazoDias > PRAZO_PROPOSTA_MAX_DIAS) return { ok: false, erro: `Informe o prazo em dias inteiros (de 1 a ${PRAZO_PROPOSTA_MAX_DIAS}).` };
  const valor = Math.round(e.valor * 100) / 100;
  return { ok: true, valor, prazoDias: e.prazoDias, foraDaFaixa: valor < faixa.min || valor > faixa.max };
}

// ── 3. Laudo assinado pelo avaliador ───────────────────────────────────────────────────────────────────────────
export interface EntradaAssinatura {
  /** SHA-256 do PDF do laudo (o mesmo que a Viva já guarda em `documentos`). */
  pdfSha256: string;
  avaliadorUserId: string;
  numeroCredenciado: string;
  nomePublico: string;
  /** CNPJ do avaliador (só dígitos): ele assina como empresa. */
  cnpj: string;
  em: string;
  /** O avaliador marcou a declaração de assinatura. */
  declarou: boolean;
}

export type Assinatura = { ok: true; hash: string; termo: string; em: string } | { ok: false; erro: string };

export function assinaturaDoLaudo(e: EntradaAssinatura): Assinatura {
  if (!e.declarou) return { ok: false, erro: "Para enviar, assine o laudo: marque que você, avaliador, responde pelo que está nele." };
  if (!/^[0-9a-f]{64}$/.test(e.pdfSha256)) return { ok: false, erro: "Laudo sem registro para assinar." };
  if (!/^\d{14}$/.test(e.cnpj.replace(/\D/g, ""))) return { ok: false, erro: "Sem o CNPJ do avaliador no cadastro, o laudo não pode ser assinado." };
  const cnpj = e.cnpj.replace(/\D/g, "");
  const termo = `Assino este laudo como avaliador ${e.nomePublico} (credenciado ${e.numeroCredenciado}, CNPJ ${cnpj}) e respondo pelo que consta nele. A Viva Nomads forneceu o modelo e guarda o registro; não interferiu no conteúdo.`;
  const hash = createHash("sha256").update(["viva-laudo-assinado-v1", e.pdfSha256, e.avaliadorUserId, e.numeroCredenciado, cnpj, e.em, termo].join("\n")).digest("hex");
  return { ok: true, hash, termo, em: e.em };
}

// ── 4. Critérios públicos de qualidade (no lugar da suspensão automática e do descredenciamento discricionário) ─
export interface CriterioPublico {
  id: "ausencia_sem_aviso" | "nao_confere_auditoria" | "laudo_fora_do_prazo" | "conduta_baixa";
  texto: string;
  /** Quantidade (ou nota máxima, na conduta) que abre a revisão. */
  limite: number;
}

/** Valores iniciais: os mesmos números que já valiam (2 ausências em 90 dias, 2 "não confere" em 12 meses) + prazo e conduta. */
export const CRITERIOS_PUBLICOS: readonly CriterioPublico[] = [
  { id: "ausencia_sem_aviso", texto: "Faltar a 3 visitas agendadas, sem avisar o proprietário, em 90 dias.", limite: 3 },
  { id: "nao_confere_auditoria", texto: "Ter 2 laudos que a verificação por amostragem apontou como \"não confere\" em 12 meses.", limite: 2 },
  { id: "laudo_fora_do_prazo", texto: "Entregar 3 laudos fora do prazo que o próprio avaliador propôs, em 180 dias.", limite: 3 },
  { id: "conduta_baixa", texto: "Nota média de conduta abaixo de 3 (de 5), com pelo menos 5 avaliações dos proprietários.", limite: 3 },
];
export const MINIMO_AVALIACOES_CONDUTA = 5;
export const DIAS_DIREITO_DE_RESPOSTA = 7;

export interface IndicadoresAvaliador {
  ausenciasSemAviso90d: number;
  naoConfere12m: number;
  laudosForaDoPrazo180d: number;
  notaConduta: number | null;
  avaliacoesConduta: number;
}

/** Quais critérios públicos foram atingidos. Só isso: abre uma REVISÃO humana; o status do avaliador não muda sozinho. */
export function criteriosAtingidos(i: IndicadoresAvaliador): CriterioPublico["id"][] {
  const lim = (id: CriterioPublico["id"]) => CRITERIOS_PUBLICOS.find((c) => c.id === id)!.limite;
  const r: CriterioPublico["id"][] = [];
  if (i.ausenciasSemAviso90d >= lim("ausencia_sem_aviso")) r.push("ausencia_sem_aviso");
  if (i.naoConfere12m >= lim("nao_confere_auditoria")) r.push("nao_confere_auditoria");
  if (i.laudosForaDoPrazo180d >= lim("laudo_fora_do_prazo")) r.push("laudo_fora_do_prazo");
  if (i.notaConduta !== null && i.avaliacoesConduta >= MINIMO_AVALIACOES_CONDUTA && i.notaConduta < lim("conduta_baixa")) r.push("conduta_baixa");
  return r;
}

export type DescredenciamentoValido = { ok: true; criterioId: CriterioPublico["id"]; direitoDeRespostaDias: number } | { ok: false; erro: string };

/** Descredenciar só por um critério público, com motivo escrito (e o avaliador pode responder antes da decisão final). */
export function descredenciamentoValido(e: { criterioId: string | null; motivo: string }): DescredenciamentoValido {
  const c = CRITERIOS_PUBLICOS.find((x) => x.id === e.criterioId);
  if (!c) return { ok: false, erro: "Descredenciar exige um dos critérios públicos de qualidade." };
  if (e.motivo.trim().length < 20) return { ok: false, erro: "Descreva o fato concreto que atingiu o critério (mínimo de 20 caracteres)." };
  return { ok: true, criterioId: c.id, direitoDeRespostaDias: DIAS_DIREITO_DE_RESPOSTA };
}

// ── 5. Os termos do avaliador (E682): valor, prazo de entrega e prazo de resposta são DELE ────────────────────────
export const PRAZO_RESPOSTA_PADRAO_HORAS = 24;
export const PRAZO_RESPOSTA_MAX_HORAS = 72;
/** E682 (refino): prazo do DONO para aceitar a proposta do avaliador (72 h, decisão do Daniel em 07/11/2026). Passado, a escolha volta ao dono. */
export const PRAZO_DONO_ACEITAR_HORAS = 72;

/** A proposta do avaliador está parada, sem aceite do dono, há mais que o prazo do dono? */
export function propostaVencida(propostaEm: string | null, agora: Date, horas = PRAZO_DONO_ACEITAR_HORAS): boolean {
  if (!propostaEm) return false;
  const t = Date.parse(propostaEm);
  return Number.isFinite(t) && agora.getTime() >= t + horas * 3_600_000;
}

export type ResultadoTermos = { ok: true; valor: number; prazoEntregaDias: number; prazoRespostaHoras: number } | { ok: false; erro: string };

/** O avaliador declara o próprio valor, o prazo de entrega do laudo e em quantas horas responde a um pedido. Nada é imposto pela Viva. */
export function validarTermos(e: { valor: number; prazoEntregaDias: number; prazoRespostaHoras: number }): ResultadoTermos {
  if (!Number.isFinite(e.valor) || e.valor <= 0) return { ok: false, erro: "Informe o seu valor (maior que zero)." };
  if (!Number.isInteger(e.prazoEntregaDias) || e.prazoEntregaDias < 1 || e.prazoEntregaDias > PRAZO_PROPOSTA_MAX_DIAS) return { ok: false, erro: `Informe o prazo de entrega em dias inteiros (de 1 a ${PRAZO_PROPOSTA_MAX_DIAS}).` };
  if (!Number.isInteger(e.prazoRespostaHoras) || e.prazoRespostaHoras < 1 || e.prazoRespostaHoras > PRAZO_RESPOSTA_MAX_HORAS) return { ok: false, erro: `Informe em quantas horas você responde a um pedido (de 1 a ${PRAZO_RESPOSTA_MAX_HORAS}).` };
  return { ok: true, valor: Math.round(e.valor * 100) / 100, prazoEntregaDias: e.prazoEntregaDias, prazoRespostaHoras: e.prazoRespostaHoras };
}

/**
 * A linha de cada avaliador na lista de escolha do dono: SÓ a conduta publicada. A lista NÃO mostra preço nem prazo
 * (E682, decisão do Daniel): valor e prazo vêm na proposta do avaliador, depois que o dono o escolhe.
 */
export function linhaDeTermos(a: { notaConduta: number | null; avaliacoesConduta: number }): string {
  return a.notaConduta != null && a.avaliacoesConduta > 0
    ? `conduta ${a.notaConduta.toFixed(1).replace(".", ",")} · ${a.avaliacoesConduta} ${a.avaliacoesConduta === 1 ? "avaliação feita" : "avaliações feitas"}`
    : "sem avaliações de conduta ainda";
}
