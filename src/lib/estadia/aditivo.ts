/*
  Propor alteração / aditivo (Prompt 32, item 6) — regras puras.
  Qualquer parte propõe mudar a data de entrada, os meses (data de saída), os ocupantes ou o valor mensal; ocupantes
  e valor mensal só valem para blocos ainda não iniciados. A outra parte aceita ou recusa (validade 7 dias). Aceito, o
  aditivo (texto com antes e depois) é assinado pelas duas partes no mesmo fluxo com código; só então blocos e datas
  mudam. Sem cláusula nova de multa ou devolução até o parecer jurídico: o aditivo só registra o que mudou.

  Taxa de serviço (decisão (a) do Daniel, 18/10; resposta do Muse, 21/10): só sobre a parte acrescentada ou
  retirada; a parte já contratada fica com a taxa congelada no aceite. Cobrança extra pelo fluxo da taxa que já
  existe; abatimento vira crédito registrado para o admin quitar. Nada passa por dinheiro do morador.
*/
import {
  DIAS_POR_MES,
  MAX_MESES_BLOCO,
  PRAZO_MAX_MESES,
  PRAZO_MIN_MESES,
  addDiasISO,
  caucaoDoBloco,
  fimInclusivoISO,
} from "../contrato-blocos.ts";
import { comissaoSobreContrato, pctTexto } from "../cobranca/regra.ts";
import { ddmmaaaa } from "./estadia.ts";

/** Validade da proposta: 7 dias para a outra parte responder. */
export const VALIDADE_PROPOSTA_DIAS = 7;

export interface Antes<T> {
  antes: T;
  depois: T;
}

export interface MudancasAditivo {
  inicio?: Antes<string>;
  meses?: Antes<number>;
  ocupantes?: Antes<number>;
  valorMensal?: Antes<number>;
}

export interface BlocoAtual {
  numero_bloco: number;
  inicio: string;
  fim: string;
  meses: number;
  valor: number;
  caucao: number;
  status: string;
}

/**
 * Bloco iniciado = a data de início já chegou (calendário de Brasília). Não dá para usar o status: o 1º bloco nasce
 * "ativo" antes da entrada e os seguintes nascem "pendente_aceite" (0063). Esses não mudam por aditivo.
 */
export const blocoIniciado = (b: Pick<BlocoAtual, "inicio">, hojeISO: string) => b.inicio <= hojeISO;

/** Proposta de renovação que caducou sem os dois aceites (0063): fora do contrato, não conta nem muda. */
export const blocoValido = (b: Pick<BlocoAtual, "status">) => b.status !== "nao_aceito";

export interface ContratoParaAditivo {
  valorMensal: number;
  ocupantes: number;
  capacidade: number;
  tamanhoBlocoMeses: number;
  blocos: BlocoAtual[];
}

export interface PropostaAditivo {
  inicio?: string | null;
  meses?: number | null;
  ocupantes?: number | null;
  valorMensal?: number | null;
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; erro: string };

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function mesesDoContrato(blocos: Pick<BlocoAtual, "meses" | "status">[]): number {
  return blocos.filter(blocoValido).reduce((s, b) => s + b.meses, 0);
}

