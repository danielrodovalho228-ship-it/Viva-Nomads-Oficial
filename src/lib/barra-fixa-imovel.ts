import { formatBRL } from "./utils.ts";

/**
 * Barra fixa do celular na página do imóvel (ordem aa421902, UX1): valor por mês
 * (o mesmo número do PriceCard) + botão principal. Lógica pura, testável.
 */
export interface BarraFixaImovel {
  visivel: boolean;
  estado: "candidatar" | "candidatou";
  valor: string;
  linha: string;
}

export function barraFixaImovel(p: {
  monthlyPrice: number;
  exemplo: boolean;
  candidatouSe: boolean;
}): BarraFixaImovel {
  const precoValido = Number.isFinite(p.monthlyPrice) && p.monthlyPrice > 0;
  return {
    visivel: !p.exemplo && precoValido,
    estado: p.candidatouSe ? "candidatou" : "candidatar",
    valor: precoValido ? formatBRL(p.monthlyPrice) : "",
    linha: "Caução e taxas no detalhe",
  };
}
