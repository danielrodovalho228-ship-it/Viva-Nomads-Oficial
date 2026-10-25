import { test, expect, type Page } from "@playwright/test";

/**
 * T436 — E82-A + E91 + E95 (mockup BUSCA-CARD): /buscar clean, contra o print do Daniel no celular.
 *  1. Acima da lista, SÓ a linha da contagem ("N imóveis em X") com "Salvar busca" e "Descrever o que procuro".
 *  2. UMA linha de controles: Datas · Local · Tipo · Preço · Nível · Mais filtros · Ordenar · Mapa.
 *  3. Local ÚNICO: o cartão "Onde você vai trabalhar ou estudar?" sai da página e mora no painel da pílula Local.
 *  4. "Descreva o lugar ideal" sai do topo e vira folha; nada de "Aplicar nos filtros" na página.
 *  5. A bolha "Fale com a Viva" não aparece na /buscar (não cobre conteúdo).
 *  6. Sem resultado: "Nenhum imóvel com estes filtros" e as saídas do vazio.
 *  Em 390 e 1280 px, com prints.
 */
const ORDEM = ["pilula-datas", "pilula-local", "pilula-tipo", "pilula-preco", "pilula-nivel", "pilula-mais", "pilula-ordenar", "pilula-mapa"];
const semRolagem = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [largura, altura] of [[390, 844], [1280, 800]] as const) {
  test.describe(`T436 — /buscar clean a ${largura}px`, () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(120_000); // /buscar com mapa no servidor frio do laboratório
      await page.setViewportSize({ width: largura, height: altura });
    });

    test("1–2. uma linha de controles na ordem do mockup e, acima da lista, só a linha da contagem", async ({ page }) => {
      await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
      const linha = page.getByTestId("linha-pilulas");
      await expect(linha).toBeVisible();
      const ids = await linha.locator(":scope > [data-testid]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
      expect(ids).toEqual(ORDEM);
      // Todas na mesma linha (no celular a linha rola de lado, sem quebrar).
      const ys = await linha.locator(":scope > [data-testid]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(new Set(ys).size, `tops ${ys}`).toBe(1);
      await expect(page.getByTestId("pilula-local")).toHaveAttribute("data-valor", "Uberlândia");

      const contagem = page.getByTestId("titulo-busca");
      await expect(contagem).toHaveText(/^\d+ imóve(l|is) em Uberlândia$/);
      expect(await contagem.evaluate((el) => el.tagName)).toBe("H1");
      expect(Number.parseFloat(await contagem.evaluate((el) => getComputedStyle(el).fontSize))).toBeLessThanOrEqual(16);
      await expect(page.getByTestId("salvar-busca").filter({ visible: true })).toHaveCount(1);
      await expect(page.getByTestId("abrir-descrever")).toHaveText("Descrever o que procuro");

      // Entre a linha de controles e o 1º cartão não há mais nada (banner, título grande, caixas).
      const fimControles = (await page.getByTestId("linha-contagem").boundingBox())!;
      const card = (await page.getByTestId("card-resultado").first().boundingBox())!;
      expect(card.y - (fimControles.y + fimControles.height), "lista logo abaixo da contagem").toBeLessThanOrEqual(40);
      for (const texto of ["Onde você vai trabalhar ou estudar?", "Descreva o lugar ideal", "Aplicar nos filtros"]) {
        await expect(page.getByText(texto, { exact: false }).filter({ visible: true }), texto).toHaveCount(0);
      }
      expect(await semRolagem(page)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t436-topo-${largura}.png` });
    });

    test("2. a pílula abre o painel logo abaixo da linha; a escolha vale na hora e a pílula mostra o valor", async ({ page }) => {
      await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
      await page.getByTestId("pilula-preco").click();
      const painel = page.getByTestId("painel-pilula-preco");
      await expect(painel).toBeVisible();
      const linhaBox = (await page.getByTestId("linha-pilulas").boundingBox())!;
      expect((await painel.boundingBox())!.y).toBeGreaterThanOrEqual(linhaBox.y + linhaBox.height);
      await page.screenshot({ path: `tests/laboratorio/saida/t436-painel-preco-${largura}.png` });
      const opcao = painel.locator('button[data-testid^="pilula-preco-"]:not([disabled])').last(); // E105: o "· N" da opção também tem testid
      const rotulo = (await opcao.innerText()).split("·")[0].trim();
      await opcao.click();
      await expect(page.getByTestId("pilula-preco")).toHaveAttribute("data-valor", rotulo);
      await page.keyboard.press("Escape");
      await expect(painel).toBeHidden();
      await expect(page).toHaveURL(/preco=/);
    });

    test("3. Local único: 'Perto de' mora no painel da pílula Local", async ({ page }) => {
      await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
      await expect(page.getByTestId("campo-destino")).toHaveCount(0);
      await page.getByTestId("pilula-local").click();
      const painel = page.getByTestId("painel-pilula-local");
      await expect(painel.getByTestId("campo-destino")).toBeVisible();
      await expect(page.getByTestId("campo-destino")).toHaveCount(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t436-painel-local-${largura}.png` });
    });

    test("4. 'Descrever o que procuro' abre a folha; 'Mais filtros' abre a folha com a descrição recolhida no topo", async ({ page }) => {
      await page.goto("/buscar?local=Uberl%C3%A2ndia", { waitUntil: "networkidle" });
      await page.getByTestId("abrir-descrever").click();
      const folha = page.getByTestId("folha-descrever");
      await expect(folha).toBeVisible();
      await page.screenshot({ path: `tests/laboratorio/saida/t436-folha-descrever-${largura}.png` });
      await page.keyboard.press("Escape");
      await expect(folha).toBeHidden();

      await page.getByTestId("pilula-mais").click();
      const filtros = page.getByRole("dialog", { name: "Filtros" });
      await expect(filtros).toBeVisible();
      await expect(filtros.getByTestId("folha-descreva")).toBeVisible();
      await page.screenshot({ path: `tests/laboratorio/saida/t436-folha-filtros-${largura}.png` });
      await filtros.getByTestId("folha-descreva").click();
      await expect(page.getByTestId("folha-descrever")).toBeVisible();
    });

    test("5. sem a bolha 'Fale com a Viva' por cima dos cartões; a ajuda fica como link no fim", async ({ page }) => {
      await page.goto("/buscar", { waitUntil: "networkidle" });
      await expect(page.getByTestId("card-resultado").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Fale com a Viva/ })).toHaveCount(0);
      await expect(page.getByTestId("buscar-ajuda")).toBeAttached();
    });

    test("6. sem resultado: 'Nenhum imóvel com estes filtros' e as saídas do vazio", async ({ page }) => {
      await page.goto("/buscar?local=Cidade%20Inexistente%20XYZ", { waitUntil: "networkidle" });
      await expect(page.getByTestId("titulo-busca")).toHaveText("Nenhum imóvel com estes filtros");
      await expect(page.getByTestId("complemento-busca")).toHaveCount(0);
      await expect(page.getByTestId("busca-vazia")).toBeVisible();
      await expect(page.getByTestId("busca-vazia-pedido")).toBeVisible();
      expect(await semRolagem(page)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `tests/laboratorio/saida/t436-vazio-${largura}.png` });
    });
  });
}
