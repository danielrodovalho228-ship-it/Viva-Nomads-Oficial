import { test, expect } from "@playwright/test";

/*
  T919 — Varredura 20 (05/11, 1280): em /proprietario/[id], "Imóveis de …" com 5 imóveis saía em 4 colunas, com o quinto
  sozinho na 2ª linha. Agora as colunas do computador seguem a quantidade (5 imóveis = uma linha de 5). Usa o perfil de
  exemplo "Helena M." (5 imóveis, não depende do banco). 390 (1 coluna) e 1280. Sem rolagem lateral.
*/
for (const w of [1280, 390] as const) {
  test(`a ${w} px: a grade de imóveis do proprietário não deixa buraco na última linha`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto("/proprietario/exemplo-1", { waitUntil: "networkidle" });
    const grade = page.locator('section[aria-labelledby="imoveis-proprietario"] > div').first();
    await expect(grade).toBeVisible({ timeout: 30_000 });
    const r = await grade.evaluate((g) => {
      const kids = [...g.children];
      const tops = [...new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top)))];
      return { n: kids.length, linhas: tops.map((t) => kids.filter((k) => Math.round(k.getBoundingClientRect().top) === t).length) };
    });
    expect(r.n).toBeGreaterThan(0);
    if (w === 1280) {
      // Linhas iguais entre si (a última também): sem cartão sozinho ao lado do vazio.
      expect(new Set(r.linhas).size, `linhas: ${r.linhas}`).toBe(1);
    } else {
      expect(r.linhas.every((n) => n === 1), `celular, 1 por linha: ${r.linhas}`).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `tests/laboratorio/saida/t919-proprietario-${w}.png` });
  });
}
