import { test, expect } from "@playwright/test";

/**
 * T165 — ordem 8dca1437 (Próximo do FF 3/6, itens 1 e 4): em /pedidos/novo o contador
 * "N imóveis combinam" aparece enquanto a pessoa preenche (sem publicar e sem login),
 * com dica quando der 0; 390 e 1280 px sem rolagem lateral.
 */
for (const largura of [390, 1280]) {
  test(`${largura} px: contador ao vivo aparece ao preencher cidade, data e orçamento`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/pedidos/novo?cidade=Uberl%C3%A2ndia&uf=MG&inicio=2027-03-01&meses=3&orcamento=2500", {
      waitUntil: "domcontentloaded",
    });
    const contador = page.getByTestId("pedido-contador");
    await expect(contador).toHaveAttribute("data-combinam", /\d+/, { timeout: 15_000 });
    await expect(contador).toContainText(/combinam? com seu pedido agora|Nenhum imóvel ainda/);

    // Orçamento baixíssimo: nenhum imóvel combina e a tela diz o que afrouxar (ou que mexer em mais de um campo ajuda).
    await page.getByTestId("pedido-orcamento").fill("300");
    await expect(contador).toContainText("Nenhum imóvel ainda — seu pedido avisa quando entrar um", { timeout: 15_000 });

    const semRolagemLateral = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(semRolagemLateral).toBe(true);
  });
}

// Ordem 8dca1437, item 3, com o Prompt 30: o formulário avisa, antes de publicar, quando o pedido chega aos proprietários.
// Com a chave SMS_ATIVO desligada (padrão), basta o e-mail confirmado — e nenhum texto pede telefone (regra no banco, 0184).
for (const largura of [390, 1280]) {
  test(`${largura} px: o formulário avisa que o pedido chega aos proprietários com o e-mail confirmado (chave SMS desligada)`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto("/pedidos/novo", { waitUntil: "domcontentloaded" });
    const aviso = page.getByTestId("pedido-aviso-confirmacao");
    await expect(aviso).toBeVisible({ timeout: 15_000 });
    await expect(aviso).toContainText("com o seu e-mail confirmado");
    await expect(aviso).not.toContainText(/telefone/i);
    await expect(aviso).toContainText("contato continua escondido até você aceitar");
    const semRolagemLateral = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(semRolagemLateral).toBe(true);
  });
}