/** Valida a proposta contra o contrato e devolve só o que muda (antes e depois). */
export function validarProposta(c: ContratoParaAditivo, p: PropostaAditivo, hojeISO: string): Resultado<MudancasAditivo> {
  const blocos = [...c.blocos].filter(blocoValido).sort((a, b) => a.numero_bloco - b.numero_bloco);
  const iniciados = blocos.filter((b) => blocoIniciado(b, hojeISO));
  const futuros = blocos.filter((b) => !blocoIniciado(b, hojeISO));
  const inicioAtual = blocos[0]?.inicio ?? null;
  const mesesAtuais = mesesDoContrato(blocos);
  const m: MudancasAditivo = {};

  if (p.inicio && p.inicio !== inicioAtual) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.inicio)) return { ok: false, erro: "Data de entrada inválida." };
    if (iniciados.length > 0 || (inicioAtual && inicioAtual <= hojeISO)) return { ok: false, erro: "A entrada já aconteceu: a data de entrada não muda mais." };
    if (p.inicio <= hojeISO) return { ok: false, erro: "A nova data de entrada precisa ser depois de hoje." };
    m.inicio = { antes: inicioAtual ?? "", depois: p.inicio };
  }
  if (p.meses != null && p.meses !== mesesAtuais) {
    const minimo = Math.max(PRAZO_MIN_MESES, mesesDoContrato(iniciados));
    if (!Number.isInteger(p.meses) || p.meses < minimo || p.meses > PRAZO_MAX_MESES) {
      return { ok: false, erro: `O contrato pode ter de ${minimo} a ${PRAZO_MAX_MESES} meses (os meses já iniciados não mudam).` };
    }
    m.meses = { antes: mesesAtuais, depois: p.meses };
  }
  const restaFuturo = futuros.length > 0 || (m.meses ? m.meses.depois > mesesDoContrato(iniciados) : false);
  if (p.ocupantes != null && p.ocupantes !== c.ocupantes) {
    if (!restaFuturo) return { ok: false, erro: "Ocupantes só mudam para blocos que ainda não começaram." };
    if (!Number.isInteger(p.ocupantes) || p.ocupantes < 1 || p.ocupantes > Math.max(1, c.capacidade)) {
      return { ok: false, erro: `Ocupantes: de 1 a ${Math.max(1, c.capacidade)} neste imóvel.` };
    }
    m.ocupantes = { antes: c.ocupantes, depois: p.ocupantes };
  }
  if (p.valorMensal != null && Math.round(p.valorMensal * 100) !== Math.round(c.valorMensal * 100)) {
    if (!restaFuturo) return { ok: false, erro: "O valor mensal só muda para blocos que ainda não começaram." };
    if (!Number.isFinite(p.valorMensal) || p.valorMensal < 100 || p.valorMensal > 100_000) return { ok: false, erro: "Valor mensal inválido." };
    m.valorMensal = { antes: c.valorMensal, depois: Math.round(p.valorMensal * 100) / 100 };
  }
  if (Object.keys(m).length === 0) return { ok: false, erro: "Nada mudou: altere ao menos um campo." };
  return { ok: true, valor: m };
}

/** "Entrada: de 13/11/2026 para 20/11/2026 · Meses: de 3 para 4" — o texto do aditivo (antes e depois). */
export function resumoDasMudancas(m: MudancasAditivo): string {
  const partes: string[] = [];
  if (m.inicio) partes.push(`Entrada: de ${m.inicio.antes ? ddmmaaaa(m.inicio.antes) : "a definir"} para ${ddmmaaaa(m.inicio.depois)}`);
  if (m.meses) partes.push(`Meses: de ${m.meses.antes} para ${m.meses.depois}`);
  if (m.ocupantes) partes.push(`Ocupantes: de ${m.ocupantes.antes} para ${m.ocupantes.depois}`);
  if (m.valorMensal) partes.push(`Valor mensal: de ${brl(m.valorMensal.antes)} para ${brl(m.valorMensal.depois)}`);
  return partes.join(" · ");
}

/** Linhas do documento do aditivo (o hash cobre exatamente isto). Sem cláusula de multa ou devolução. */
export function linhasDoAditivo(a: { numeroContrato: string; numero: number; mudancas: MudancasAditivo; propostoEm: string }): string[] {
  return [
    `Aditivo ${a.numero} ao contrato ${a.numeroContrato}`,
    `Proposto em ${ddmmaaaa(a.propostoEm)}`,
    "O que muda (antes → depois):",
    ...resumoDasMudancas(a.mudancas).split(" · ").map((l) => `• ${l}`),
    "As demais condições do contrato continuam as mesmas.",
  ];
}

