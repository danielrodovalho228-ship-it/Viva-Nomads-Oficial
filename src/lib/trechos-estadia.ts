/**
 * Resíduo "Estadia mínima" (cartão de Meus anúncios, 02/11): a linha "Estadia mínima (3 meses): R$ 12.580 · 3 × R$ 3.960
 * + limpeza de preparação R$ 450 + limpeza de saída R$ 250" quebrava no meio dos termos no celular — "R$ 250" ficava
 * sozinho na linha de baixo, longe de "limpeza de saída". Os trechos (separados por " · " e " + ") viram blocos que não
 * quebram por dentro; o texto lido é o mesmo. PURO.
 */
export type TrechoEstadia = { texto: string; separador: "" | " · " | " + " };

export function trechosDaEstadia(linha: string): TrechoEstadia[] {
  const out: TrechoEstadia[] = [];
  const partes = linha.split(/( · | \+ )/);
  for (let i = 0; i < partes.length; i += 2) {
    const texto = partes[i];
    if (!texto) continue;
    out.push({ texto, separador: i === 0 ? "" : (partes[i - 1] as " · " | " + ") });
  }
  return out;
}
