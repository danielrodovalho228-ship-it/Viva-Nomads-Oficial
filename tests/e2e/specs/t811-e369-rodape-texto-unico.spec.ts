import { test, expect } from "@playwright/test";

/*
  T811 — E369 (02/11, Pista A): no rodapé (inclusive na edição do pedido, /pedidos/novo), "Imóveis em Uberlândia" e
  "© 2026 Viva Nomads" são UM texto só (leitores de texto liam "emUberlândia" e "©2026Viva"). 390 e 1280.
*/
for (const largura of [390, 1280] as const) {
  test(`T811 — rodapé com frases inteiras (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/pedidos/novo", { waitUntil: "domcontentloaded" });
    const rodape = page.locator("footer").last();
    await expect(rodape).toBeAttached({ timeout: 30_000 });
    const nos = await rodape.evaluate((f) => {
      const textos: string[] = [];
      const w = document.createTreeWalker(f, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) textos.push(w.currentNode.nodeValue ?? "");
      return textos;
    });
    expect(nos.some((t) => /^Imóveis em \S/.test(t))).toBe(true);
    expect(nos.some((t) => /^© \d{4} Viva Nomads · /.test(t))).toBe(true);
    const tudo = nos.join("");
    expect(tudo).not.toMatch(/emUberlândia|©\d{4}Viva|Vivaem/);
    await rodape.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `tests/laboratorio/saida/t811-rodape-${largura}.png` });
  });
}
