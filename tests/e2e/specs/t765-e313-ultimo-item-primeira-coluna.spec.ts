import { test, expect, type Locator } from "@playwright/test";

/*
  T765 — E313 (devolução de 31/10): com número ímpar de itens (dado real, nada inventado), o último item das grades de
  comodidades fica na PRIMEIRA coluna, alinhado à esquerda — nunca centrado solto. Na lista-resumo e na grade completa
  por categoria, a 390 e a 1280.
*/
const SAIDA = "tests/laboratorio/saida";

async function conferirGrades(grades: Locator) {
  const medidas = await grades.evaluateAll((uls) =>
    uls.map((u) => {
      const itens = [...u.children] as HTMLElement[];
      const ultimo = itens[itens.length - 1];
      const g = u.getBoundingClientRect();
      const r = ultimo.getBoundingClientRect();
      const icone = ultimo.querySelector("svg")?.getBoundingClientRect();
      return { n: itens.length, texto: ultimo.innerText.trim(), dx: Math.round(r.left - g.left), iconeDx: icone ? Math.round(icone.left - g.left) : 0, largura: Math.round(r.width), larguraGrade: Math.round(g.width) };
    }),
  );
  const impares = medidas.filter((m) => m.n % 2 === 1);
  expect(impares.length, "o ube-001 tem categorias com número ímpar de itens").toBeGreaterThan(0);
  for (const m of impares) {
    expect(m.dx, `"${m.texto}" começa na 1ª coluna`).toBe(0);
    expect(m.iconeDx, `"${m.texto}" com o ícone colado à esquerda (não centrado)`).toBeLessThanOrEqual(2);
    expect(m.largura, `"${m.texto}" não estica pela linha inteira`).toBeLessThan(m.larguraGrade * 0.75);
  }
}

for (const largura of [390, 1280] as const) {
  test(`T765 — E313: último item ímpar na 1ª coluna (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    const r = await page.goto("/imoveis/ube-001", { waitUntil: "domcontentloaded" });
    test.skip(!r || r.status() === 404, "Sem o anúncio de exemplo ube-001 neste ambiente.");
    const secao = page.getByTestId("comodidades");
    await expect(secao).toBeVisible({ timeout: 30_000 });
    await conferirGrades(secao.locator("ul.grid-cols-2"));
    await expect(async () => {
      await page.getByTestId("comodidades-ver-todas").first().click({ timeout: 3_000 });
      await expect(page.getByTestId("comodidades-lista-completa")).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 30_000 });
    await conferirGrades(page.getByTestId("comodidades-lista-completa").locator("ul.grid-cols-2"));
    await page.screenshot({ path: `${SAIDA}/t765-comodidades-${largura}.png` });
  });
}