export function expirou(expiraEm: string, agora: Date = new Date()): boolean {
  return agora.getTime() > Date.parse(expiraEm);
}

export function expiraEmDe(agora: Date = new Date()): string {
  return new Date(agora.getTime() + VALIDADE_PROPOSTA_DIAS * 86_400_000).toISOString();
}

// ── Taxa de serviço do aditivo ──────────────────────────────────────────────────────────────────────────────────
export interface LinhaTaxaAditivo {
  /** Positivo = cobrança a mais; negativo = abatimento (crédito para o admin quitar). */
  valor: number;
  percentual: number;
  base: string;
}

export interface TaxaDoAditivo {
  linhas: LinhaTaxaAditivo[];
  /** Soma das linhas (pode ser negativa = crédito). */
  valor: number;
  /** A taxa da faixa usada nas cobranças a mais (para gravar no aditivo). */
  percentualFaixa: number;
  baseTexto: string;
}

/**
 * Taxa só sobre a parte alterada:
 *  • meses acrescentados: valor mensal (novo, se mudou) × meses acrescentados × a faixa do dono no aceite do aditivo;
 *  • meses retirados: abatimento = valor mensal (antes) × meses retirados × a taxa congelada do contrato;
 *  • valor mensal alterado: diferença × meses restantes (não iniciados, da parte que já existia) — aumento na faixa
 *    do aditivo, redução abate pela taxa congelada.
 */
export function taxaDoAditivo(
  m: MudancasAditivo,
  c: { valorMensal: number; mesesNaoIniciados: number; taxaCongelada: number; taxaFaixaAgora: number },
): TaxaDoAditivo {
  const linhas: LinhaTaxaAditivo[] = [];
  const valorAntes = m.valorMensal?.antes ?? c.valorMensal;
  const valorDepois = m.valorMensal?.depois ?? c.valorMensal;
  const delta = m.meses ? m.meses.depois - m.meses.antes : 0;
  if (delta > 0) {
    const v = comissaoSobreContrato(valorDepois, delta, c.taxaFaixaAgora);
    linhas.push({ valor: v, percentual: c.taxaFaixaAgora, base: `${brl(valorDepois)} × ${delta} ${delta === 1 ? "mês acrescentado" : "meses acrescentados"} × ${pctTexto(c.taxaFaixaAgora)} (faixa atual) = ${brl(v)}` });
  } else if (delta < 0) {
    const v = comissaoSobreContrato(valorAntes, -delta, c.taxaCongelada);
    linhas.push({ valor: -v, percentual: c.taxaCongelada, base: `${brl(valorAntes)} × ${-delta} ${delta === -1 ? "mês retirado" : "meses retirados"} × ${pctTexto(c.taxaCongelada)} (taxa congelada) = abatimento de ${brl(v)}` });
  }
  if (m.valorMensal) {
    // A parte que já existia e ainda não começou (sem os meses acrescentados, já cobrados no valor novo).
    const restantes = Math.max(0, c.mesesNaoIniciados + Math.min(0, delta));
    const dif = Math.round((valorDepois - valorAntes) * 100) / 100;
    if (restantes > 0 && dif !== 0) {
      const sobe = dif > 0;
      const taxa = sobe ? c.taxaFaixaAgora : c.taxaCongelada;
      const v = comissaoSobreContrato(Math.abs(dif), restantes, taxa);
      linhas.push({
        valor: sobe ? v : -v,
        percentual: taxa,
        base: `diferença de ${brl(Math.abs(dif))} × ${restantes} ${restantes === 1 ? "mês restante" : "meses restantes"} × ${pctTexto(taxa)} (${sobe ? "faixa atual" : "taxa congelada"}) = ${sobe ? "" : "abatimento de "}${brl(v)}`,
      });
    }
  }
  const valor = Math.round(linhas.reduce((s, l) => s + l.valor, 0) * 100) / 100;
  return {
    linhas,
    valor,
    percentualFaixa: c.taxaFaixaAgora,
    baseTexto: linhas.length ? `Taxa de serviço do aditivo: ${linhas.map((l) => l.base).join("; ")}` : "Taxa de serviço do aditivo: sem alteração.",
  };
}

