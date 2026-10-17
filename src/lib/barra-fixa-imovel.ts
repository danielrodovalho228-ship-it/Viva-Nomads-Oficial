import { formatBRL } from "./utils.ts";
import { statusDisponibilidade } from "./imovel-pagina.ts";

/**
 * Barra fixa do celular na página do imóvel (ordem aa421902, UX1): valor por mês
 * (o mesmo número do PriceCard) + botão principal. Lógica pura, testável.
 */
export interface BarraFixaImovel {
  visivel: boolean;
  estado: "candidatar" | "candidatou";
  /** Anúncio de exemplo: as ações abrem o fluxo em demonstração, sem gravar nada. */
  demonstracao: boolean;
  valor: string;
  linha: string;
  /** "Disponível agora" / "Disponível a partir de dd/mm" (ordem d943f893). */
  status: string;
}

export function barraFixaImovel(p: {
  monthlyPrice: number;
  /** Custo total do mês (calcularTotalMensal); sem ele, o valor mensal. */
  totalMensal?: number;
  exemplo: boolean;
  candidatouSe: boolean;
  availableFrom?: string;
  /** AAAA-MM-DD; padrão = hoje. */
  hoje?: string;
}): BarraFixaImovel {
  const precoValido = Number.isFinite(p.monthlyPrice) && p.monthlyPrice > 0;
  return {
    // Exemplo também mostra a barra (estado de demonstração, nada é enviado).
    visivel: precoValido,
    demonstracao: p.exemplo,
    estado: p.candidatouSe ? "candidatou" : "candidatar",
    valor: precoValido ? formatBRL(p.totalMensal && p.totalMensal > 0 ? p.totalMensal : p.monthlyPrice) : "",
    linha: "Caução e taxas no detalhe",
    status: statusDisponibilidade(p.availableFrom, p.hoje ?? new Date().toISOString().slice(0, 10)),
  };
}
