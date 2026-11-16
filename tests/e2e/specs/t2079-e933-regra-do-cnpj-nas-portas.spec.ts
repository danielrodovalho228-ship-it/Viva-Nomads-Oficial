import { test, expect } from "@playwright/test";

/*
  T2079 — E933 (Pista 3; auditoria das travas da Família 4, ronda 04:55Z) @E933 @ao-vivo-seguro
  Regra decidida (Família 4; correção no draft #3883): as 6 portas de busca de parceiros e /parceiros/fotografos
  declaram a regra do CNPJ — "A Viva só trabalha com parceiros que têm CNPJ, em qualquer categoria. O CPF não é
  aceito." — e o "Seja parceiro da Viva" da porta já leva o formulário com a categoria marcada
  (/parceiros?categoria=<c>#quero-ser-parceiro). O #3883 traz o teste de fonte; esta é a trava de visitante.
  Vermelha na main até a correção entrar. Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const REGRA = "A Viva só trabalha com parceiros que têm CNPJ, em qualquer categoria. O CPF não é aceito.";
const PORTAS = ["mudanca", "limpeza", "lavanderia", "montagem", "manutencao", "outro"];
const texto = async (page: import("@playwright/test").Page) => (await page.locator("main").innerText()).replace(/\s+/g, " ");

for (const categoria of PORTAS) {
  test(`T2079 — E933: a porta de busca ${categoria} declara a regra do CNPJ e o Seja parceiro marca a categoria @E933 @ao-vivo-seguro`, async ({ page }) => {
    const r = await page.goto(`/parceiros/buscar?categoria=${categoria}`, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
    expect(await texto(page), `a porta ${categoria} não declara a regra do CNPJ`).toContain(REGRA);
    const seja = page.getByRole("link", { name: "Seja parceiro da Viva" }).first();
    await expect(seja).toHaveAttribute("href", `/parceiros?categoria=${categoria}#quero-ser-parceiro`);
  });
}

test("T2079 — E933: /parceiros/fotografos declara a regra do CNPJ @E933 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/parceiros/fotografos", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  expect(await texto(page)).toContain(REGRA);
});
