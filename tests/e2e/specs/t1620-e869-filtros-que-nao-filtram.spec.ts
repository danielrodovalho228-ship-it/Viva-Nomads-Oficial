import { test, expect } from "@playwright/test";

/*
  T1620 — E869 (Phoenix RELATORIO-020, A-92/A-97). (1) Link com parâmetros que a busca não reconhece (?pets=1, ?trabalho=1,
  ?garagem=1, ?comod=maquina): eles saem da URL e um aviso diz o que foi ignorado (antes ficavam na URL sem filtrar). (2) No
  painel "Mais filtros" sem nada marcado, nenhum dos interruptores Gestor/Negociação/Preço justo/Nota fiscal aparece com
  "· 0" (o que nenhum anúncio tem não é desenhado). Página pública, 1280 e 390.
*/
for (const [largura, altura] of [[1280, 900], [390, 844]] as const) {
  test(`a ${largura} px: link com filtro desconhecido avisa e limpa a URL; painel sem interruptor impossível`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto("/buscar?pets=1&trabalho=1&garagem=1&comod=maquina", { waitUntil: "networkidle" });
    const aviso = page.getByTestId("busca-aviso-link");
    await expect(aviso, "aviso do link").toBeVisible({ timeout: 30_000 });
    for (const k of ["pets", "trabalho", "garagem", "comod=maquina"]) await expect(aviso).toContainText(`“${k}”`);
    await expect.poll(() => new URL(page.url()).search, { message: "a URL não guarda o que não filtra" }).not.toMatch(/pets=|trabalho=|garagem=|comod=/);

    await page.goto("/buscar", { waitUntil: "networkidle" });
    await expect(page.getByTestId("busca-aviso-link")).toHaveCount(0);
    await page.getByTestId("pilula-mais").click();
    const painel = page.getByRole("dialog", { name: "Filtros" });
    await expect(painel).toBeVisible();
    const impossiveis: string[] = [];
    for (const id of ["faceta-gestor", "faceta-negocia", "faceta-selo-preco-justo", "faceta-nota"]) {
      const chip = painel.getByTestId(id);
      if ((await chip.count()) && (await chip.getAttribute("data-n")) === "0") impossiveis.push(id);
    }
    expect(impossiveis, `interruptores com "· 0" sem nada marcado: ${impossiveis.join(", ")}`).toEqual([]);
  });
}
