/*
  E399-C, pacote 2 — o MOTOR do selo "Preço justo" (PURO).
   - Total de 30 noites do anúncio no Airbnb = simulação das próximas 30 noites DISPONÍVEIS, noite a noite, com o
     desconto de estadia longa (mensal; sem ele, o semanal), + limpeza + taxa do hóspede. Nunca diária × 30; com menos
     de 30 noites livres no calendário, não há dado.
   - Selo só se o Total por mês da Viva (com contas, calcularTudoIncluido) for ESTRITAMENTE MENOR; igual não ganha.
   - Maior ou igual → aviso só ao dono, com o valor lá e a recomendação "até R$ Y" (o maior total inteiro que ganha).
   - Reconsulta semanal; dado com mais de 14 dias suspende o selo.
  Roda: node --test src/lib/comparador-airbnb/pacote2.test.ts
*/
import type { Conferencia } from "./antifraude.ts";

export const DIAS_RECONSULTA = 7;
export const DIAS_DADO_VALIDO = 14;
const DIA_MS = 86_400_000;
const centavos = (v: number) => Math.round(v * 100) / 100;

export interface NoiteAirbnb {
  data: string;
  preco: number;
  disponivel: boolean;
}

export interface CalendarioAirbnb {
  /** Noites a partir de hoje, em ordem. */
  noites: NoiteAirbnb[];
  descontoSemanalPct: number;
  descontoMensalPct: number;
  limpeza: number;
  /** Taxa de serviço cobrada do hóspede, sobre noites (com desconto) + limpeza. */
  taxaHospedePct: number;
}

const pct = (v: number) => (Number.isFinite(v) && v > 0 && v < 100 ? v / 100 : 0);

export function total30Noites(c: CalendarioAirbnb): { noites: number; total: number; primeiraNoite: string } | null {
  const livres = c.noites.filter((n) => n.disponivel && Number.isFinite(n.preco) && n.preco > 0).slice(0, 30);
  if (livres.length < 30) return null;
  const soma = livres.reduce((s, n) => s + n.preco, 0);
  const desconto = pct(c.descontoMensalPct) || pct(c.descontoSemanalPct);
  const limpeza = Number.isFinite(c.limpeza) && c.limpeza > 0 ? c.limpeza : 0;
  const base = soma * (1 - desconto) + limpeza;
  return { noites: 30, total: centavos(base * (1 + pct(c.taxaHospedePct))), primeiraNoite: livres[0].data };
}

/** O maior Total por mês INTEIRO que ainda fica estritamente abaixo do Airbnb. */
export function recomendacaoAte(total30: number): number {
  return Math.ceil(total30) - 1;
}

export interface EntradaSelo {
  totalViva: number;
  total30: number | null;
  consultadoEm: string | null;
  conferencia: Conferencia;
}

export type EstadoSelo = "justo" | "acima" | "sem_link" | "bloqueado" | "sem_dado" | "suspenso";

export interface DecisaoSelo {
  selo: boolean;
  estado: EstadoSelo;
  /** Só quando a Viva fica igual ou acima: o que o dono vê (painel e e-mail). Nunca público. */
  avisoDono: { valorAirbnb: number; ate: number } | null;
}

export function decidirSelo(e: EntradaSelo | null, agora: Date): DecisaoSelo {
  const nada = (estado: EstadoSelo): DecisaoSelo => ({ selo: false, estado, avisoDono: null });
  if (!e) return nada("sem_link");
  if (e.conferencia !== "confere") return nada("bloqueado");
  if (e.total30 == null || !(e.total30 > 0) || !e.consultadoEm || !(e.totalViva > 0)) return nada("sem_dado");
  const idade = agora.getTime() - Date.parse(e.consultadoEm);
  if (!Number.isFinite(idade) || idade > DIAS_DADO_VALIDO * DIA_MS) return nada("suspenso");
  if (e.totalViva < e.total30) return { selo: true, estado: "justo", avisoDono: null };
  return { selo: false, estado: "acima", avisoDono: { valorAirbnb: e.total30, ate: recomendacaoAte(e.total30) } };
}

export function precisaReconsultar(consultadoEm: string | null, agora: Date): boolean {
  if (!consultadoEm) return true;
  const t = Date.parse(consultadoEm);
  return !Number.isFinite(t) || agora.getTime() - t >= DIAS_RECONSULTA * DIA_MS;
}

/** Pacote 3 — o que a FICHA do anúncio mostra (só com o selo; o aviso de preço acima é só do dono). */
export interface ComparacaoFicha {
  totalAirbnb30: number;
  /** Quanto o total por mês da Viva fica abaixo das 30 noites no Airbnb. */
  diferenca: number;
  consultadoEm: string;
  /** Fonte simulada (antes do fornecedor real). */
  simulado: boolean;
}

export function comparacaoParaFicha(e: (EntradaSelo & { fonte: string | null }) | null, agora: Date): ComparacaoFicha | null {
  if (!e || !decidirSelo(e, agora).selo || e.total30 == null || !e.consultadoEm) return null;
  return {
    totalAirbnb30: e.total30,
    diferenca: Math.round((e.total30 - e.totalViva) * 100) / 100,
    consultadoEm: e.consultadoEm,
    simulado: (e.fonte ?? "simulada") === "simulada",
  };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function textoComparacaoFicha(c: ComparacaoFicha): { principal: string; detalhe: string; simulado: string | null } {
  const [, mes, dia] = c.consultadoEm.slice(0, 10).split("-");
  return {
    principal: `Total por mês ${brl(c.diferenca)} a menos que 30 noites do mesmo imóvel no Airbnb.`,
    detalhe: `30 noites no Airbnb: ${brl(c.totalAirbnb30)}, com descontos, limpeza e taxas (consulta de ${dia}/${mes}).`,
    simulado: c.simulado ? "Valores simulados enquanto a consulta real não está ligada." : null,
  };
}
