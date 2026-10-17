import { test, expect, type Page } from "@playwright/test";

/*
  T188 — /pedidos/novo no layout do prompt 12, a 390 e 1280 px, sem login.
  1280: imagem à esquerda (~45%) e formulário à direita começando até 120 px abaixo do header, sem cartão
        centralizado (sem sombra nem borda em volta do formulário); campos todos com 48 px.
  390:  faixa de 200 px com o título; sem rolagem lateral; cidade com autocomplete grava cidade + UF; contador de
        pessoas −/+; R$ com máscara de milhar; contador "0/500" da apresentação; publicar sem login leva ao login
        por código voltando para o pedido; texto legal no rodapé com "Como a Viva funciona".
*/
const SAIDA = "tests/laboratorio/saida";

test.use({ storageState: { cookies: [], origins: [] } });

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

async function alturasDosCampos(page: Page): Promise<number[]> {
  return page
    .locator("form input:not([type=hidden]), form select, form button[aria-pressed], form [data-testid=pedido-pessoas]")
    .evaluateAll((els) => els.filter((e) => (e as HTMLElement).offsetParent !== null).map((e) => Math.round(e.getBoundingClientRect().height)));
}

test("1280px — imagem à esquerda, formulário no topo à direita, sem cartão centralizado", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
  const titulo = page.getByRole("heading", { name: "Publique seu pedido" });
  await expect(titulo).toBeVisible();
  await expect(page.getByText("Os proprietários da cidade veem seu pedido e respondem pela plataforma.")).toBeVisible();

  const header = (await page.locator("header:visible").first().boundingBox())!;
  const t = (await titulo.boundingBox())!;
  expect(t.y - (header.y + header.height), "formulário longe do header").toBeLessThanOrEqual(120);

  const lateral = (await page.getByTestId("pedido-lateral").boundingBox())!;
  expect(lateral.x).toBeLessThanOrEqual(1);
  expect(lateral.width / 1280).toBeGreaterThan(0.42);
  expect(lateral.width / 1280).toBeLessThan(0.48);
  expect(t.x).toBeGreaterThan(lateral.x + lateral.width);
  await expect(page.getByTestId("pedido-passos").getByRole("listitem")).toHaveCount(3);

  // Sem cartão flutuante: nada de sombra/borda em volta do formulário.
  const caixa = await page.getByTestId("pedido-formulario").evaluate((el) => {
    const s = getComputedStyle(el);
    return { sombra: s.boxShadow, borda: s.borderTopWidth };
  });
  expect(caixa.sombra).toBe("none");
  expect(caixa.borda).toBe("0px");

  // Os três grupos, nessa ordem.
  const grupos = await page.locator("form legend").allInnerTexts();
  expect(grupos.map((g) => g.trim().toUpperCase())).toEqual(["ONDE E QUANDO", "QUEM VAI MORAR", "ORÇAMENTO E MOTIVO"]);

  const alturas = await alturasDosCampos(page);
  expect(alturas.length).toBeGreaterThanOrEqual(7);
  expect(new Set(alturas), `alturas ${alturas.join(",")}`).toEqual(new Set([48]));
  const botao = (await page.getByRole("button", { name: "Publicar pedido" }).boundingBox())!;
  expect(Math.round(botao.height)).toBe(52);
  await semRolagemLateral(page);
  await page.screenshot({ path: `${SAIDA}/t188-pedido-novo-1280.png`, fullPage: false });
});

test("1920px — print da tela larga: imagem 45% e formulário no topo, sem vão", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
  const header = (await page.locator("header:visible").first().boundingBox())!;
  const t = (await page.getByRole("heading", { name: "Publique seu pedido" }).boundingBox())!;
  expect(t.y - (header.y + header.height)).toBeLessThanOrEqual(120);
  const lateral = (await page.getByTestId("pedido-lateral").boundingBox())!;
  expect(lateral.width / 1920).toBeGreaterThan(0.42);
  expect(lateral.width / 1920).toBeLessThan(0.48);
  await semRolagemLateral(page);
  await page.screenshot({ path: `${SAIDA}/t188-pedido-novo-1920.png`, fullPage: false });
});

