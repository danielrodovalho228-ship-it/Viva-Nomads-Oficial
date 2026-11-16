import { test, expect } from "@playwright/test";

/*
  T2083 — E947 (Pista 3; autorizado pelo Gerente na ronda 04:55Z) @E947 @ao-vivo-seguro
  Regra decidida (Família 6; correção no draft #3860): a Central de Ajuda tem a pergunta própria "Minha empresa pode
  alugar moradia para funcionários?" (tema Para quem procura moradia), com as regras validadas fixadas:
    - estadias de 30 a 180 dias;
    - o recibo: o proprietário emite o recibo mensal da estadia em nome dele (a Viva não emite nota para a empresa);
    - quem vem morar paga R$ 0 à plataforma (não paga taxa; não há mensalidade).
  A ligação direta /ajuda/morador?pergunta=empresa-moradia abre a resposta. É a trava determinística por baixo da
  re-prova do Lótus. Vermelha na main até a correção entrar. Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const PERGUNTA = "Minha empresa pode alugar moradia para funcionários?";
const limpo = (s: string) => s.replace(/\s+/g, " ");

test("T2083 — E947: a Ajuda responde se a empresa pode alugar para funcionários, com 30–180 dias, recibo e morador R$ 0 @E947 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/ajuda/morador", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const lista = page.getByTestId("ajuda-perguntas");
  await expect(lista).toBeVisible({ timeout: 30_000 });
  const botao = lista.getByRole("button", { name: PERGUNTA });
  await expect(botao, "a pergunta própria de empresas está no tema Para quem procura moradia").toBeVisible();
  await expect(async () => {
    if ((await botao.getAttribute("aria-expanded")) !== "true") await botao.click();
    await expect(botao).toHaveAttribute("aria-expanded", "true", { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  const t = limpo(await botao.locator("xpath=following-sibling::div[1]").locator("p").first().innerText());
  expect(t, "30 a 180 dias").toMatch(/30 a 180 dias/);
  expect(t, "o recibo mensal é do proprietário").toContain("O proprietário emite o recibo mensal da estadia em nome dele.");
  expect(t, "a Viva não emite nota para a empresa").toContain("A Viva Nomads não emite nota para a empresa");
  expect(t, "quem vem morar não paga taxa à plataforma (R$ 0)").toContain("quem vem morar não paga taxa à plataforma");
  expect(t, "sem mensalidade").toContain("não há mensalidade");
});

test("T2083 — E947: a ligação direta ?pergunta=empresa-moradia abre a resposta @E947 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/ajuda/morador?pergunta=empresa-moradia", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const botao = page.getByTestId("ajuda-perguntas").getByRole("button", { name: PERGUNTA });
  await expect(botao).toHaveAttribute("aria-expanded", "true", { timeout: 30_000 });
  await expect(botao.locator("xpath=following-sibling::div[1]")).toContainText("30 a 180 dias");
});
