import { test, expect } from "@playwright/test";

/*
  T807 — conformidade visual (02/11, Pista A): na página pública do proprietário de exemplo, as avaliações em 2 colunas
  (computador) seguem a grade par — com número ímpar, a última ocupa a linha inteira; sem buraco. No celular, 1 coluna.
  390 e 1280.
*/
const SAIDA = "tests/laboratorio/saida";

for (const largura of [390, 1280] as const) {
  test(`T807 — avaliações do proprietário em grade par (${largura} px)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/proprietario/exemplo-1", { waitUntil: "domcontentloaded" });
    const lista = page.getByTestId("avaliacoes-exemplo");
    await expect(lista).toBeVisible({ timeout: 30_000 });
    const r = await lista.evaluate((ul) => {
      const itens = [...ul.children] as HTMLElement[];
      const cols = getComputedStyle(ul).gridTemplateColumns.split(" ").filter(Boolean).length;
      const ultimo = itens[itens.length - 1].getBoundingClientRect();
      return { cols, n: itens.length, largUltimo: ultimo.width, largLista: ul.getBoundingClientRect().width };
    });
    if (r.cols > 1 && r.n % 2 === 1) expect(Math.round(r.largUltimo)).toBe(Math.round(r.largLista));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await lista.locator("li").last().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t807-avaliacoes-${largura}.png` });
  });
}
