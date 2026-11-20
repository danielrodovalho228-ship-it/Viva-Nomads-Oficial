import type { Locator } from "@playwright/test";

/*
  E1033 (passo 1) — o helper ÚNICO da área de toque REAL. Em vez de ler a altura do ::after (enganosa: a E960 mostrou um
  ::after "de 44 px" que não cobria o controlo), confere o que o dedo acerta: pontos nas bordas da caixa 44×44 em volta do
  centro do controlo, cada um com document.elementFromPoint. O ponto conta quando acerta o próprio controlo ou algo dentro
  dele (o ::after de um elemento devolve o próprio elemento no elementFromPoint).
*/
export const LADO_TOQUE = 44;

export interface PontoCaixa {
  x: number;
  y: number;
  onde: string;
}

/** O centro, os 4 cantos e os 4 meios das bordas da caixa lado×lado em volta de (cx, cy), 1 px para dentro. Puro. */
export function pontosDaCaixa(cx: number, cy: number, lado = LADO_TOQUE): PontoCaixa[] {
  const m = lado / 2 - 1;
  return [
    { x: cx, y: cy, onde: "centro" },
    { x: cx - m, y: cy - m, onde: "canto sup-esq" },
    { x: cx + m, y: cy - m, onde: "canto sup-dir" },
    { x: cx - m, y: cy + m, onde: "canto inf-esq" },
    { x: cx + m, y: cy + m, onde: "canto inf-dir" },
    { x: cx, y: cy - m, onde: "borda sup" },
    { x: cx, y: cy + m, onde: "borda inf" },
    { x: cx - m, y: cy, onde: "borda esq" },
    { x: cx + m, y: cy, onde: "borda dir" },
  ];
}

export interface AreaDeToque {
  /** Todos os pontos da caixa acertam o controlo. */
  ok: boolean;
  /** Os pontos que NÃO acertam o controlo, com o que está lá (para a mensagem do expect). */
  faltam: string[];
  /** O retângulo do próprio controlo (sem o ::after). */
  caixa: { largura: number; altura: number };
}

/**
 * A área de toque real do controlo: rola-o para a vista e confere os 9 pontos da caixa lado×lado em volta do centro.
 * Uso: `expect((await areaDeToque(loc)).faltam, "rótulo").toEqual([])`.
 */
export async function areaDeToque(alvo: Locator, lado = LADO_TOQUE): Promise<AreaDeToque> {
  await alvo.scrollIntoViewIfNeeded();
  const r = await alvo.evaluate((el, l) => {
    const b = el.getBoundingClientRect();
    const cx = b.left + b.width / 2;
    const cy = b.top + b.height / 2;
    const m = l / 2 - 1;
    const pontos = [
      [cx, cy, "centro"], [cx - m, cy - m, "canto sup-esq"], [cx + m, cy - m, "canto sup-dir"], [cx - m, cy + m, "canto inf-esq"],
      [cx + m, cy + m, "canto inf-dir"], [cx, cy - m, "borda sup"], [cx, cy + m, "borda inf"], [cx - m, cy, "borda esq"], [cx + m, cy, "borda dir"],
    ] as const;
    const faltam: string[] = [];
    for (const [x, y, onde] of pontos) {
      const no = document.elementFromPoint(x, y);
      if (no && (no === el || el.contains(no))) continue;
      const quem = no ? `${no.tagName.toLowerCase()}${no.getAttribute("data-testid") ? `[data-testid=${no.getAttribute("data-testid")}]` : ""}` : "fora da tela";
      faltam.push(`${onde} (${Math.round(x)},${Math.round(y)}) → ${quem}`);
    }
    return { faltam, largura: b.width, altura: b.height };
  }, lado);
  return { ok: r.faltam.length === 0, faltam: r.faltam, caixa: { largura: r.largura, altura: r.altura } };
}
