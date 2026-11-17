import { test, expect } from "@playwright/test";

/*
  T2063 — E919 (Pista 3; autorizado pelo Gerente em 17/11) @E919 @ao-vivo-seguro
  Regra decidida: no cartão "Limpeza e manutenção" de /parceiros, o texto diz "reparos e manutenção leve" — com a
  palavra "leve". Ajuste de texto, sem mudança de comportamento; a correção é do Code 2. Esta spec é a trava
  (vermelha na main até a correção entrar). Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });

test("T2063 — E919: o cartão Limpeza e manutenção de /parceiros diz reparos e manutenção leve @E919 @ao-vivo-seguro", async ({ page }) => {
  const r = await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
  expect(r?.status()).toBe(200);
  const cartao = page
    .getByTestId("parceiros-tipos")
    .locator("li")
    .filter({ has: page.getByRole("heading", { name: "Limpeza e manutenção", exact: true }) });
  await expect(cartao).toHaveCount(1, { timeout: 30_000 });
  const texto = (await cartao.innerText()).replace(/\s+/g, " ");
  expect(texto, "o cartão promete só manutenção leve").toMatch(/reparos e manutenção leve\b/i);
});
