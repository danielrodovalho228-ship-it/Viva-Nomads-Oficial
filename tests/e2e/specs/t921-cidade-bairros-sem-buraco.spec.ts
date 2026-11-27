import { test, expect } from "@playwright/test";

/*
  T921 — Varredura 23 (06/11, 1280): em /cidades/[cidade], os bairros em 3 colunas deixavam o último sozinho na linha de
  baixo (13 bairros: 3·3·3·3·1) — buraco na última linha. Agora, no computador, o que sobra preenche a linha (1 sobrando:
  o último ocupa a linha; 2 sobrando: dividem). Tablet (2 colunas) e celular (1 coluna) como antes. 390, 768 e 1280.
*/
for (const w of [1280, 768, 390] as const) {
  test(`a ${w} px: os bairros da cidade não deixam buraco na última linha`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto("/cidades/uberlandia", { waitUntil: "networkidle" });
    const lista = page.getByTestId("bairros-lista");
    test.skip((await lista.count()) === 0, "a cidade não tem bairros neste ambiente");
    await expect(lista).toBeVisible({ timeout: 30_000 });
    const r = await lista.evaluate((g) => {
      const caixa = g.getBoundingClientRect();
      const kids = [...g.children];
      const tops = [...new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top)))];
      const ultima = kids.filter((k) => Math.round(k.getBoundingClientRect().top) === tops[tops.length - 1]);
      const larg = ultima.reduce((a, k) => a + k.getBoundingClientRect().width, 0);
      return { linhas: tops.length, naUltima: ultima.length, cobre: larg / caixa.width, lateral: document.documentElement.scrollWidth - innerWidth };
    });
    if (r.linhas > 1) expect(r.cobre, `última linha (${r.naUltima} cartão) cobre a grade`).toBeGreaterThan(0.9);
    expect(r.lateral, "rolagem lateral").toBeLessThanOrEqual(1);
    await lista.screenshot({ path: `tests/laboratorio/saida/t921-bairros-${w}.png` });
  });
}