test("390px — faixa de 200 px, autocomplete de cidade, pessoas, R$, contador e login por código", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
  const lateral = (await page.getByTestId("pedido-lateral").boundingBox())!;
  expect(Math.round(lateral.height)).toBe(200);
  await expect(page.getByTestId("pedido-lateral").getByRole("heading", { name: "Deixe os imóveis virem até você" })).toBeVisible();
  await semRolagemLateral(page);
  await page.screenshot({ path: `${SAIDA}/t188-pedido-novo-390.png`, fullPage: true });

  // Cidade: digitar sem acento, escolher na lista → grava "Cidade – UF".
  const cidade = page.getByTestId("pedido-cidade");
  await cidade.fill("uberl");
  const lista = page.getByRole("listbox", { name: "Cidades" });
  await expect(lista.getByRole("option").first()).toHaveText(/Uberlândia\s*– MG/);
  await page.screenshot({ path: `${SAIDA}/t188-cidade-autocomplete-390.png`, fullPage: false });
  await lista.getByRole("option", { name: "Uberlândia – MG" }).click();
  await expect(cidade).toHaveValue("Uberlândia – MG");
  await expect(cidade).toHaveAttribute("data-cidade-escolhida", "1");
  await expect(lista).toHaveCount(0);

  // Pessoas: −/+ (mínimo 1).
  const pessoas = page.getByRole("spinbutton", { name: "Quantas pessoas vão morar" });
  await expect(pessoas).toHaveValue("1");
  await expect(page.getByRole("button", { name: "Menos uma pessoa" })).toBeDisabled();
  await page.getByRole("button", { name: "Mais uma pessoa" }).click();
  await page.getByRole("button", { name: "Mais uma pessoa" }).click();
  await expect(pessoas).toHaveValue("3");
  await page.getByRole("button", { name: "Menos uma pessoa" }).click();
  await expect(pessoas).toHaveValue("2");
  await page.getByTestId("pedido-pet").click();
  await expect(page.getByTestId("pedido-pet")).toHaveAttribute("aria-pressed", "true");

  // R$ com máscara de milhar.
  const orcamento = page.getByTestId("pedido-orcamento");
  await orcamento.fill("3500");
  await expect(orcamento).toHaveValue("3.500");
  await expect(page.getByText("Valor mensal total que cabe no seu bolso.")).toBeVisible();

  // Motivo: select nativo começando em "Selecione".
  await expect(page.getByTestId("pedido-motivo").locator("option").first()).toHaveText("Selecione");

  // Apresentação com contador.
  await expect(page.getByTestId("pedido-apresentacao-contador")).toHaveText("0/500");
  await page.getByPlaceholder(/Conte um pouco do seu perfil/i).fill("Analista em projeto de seis meses.");
  await expect(page.getByTestId("pedido-apresentacao-contador")).toHaveText("34/500");

  await expect(page.getByTestId("campo-data-exemplo")).toHaveText("dd/mm/aaaa");
  await page.getByTestId("pedido-data").fill("2027-03-01");
  await expect(page.getByTestId("pedido-data")).toHaveValue("2027-03-01");
  const alturas = await alturasDosCampos(page);
  expect(new Set(alturas), `alturas ${alturas.join(",")}`).toEqual(new Set([48]));

  // Rodapé: aviso numa linha só sob o botão + texto legal com "Como a Viva funciona".
  const aviso = page.getByTestId("aviso-antigolpe");
  await expect(aviso).toContainText("Ao publicar, você entra com um código enviado por e-mail.");
  await expect(aviso).toContainText("A Viva nunca pede PIX ou pagamento fora do contrato — Dicas de segurança.");
  await expect(aviso.getByRole("link", { name: "Dicas de segurança" })).toHaveAttribute("href", "/seguranca");
  const legal = page.getByTestId("pedido-rodape-legal");
  await expect(legal).toContainText("A Viva Nomads conecta e documenta; não é locadora, fiadora nem intermediária de pagamento.");
  await expect(legal.getByRole("link", { name: "Como a Viva funciona" })).toHaveAttribute("href", "/como-funciona");
  await semRolagemLateral(page);
  await page.getByRole("button", { name: "Publicar pedido" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SAIDA}/t188-rodape-390.png`, fullPage: false });

  // Publicar sem login → login por código, voltando para o pedido com o que foi preenchido.
  await page.getByRole("button", { name: "Publicar pedido" }).click();
  await page.waitForURL(/\/auth\?codigo=1&redirect=/, { timeout: 15_000 });
  const destino = new URL(page.url()).searchParams.get("redirect")!;
  expect(destino).toMatch(/^\/pedidos\/novo\?/);
  const volta = new URLSearchParams(destino.split("?")[1]);
  expect(volta.get("cidade")).toBe("Uberlândia");
  expect(volta.get("uf")).toBe("MG");
  expect(volta.get("orcamento")).toBe("3500");
  expect(volta.get("adultos")).toBe("2");
  await expect(page.getByTestId("login-por-codigo")).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: `${SAIDA}/t188-login-codigo-390.png`, fullPage: false });

  // Voltando pelo link do redirect, cidade e valor vêm preenchidos.
  await page.goto(destino, { waitUntil: "networkidle" });
  await expect(page.getByTestId("pedido-cidade")).toHaveValue("Uberlândia – MG");
  await expect(page.getByTestId("pedido-orcamento")).toHaveValue("3.500");
});

test("390px — cidade digitada sem escolher na lista não publica", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pedidos/novo", { waitUntil: "networkidle" });
  await page.getByTestId("pedido-cidade").fill("Bom Jesus");
  await page.getByTestId("pedido-cidade").blur();
  await page.getByRole("button", { name: "Publicar pedido" }).click();
  await expect(page.getByTestId("pedido-erro")).toHaveText(/Escolha a cidade na lista de sugestões/);
  await expect(page).toHaveURL(/\/pedidos\/novo/);
});
