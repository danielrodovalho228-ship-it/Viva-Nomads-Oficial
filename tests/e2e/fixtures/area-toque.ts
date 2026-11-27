import type { Locator } from "@playwright/test";

/*
  E1033 (passo 1) — o helper ÚNICO da área de toque REAL. Em vez de ler a altura do ::after (enganosa: a E960 mostrou um
  ::after "de 44 px" que não cobria o controlo), confere o que o dedo acerta: pontos nas bordas da caixa 44×44 em volta do
  centro do controlo, cada um com document.elementFromPoint. O ponto conta quando acerta o próprio controlo ou algo dentro
  dele (o ::after de um elemento devolve o próprio elemento no elementFromPoint).
  O VEREDITO usa o centro e os 4 meios das bordas ("pontos nas bordas da caixa"). Os 4 cantos só INFORMAM: o hit-test do
  Chrome respeita o border-radius, e uma pílula de 44×44 perde os cantos sem ser um alvo pequeno (1.º ensaio, 44649424765).
*/
export const LADO_TOQUE = 44;

export interface PontoCaixa {
  x: number;
  y: number;
  onde: string;
  /** Conta para o veredito (centro e meios das bordas); os cantos só informam. */
  conta: boolean;
}

/** O centro, os 4 cantos e os 4 meios das bordas da caixa lado×lado em volta de (cx, cy), 1 px para dentro. Puro. */
export function pontosDaCaixa(cx: number, cy: number, lado = LADO_TOQUE): PontoCaixa[] {
  const m = lado / 2 - 1;
  return [
    { x: cx, y: cy, onde: "centro", conta: true },
    { x: cx - m, y: cy - m, onde: "canto sup-esq", conta: false },
    { x: cx + m, y: cy - m, onde: "canto sup-dir", conta: false },
    { x: cx - m, y: cy + m, onde: "canto inf-esq", conta: false },
    { x: cx + m, y: cy + m, onde: "canto inf-dir", conta: false },
    { x: cx, y: cy - m, onde: "borda sup", conta: true },
    { x: cx, y: cy + m, onde: "borda inf", conta: true },
    { x: cx - m, y: cy, onde: "borda esq", conta: true },
    { x: cx + m, y: cy, onde: "borda dir", conta: true },
  ];
}

export interface AreaDeToque {
  /** Todos os pontos da caixa acertam o controlo. */
  ok: boolean;
  /** Os pontos do VEREDITO (centro e bordas) que NÃO acertam o controlo, com o que está lá (para a mensagem do expect). */
  faltam: string[];
  /** Os cantos que não acertam o controlo (só informação: border-radius). */
  cantos: string[];
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
    const cantos: string[] = [];
    for (const [x, y, onde] of pontos) {
      const no = document.elementFromPoint(x, y);
      if (no && (no === el || el.contains(no))) continue;
      const quem = no ? `${no.tagName.toLowerCase()}${no.getAttribute("data-testid") ? `[data-testid=${no.getAttribute("data-testid")}]` : ""}` : "fora da tela";
      (onde.startsWith("canto") ? cantos : faltam).push(`${onde} (${Math.round(x)},${Math.round(y)}) → ${quem}`);
    }
    return { faltam, cantos, largura: b.width, altura: b.height };
  }, lado);
  return { ok: r.faltam.length === 0, faltam: r.faltam, cantos: r.cantos, caixa: { largura: r.largura, altura: r.altura } };
}
