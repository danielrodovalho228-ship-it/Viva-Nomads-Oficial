import { formatBRL } from "./utils.ts";
import { statusDisponibilidade } from "./imovel-pagina.ts";

/**
 * Barra fixa do celular na página do imóvel (ordem aa421902, UX1): valor por mês
 * (o mesmo número do PriceCard) + botão principal. Lógica pura, testável.
 */
export interface BarraFixaImovel {
  visivel: boolean;
  estado: "candidatar" | "candidatou";
  valor: string;
  linha: string;
  /** "Disponível agora" / "Disponível a partir de dd/mm" (ordem d943f893). */
  status: string;
}

export function barraFixaImovel(p: {
  monthlyPrice: number;
  exemplo: boolean;
  candidatouSe: boolean;
  availableFrom?: string;
  /** AAAA-MM-DD; padrão = hoje. */
  hoje?: string;
}): BarraFixaImovel {
  const precoValido = Number.isFinite(p.monthlyPrice) && p.monthlyPrice > 0;
  return {
    visivel: !p.exemplo && precoValido,
    estado: p.candidatouSe ? "candidatou" : "candidatar",
    valor: precoValido ? formatBRL(p.monthlyPrice) : "",
    linha: "Caução e taxas no detalhe",
    status: statusDisponibilidade(p.availableFrom, p.hoje ?? new Date().toISOString().slice(0, 10)),
  };
}