// ── Blocos depois do aditivo ────────────────────────────────────────────────────────────────────────────────────
export interface BlocoNovo {
  numero_bloco: number;
  inicio: string;
  fim: string;
  meses: number;
  valor: number;
  caucao: number;
  /** O 1º bloco nasce vigente (como na criação); os seguintes entram "agendado" com os dois aceites (o aditivo assinado). */
  status: "ativo" | "agendado";
}

/**
 * Os blocos depois das duas assinaturas: os iniciados ficam como estão; os não iniciados são refeitos com os meses
 * e o valor novos, encadeados a partir do dia seguinte ao último iniciado (ou da nova entrada). A Caução segue a
 * regra de sempre (50% do bloco, até 3 valores mensais no contrato).
 */
export function blocosDepoisDoAditivo(
  c: ContratoParaAditivo,
  m: MudancasAditivo,
  hojeISO: string,
): { manter: BlocoAtual[]; refazer: BlocoAtual[]; novos: BlocoNovo[] } {
  const todos = [...c.blocos].sort((a, b) => a.numero_bloco - b.numero_bloco);
  const blocos = todos.filter(blocoValido);
  const manter = blocos.filter((b) => blocoIniciado(b, hojeISO));
  const refazer = blocos.filter((b) => !blocoIniciado(b, hojeISO));
  const mesesTotal = m.meses?.depois ?? mesesDoContrato(blocos);
  const valor = m.valorMensal?.depois ?? c.valorMensal;
  let restante = mesesTotal - mesesDoContrato(manter);
  const passo = Math.min(Math.max(1, c.tamanhoBlocoMeses), MAX_MESES_BLOCO);
  let cursor = manter.length ? addDiasISO(manter[manter.length - 1].fim, 1) : (m.inicio?.depois ?? blocos[0]?.inicio);
  // Numeração segue depois do maior número que fica no banco (um bloco "nao_aceito" mantém o número dele).
  const ficam = todos.filter((b) => !refazer.includes(b));
  let numero = Math.max(0, ...ficam.map((b) => b.numero_bloco)) + 1;
  let caucaoAcumulada = manter.reduce((s, b) => s + Number(b.caucao), 0);
  const novos: BlocoNovo[] = [];
  while (restante > 0 && cursor) {
    const meses = Math.min(passo, restante);
    const v = Math.round(valor * meses * 100) / 100;
    const caucao = caucaoDoBloco(v, valor, caucaoAcumulada);
    caucaoAcumulada += caucao;
    const fim = fimInclusivoISO(cursor, meses * DIAS_POR_MES);
    novos.push({ numero_bloco: numero, inicio: cursor, fim, meses, valor: v, caucao, status: numero === 1 ? "ativo" : "agendado" });
    cursor = addDiasISO(fim, 1);
    restante -= meses;
    numero += 1;
  }
  return { manter, refazer, novos };
}

/** Meses ainda não iniciados no contrato atual (base da diferença do valor mensal). */
export function mesesNaoIniciados(blocos: BlocoAtual[], hojeISO: string): number {
  return mesesDoContrato(blocos.filter((b) => !blocoIniciado(b, hojeISO)));
}

/** "Aditivo 1 — 21/10/2026 — Meses: de 3 para 4" (histórico da página). */
export function linhaDoHistorico(a: { numero: number; assinadoEm: string | null; criadoEm: string; resumo: string }): string {
  return `Aditivo ${a.numero} — ${ddmmaaaa((a.assinadoEm ?? a.criadoEm).slice(0, 10))} — ${a.resumo}`;
}
