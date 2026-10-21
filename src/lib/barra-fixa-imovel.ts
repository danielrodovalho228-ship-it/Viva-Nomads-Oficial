import { formatBRL } from "./utils.ts";
import { statusDisponibilidade } from "./imovel-pagina.ts";
import { rotuloPrecoCartao } from "./cartao-preco.ts";

/**
 * Barra fixa do celular na página do imóvel (ordem aa421902, UX1; Prompt 41): valor por mês + total pela duração
 * escolhida ("R$ X/mês · R$ Y em N meses"; N = 1 → só "/mês", a mesma regra do cartão em cartao-preco.ts) e o
 * botão principal "Solicitar". Lógica pura, testável.
 */
export interface BarraFixaImovel {
  visivel: boolean;
  estado: "candidatar" | "candidatou";
  /** Anúncio de exemplo: as ações abrem o fluxo em demonstração, sem gravar nada. */
  demonstracao: boolean;
  /** "R$ X" (o total do mês, o mesmo número do cartão de preço). */
  valor: string;
  /** "R$ X/mês". */
  mes: string;
  /** "R$ Y em N meses" ou null quando N = 1. */
  estadia: string | null;
  linha: string;
  /** "Disponível agora" / "Disponível a partir de dd/mm" (ordem d943f893). */
  status: string;
}

export function barraFixaImovel(p: {
  monthlyPrice: number;
  /** Custo total do mês (calcularTotalMensal); sem ele, o valor mensal. */
  totalMensal?: number;
  /** Meses da estadia (mesesDoCartao: a duração da busca ou a estadia mínima); padrão 1. */
  meses?: number;
  exemplo: boolean;
  candidatouSe: boolean;
  availableFrom?: string;
  /** AAAA-MM-DD; padrão = hoje. */
  hoje?: string;
}): BarraFixaImovel {
  const precoValido = Number.isFinite(p.monthlyPrice) && p.monthlyPrice > 0;
  const total = p.totalMensal && p.totalMensal > 0 ? p.totalMensal : p.monthlyPrice;
  const preco = precoValido ? rotuloPrecoCartao(total, p.meses ?? 1) : null;
  return {
    // Exemplo também mostra a barra (estado de demonstração, nada é enviado).
    visivel: precoValido,
    demonstracao: p.exemplo,
    estado: p.candidatouSe ? "candidatou" : "candidatar",
    valor: precoValido ? formatBRL(total) : "",
    mes: preco?.mes ?? "",
    estadia: preco?.estadia ?? null,
    linha: "Caução e taxas no detalhe",
    status: statusDisponibilidade(p.availableFrom, p.hoje ?? new Date().toISOString().slice(0, 10)),
  };
}
