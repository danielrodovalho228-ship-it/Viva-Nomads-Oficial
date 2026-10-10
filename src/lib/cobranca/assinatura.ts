/*
  Fase 2 (assinatura sem comissão) — CONSTRUÍDA, mas DESLIGADA (assinatura_ativa=false) e fora da
  interface. A decisão final do Daniel (10/10, ordem eaa5adce) é a regra única de 12% em ./regra.ts;
  nada daqui é usado por tela. Mantido só para não perder o trabalho caso a assinatura volte.
*/

export interface FaixaAssinatura {
  minImoveis: number;
  maxImoveis: number | null;
  mensal: number; // R$/mês
}

// Fase 2 (flag assinatura_ativa=false). Valores também vão para a tabela de config.
export const FAIXAS_ASSINATURA_PADRAO: readonly FaixaAssinatura[] = [
  { minImoveis: 1, maxImoveis: 2, mensal: 149 },
  { minImoveis: 3, maxImoveis: 5, mensal: 299 },
  { minImoveis: 6, maxImoveis: 10, mensal: 499 },
  { minImoveis: 11, maxImoveis: 20, mensal: 799 },
  { minImoveis: 21, maxImoveis: null, mensal: 999 },
];

export const CARENCIA_ASSINATURA_DIAS_PADRAO = 90;

const DIA_MS = 86_400_000;

function indiceFaixa(faixas: readonly { minImoveis: number; maxImoveis: number | null }[], n: number): number {
  const q = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
  const i = faixas.findIndex((f) => q >= f.minImoveis && (f.maxImoveis === null || q <= f.maxImoveis));
  return i === -1 ? faixas.length - 1 : i;
}

export function mensalidadePorImoveis(n: number, faixas: readonly FaixaAssinatura[] = FAIXAS_ASSINATURA_PADRAO): number {
  return faixas[indiceFaixa(faixas, n)].mensal;
}

/** Comissão 0% só se a flag está ligada e a assinatura tem >= carência dias na data do contrato. */
export function assinaturaIsentaComissao(a: {
  flagAtiva: boolean;
  assinaturaDesde: Date | null;
  assinadoEm: Date;
  carenciaDias?: number;
}): boolean {
  if (!a.flagAtiva || !a.assinaturaDesde) return false;
  const carencia = a.carenciaDias ?? CARENCIA_ASSINATURA_DIAS_PADRAO;
  return a.assinadoEm.getTime() >= a.assinaturaDesde.getTime() + carencia * DIA_MS;
}
