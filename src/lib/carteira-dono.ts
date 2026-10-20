/*
  Análise da carteira do proprietário (complemento do prompt 27, item 8) — regra PURA e testável.
  Um item por imóvel ATIVO do dono, com a situação tirada do contrato real:
    • ocupado   = contrato ativo EM VIGÊNCIA (duas assinaturas + 1º pagamento confirmado — etapaContrato);
    • reservado = contrato ativo aguardando assinatura ou o 1º pagamento;
    • vago      = sem contrato ativo (concluído, cancelado ou nenhum).
  A etapa e o selo vêm da fonte única (estadoDoContratoUnico, via getMeusContratos). Um contrato vigente por imóvel
  (o banco não deixa dois períodos ativos se sobreporem — 0176); os seguintes aparecem como "Próximo morador".
  Início e fim saem dos blocos do contrato (periodoDosBlocos, a mesma função da página do contrato).
  A taxa de serviço NÃO entra na receita: ela é cobrada à parte.
*/
import type { EtapaContrato } from "./contrato-etapas.ts";
import { periodoDosBlocos } from "./contrato-blocos.ts";

export type SituacaoCarteira = "ocupado" | "reservado" | "vago";

export interface ImovelCarteiraEntrada {
  id: string;
  titulo: string;
  bairro: string;
}

export interface ContratoCarteiraEntrada {
  id: string;
  propertyId: string;
  /** contratos.status: "ativo", "concluido", "cancelado", "encerrado_sem_renovacao"… */
  status: string;
  etapa: EtapaContrato;
  valorMensal: number;
  blocos: { inicio: string; fim: string }[];
  /** Nome curto do morador ("Maria L."), já tratado no servidor. */
  morador: string | null;
  /** Selo da fonte única (o mesmo do detalhe e da lista de contratos). */
  selo?: string | null;
}

export interface ProximoMorador {
  contratoId: string;
  contratoNumero: string;
  inicio: string | null;
  fim: string | null;
  morador: string | null;
  selo: string | null;
}

export interface ItemCarteira {
  propertyId: string;
  titulo: string;
  bairro: string;
  situacao: SituacaoCarteira;
  /** Valor mensal do contrato (0 quando vago). */
  valorMensal: number;
  inicio: string | null;
  fim: string | null;
  /** Dias de hoje até o fim (negativo = já passou); null sem contrato. */
  diasAteFim: number | null;
  morador: string | null;
  contratoId: string | null;
  /** Os 8 primeiros caracteres do id, como nas outras telas. */
  contratoNumero: string | null;
  /** Selo do contrato da linha (fonte única); null quando vago. */
  selo?: string | null;
  /** Contratos ativos que começam depois do da linha: "Próximo morador a partir de dd/mm/aaaa". */
  proximos?: ProximoMorador[];
}

const DIA_MS = 86_400_000;

export function diasEntre(deISO: string, ateISO: string): number {
  return Math.round((Date.parse(`${ateISO}T00:00:00Z`) - Date.parse(`${deISO}T00:00:00Z`)) / DIA_MS);
}

/** Situação de um contrato na carteira. Só "ativo" ocupa ou reserva; o resto deixa o imóvel vago. */
export function situacaoDoContrato(c: Pick<ContratoCarteiraEntrada, "status" | "etapa">): SituacaoCarteira {
  if (c.status !== "ativo") return "vago";
  return c.etapa === "em_vigencia" ? "ocupado" : "reservado";
}

const PESO: Record<SituacaoCarteira, number> = { ocupado: 2, reservado: 1, vago: 0 };

