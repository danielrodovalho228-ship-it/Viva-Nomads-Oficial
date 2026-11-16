import { test, expect } from "@playwright/test";

/*
  T2080 — E935 e E934 (Pista 3; auditoria das travas da Família 4, ronda 04:55Z) @E935 @E934 @ao-vivo-seguro
  Regras decididas (Família 4; correção no draft #3883), no artigo "Como ser avaliador credenciado" da Ajuda (tema
  Para proprietários):
    - E935: a lista do que a Viva pede inclui "a declaração de relações", e o artigo diz a regra da porta: "Quem tem
      relação com o dono ou o imóvel fica de fora." — a MESMA frase de /parceiros/avaliadores;
    - E934: o artigo escreve o caminho /parceiros/avaliadores e ele é uma ligação real dentro do texto.
  Vermelha na main até a correção entrar. Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const REGRA = "Quem tem relação com o dono ou o imóvel fica de fora.";

test("T2080 — E935/E934: o artigo do avaliador pede a declaração de relações, diz a regra da porta e liga a página @E935 @E934 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/ajuda/proprietarios", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const botao = page.getByTestId("ajuda-perguntas").getByRole("button", { name: "Como ser avaliador credenciado" });
  await expect(botao).toBeVisible({ timeout: 30_000 });
  await expect(async () => {
    if ((await botao.getAttribute("aria-expanded")) !== "true") await botao.click();
    await expect(botao).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  const resposta = botao.locator("xpath=following-sibling::div[1]").locator("p").first();
  const t = (await resposta.innerText()).replace(/\s+/g, " ");
  expect(t, "E935: a declaração de relações na lista").toContain("a declaração de relações");
  expect(t, "E935: a regra da porta").toContain(REGRA);
  // E934: o caminho escrito vira ligação real, dentro do texto da resposta.
  const ligacao = resposta.locator('a[href="/parceiros/avaliadores"]');
  await expect(ligacao, "E934: /parceiros/avaliadores é ligação dentro do artigo").toHaveCount(1);
});

test("T2080 — E935: /parceiros/avaliadores diz a mesma regra das relações @E935 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/parceiros/avaliadores", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  expect((await page.locator("main").innerText()).replace(/\s+/g, " ")).toContain(REGRA);
});
