/**
 * Geometria do gráfico de barras com valores negativos (prompt 27, item 4) — pura e testável.
 * A escala vai do MENOR valor (ou zero) ao MAIOR (ou zero): a barra negativa desce da linha do zero com altura
 * proporcional e, se o valor não for zero, nunca menos que `minPx` (o −R$ 1.100 do Ano 1 não vira um ponto).
 */
export interface BarraGeo {
  valor: number;
  /** Distância do topo da área do gráfico até o topo da barra (px). */
  topo: number;
  altura: number;
  negativo: boolean;
}

export function geometriaBarras(valores: number[], alturaPx: number, minPx = 4): { zeroY: number; barras: BarraGeo[] } {
  const fin = valores.map((v) => (Number.isFinite(v) ? v : 0));
  const max = Math.max(0, ...fin);
  const min = Math.min(0, ...fin);
  const faixa = max - min || 1;
  const zeroY = (max / faixa) * alturaPx;
  const barras = fin.map((v) => {
    const proporcional = (Math.abs(v) / faixa) * alturaPx;
    const altura = v === 0 ? 0 : Math.max(minPx, proporcional);
    const negativo = v < 0;
    return { valor: v, altura, negativo, topo: negativo ? zeroY : zeroY - altura };
  });
  return { zeroY, barras };
}

/** "−R$ 1.100" (sinal de menos de verdade) / "R$ 46.300". */
export function rotuloValorBarra(v: number, formatar: (n: number) => string): string {
  return `${v < 0 ? "−" : ""}${formatar(Math.abs(v))}`;
}
