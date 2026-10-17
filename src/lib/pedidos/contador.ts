/*
  Contador ao vivo do Pedido de Moradia (ordem 8dca1437, item 1).
  Enquanto a pessoa preenche /pedidos/novo, conta quantos imóveis combinam e,
  quando der 0, aponta qual campo afrouxar. Módulo PURO (sem imports).

  Espelha a regra do banco `compatibilidade_pedidos` (0064/0065): mesma cidade,
  vagas ≥ ocupantes, total ≤ orçamento × 1,10, prazo dentro de [mín, máx],
  livre e disponível na entrada, pet/criança aceitos, faixa aceita. A regra
  OFICIAL (a que avisa os donos) segue no banco; aqui é só a estimativa da tela.
*/

export interface RascunhoPedido {
  dataInicio: string; // yyyy-mm-dd
  prazoMeses: number;
  ocupantes: number;
  orcamento: number;
  pets: boolean;
  criancas: boolean;
}

/** Um imóvel ativo, com documento aprovado, na cidade do pedido. */
export interface ImovelDaCidade {
  /** aluguel + condomínio + consumo fixo, por mês. */
  total: number;
  minDias: number;
  maxDias: number;
  maxHospedes: number | null;
  aceitaPets: boolean;
  aceitaCriancas: boolean;
  faixasAceitas: string[];
  disponivelDesde: string | null;
  disponivelAte: string | null;
  /** Há contrato ou bloqueio no período pedido. */
  ocupadoNoPeriodo: boolean;
}

export type Regra = "ocupantes" | "orcamento" | "prazo" | "entrada" | "pet" | "criancas" | "faixa";

export interface Avaliacao {
  ok: Record<Regra, boolean>;
  combina: boolean;
}

export interface ResultadoContador {
  /** Imóveis que passam em todas as regras. */
  combinam: number;
  /** Imóveis da cidade (ativos, com documento aprovado). */
  naCidade: number;
  /** Qual campo afrouxar quando combinam = 0 (null se não há o que sugerir). */
  dica: string | null;
}

export const DIAS_POR_MES = 30;

export function diasDoPrazo(meses: number): number {
  return Math.round(meses) * DIAS_POR_MES;
}

/** Fim da estadia pedida (yyyy-mm-dd): entrada + dias − 1. */
export function saidaDoPedido(dataInicio: string, meses: number): string {
  const t = Date.parse(`${dataInicio}T00:00:00Z`);
  return new Date(t + (diasDoPrazo(meses) - 1) * 86_400_000).toISOString().slice(0, 10);
}

export function avaliarImovel(p: RascunhoPedido, im: ImovelDaCidade): Avaliacao {
  const dias = diasDoPrazo(p.prazoMeses);
  const faixa = dias < 90 ? "temporada" : "media_estadia";
  const ok: Record<Regra, boolean> = {
    ocupantes: im.maxHospedes != null && im.maxHospedes >= p.ocupantes,
    orcamento: im.total <= p.orcamento * 1.1,
    prazo: dias >= im.minDias && dias <= im.maxDias,
    entrada:
      !im.ocupadoNoPeriodo &&
      (im.disponivelAte == null || im.disponivelAte >= p.dataInicio) &&
      (im.disponivelDesde == null || im.disponivelDesde <= p.dataInicio),
    pet: !p.pets || im.aceitaPets,
    criancas: !p.criancas || im.aceitaCriancas,
    faixa: im.faixasAceitas.length === 0 || im.faixasAceitas.includes(faixa),
  };
  return { ok, combina: Object.values(ok).every(Boolean) };
}

const brl = (v: number) => `R$ ${Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
const imoveis = (n: number) => (n === 1 ? "1 imóvel" : `${n} imóveis`);
const combinariam = (n: number) => (n === 1 ? "combinaria" : "combinariam");

/** Prioridade quando duas regras liberam o mesmo número de imóveis. */
const ORDEM_DICA: Regra[] = ["orcamento", "entrada", "prazo", "ocupantes", "pet", "criancas", "faixa"];

function textoDica(regra: Regra, so: ImovelDaCidade[], p: RascunhoPedido): string {
  const n = so.length;
  switch (regra) {
    case "orcamento": {
      const menor = Math.min(...so.map((i) => i.total));
      const sugerido = Math.ceil(menor / 1.1 / 50) * 50;
      return `Com orçamento de ${brl(sugerido)} por mês, ${imoveis(n)} ${combinariam(n)}.`;
    }
    case "entrada":
      return `Só a data de entrada impede ${imoveis(n)} de combinar — tente outra data.`;
    case "prazo": {
      const min = Math.min(...so.map((i) => i.minDias));
      const max = Math.max(...so.map((i) => i.maxDias));
      return `Só o prazo impede ${imoveis(n)} de combinar — esses anúncios aceitam de ${min} a ${max} dias.`;
    }
    case "ocupantes":
      return `Só o número de pessoas impede ${imoveis(n)} de combinar — com menos ocupantes ${combinariam(n)}.`;
    case "pet":
      return `Sem pet, ${imoveis(n)} ${combinariam(n)}.`;
    case "criancas":
      return `Sem crianças, ${imoveis(n)} ${combinariam(n)}.`;
    case "faixa":
      return `Só o prazo escolhido impede ${imoveis(n)} de combinar (${p.prazoMeses} ${p.prazoMeses === 1 ? "mês" : "meses"}) — tente outro prazo.`;
  }
}

/** Conta os imóveis que combinam e, se nenhum, qual campo afrouxar. */
export function contarCompativeis(p: RascunhoPedido, lista: ImovelDaCidade[]): ResultadoContador {
  const avals = lista.map((im) => ({ im, a: avaliarImovel(p, im) }));
  const combinam = avals.filter((x) => x.a.combina).length;
  if (combinam > 0) return { combinam, naCidade: lista.length, dica: null };
  if (lista.length === 0) return { combinam: 0, naCidade: 0, dica: null };

  let melhor: { regra: Regra; so: ImovelDaCidade[] } | null = null;
  for (const regra of ORDEM_DICA) {
    // Imóveis em que SÓ esta regra falha.
    const so = avals
      .filter((x) => !x.a.ok[regra] && Object.entries(x.a.ok).every(([k, v]) => k === regra || v))
      .map((x) => x.im);
    if (so.length > (melhor?.so.length ?? 0)) melhor = { regra, so };
  }
  return { combinam: 0, naCidade: lista.length, dica: melhor ? textoDica(melhor.regra, melhor.so, p) : null };
}
