import { test, expect } from "@playwright/test";

/*
  T765 — L-51 (#1675, Pista B): o "Aplicar nos filtros" da busca por descrição não trava em silêncio. Com menos de 3
  letras o botão continua clicável e o clique diz o que falta ("Escreva ao menos 3 letras para aplicar nos filtros."),
  com o campo marcado (aria-invalid) e ligado ao aviso (aria-describedby); ao chegar a 3 letras o aviso some. Pista C,
  bloco 99. Pela tela de verdade, a 390 e a 1280 px, como visitante.
*/
const DICA = "Escreva ao menos 3 letras para aplicar nos filtros.";

for (const largura of [1280, 390] as const) {
  test(`T765 — L-51 a ${largura} px: "Aplicar nos filtros" com menos de 3 letras responde com o motivo`, async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
    const page = await ctx.newPage();
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const campo = page.locator("#descricao-busca-campo");
    const aplicar = page.getByTestId("descricao-aplicar");
    await expect(campo).toBeVisible({ timeout: 20_000 });
    // Vazio: o botão não está desabilitado e o clique explica.
    await expect(aplicar).toBeEnabled();
    await aplicar.click();
    await expect(page.getByTestId("descricao-curta")).toHaveText(DICA);
    // Duas letras: segue explicando, com o campo marcado e ligado ao aviso.
    await campo.fill("ab");
    await expect(aplicar).toBeEnabled();
    await aplicar.click();
    await expect(page.getByTestId("descricao-curta")).toHaveText(DICA);
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    await expect(campo).toHaveAttribute("aria-describedby", "descricao-busca-curta");
    // Três letras: o aviso some e o campo deixa de estar marcado.
    await campo.fill("abc");
    await expect(page.getByTestId("descricao-curta")).toHaveCount(0);
    await expect(campo).not.toHaveAttribute("aria-invalid", "true");
    await ctx.close();
  });
}