export function montarCarteira(imoveis: ImovelCarteiraEntrada[], contratos: ContratoCarteiraEntrada[], hojeISO: string): ItemCarteira[] {
  return imoveis.map((im) => {
    // Um contrato por linha: o que está em vigência; sem ele, o reservado que começa primeiro. Os outros contratos
    // ativos do imóvel (períodos seguintes — o banco não deixa sobrepor) viram "Próximo morador".
    const ativos = contratos
      .filter((c) => c.propertyId === im.id)
      .map((c) => ({ c, s: situacaoDoContrato(c), p: periodoDosBlocos(c.blocos) }))
      .filter((x) => x.s !== "vago")
      .sort((a, b) => PESO[b.s] - PESO[a.s] || String(a.p.inicio ?? "").localeCompare(String(b.p.inicio ?? "")));
    const melhor = ativos[0];
    if (!melhor) {
      return { propertyId: im.id, titulo: im.titulo, bairro: im.bairro, situacao: "vago", valorMensal: 0, inicio: null, fim: null, diasAteFim: null, morador: null, contratoId: null, contratoNumero: null, selo: null, proximos: [] };
    }
    const { inicio, fim } = melhor.p;
    const proximos: ProximoMorador[] = ativos
      .slice(1)
      .sort((a, b) => String(a.p.inicio ?? "").localeCompare(String(b.p.inicio ?? "")))
      .map((x) => ({ contratoId: x.c.id, contratoNumero: x.c.id.slice(0, 8), inicio: x.p.inicio, fim: x.p.fim, morador: x.c.morador, selo: x.c.selo ?? null }));
    return {
      propertyId: im.id,
      titulo: im.titulo,
      bairro: im.bairro,
      situacao: melhor.s,
      valorMensal: melhor.c.valorMensal,
      inicio,
      fim,
      diasAteFim: fim ? diasEntre(hojeISO, fim) : null,
      morador: melhor.c.morador,
      contratoId: melhor.c.id,
      contratoNumero: melhor.c.id.slice(0, 8),
      selo: melhor.c.selo ?? null,
      proximos,
    };
  });
}

export interface IndicadoresCarteira {
  ativos: number;
  ocupados: number;
  reservados: number;
  vagos: number;
  /** ocupados ÷ ativos, em % inteiro. "Reservado" não conta como ocupado. */
  ocupacaoPct: number;
  /** Soma do valor mensal dos contratos ocupados. */
  receitaVigencia: number;
  /** Soma do valor mensal dos contratos reservados (ainda vão começar). */
  contratadaAComecar: number;
  /** Contratos (ocupados ou reservados) que terminam em até 30, de 31 a 60 e de 61 a 90 dias. */
  vence30: ItemCarteira[];
  vence60: ItemCarteira[];
  vence90: ItemCarteira[];
}

export function indicadoresCarteira(itens: ItemCarteira[]): IndicadoresCarteira {
  const ocupados = itens.filter((i) => i.situacao === "ocupado");
  const reservados = itens.filter((i) => i.situacao === "reservado");
  const comFim = itens
    .filter((i) => i.situacao !== "vago" && i.diasAteFim != null && i.diasAteFim >= 0)
    .sort((a, b) => (a.diasAteFim ?? 0) - (b.diasAteFim ?? 0));
  const entre = (de: number, ate: number) => comFim.filter((i) => (i.diasAteFim ?? 0) > de && (i.diasAteFim ?? 0) <= ate);
  return {
    ativos: itens.length,
    ocupados: ocupados.length,
    reservados: reservados.length,
    vagos: itens.length - ocupados.length - reservados.length,
    ocupacaoPct: itens.length ? Math.round((ocupados.length / itens.length) * 100) : 0,
    receitaVigencia: ocupados.reduce((s, i) => s + i.valorMensal, 0),
    contratadaAComecar: reservados.reduce((s, i) => s + i.valorMensal, 0),
    vence30: comFim.filter((i) => (i.diasAteFim ?? 0) <= 30),
    vence60: entre(30, 60),
    vence90: entre(60, 90),
  };
}

/** As fórmulas, escritas na tela (regra "um número, uma fonte" do prompt 29). */
export const FORMULAS_CARTEIRA = {
  ocupacao: "Ocupação = imóveis ocupados ÷ imóveis ativos. Reservado (aguardando assinatura ou 1º pagamento) não conta como ocupado.",
  receita: "Receita mensal em vigência = soma do valor mensal dos contratos ocupados. A taxa de serviço não entra: ela é cobrada à parte.",
  aComecar: "Contratada a começar = soma do valor mensal dos contratos reservados.",
  vencimentos: "Vencimentos = contratos ocupados ou reservados que terminam em até 30, 60 e 90 dias, pela data do último bloco.",
} as const;
