import { test, expect } from "@playwright/test";

/*
  T2056 — E794 (Pista 3; autorizado pelo Gerente em 16/11) @E794 @ao-vivo-seguro
  Regra (E445): a landing /parceiros não promete "identidade revelada depois/após o aceite" (nada é revelado nem trocado
  após o aceite; o contato nunca é trocado) — nem no herói, nem no cartão de números — e as páginas públicas de
  Parceiros também não. Visitante, só leitura.
*/
test.use({ storageState: { cookies: [], origins: [] } });
const REVELA = /identidade[^.\n"]{0,30}revelad\w*[^.\n"]{0,20}(depois|ap[óo]s)\s+(d?o\s+)?aceite/i;

for (const rota of ["/parceiros", "/parceiros/buscar", "/parceiros/avaliadores"]) {
  test(`T2056 — E794: ${rota} não promete identidade revelada depois do aceite @E794 @ao-vivo-seguro`, async ({ page }) => {
    const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
    expect(r?.status()).toBe(200);
    await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
    const texto = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(texto.match(REVELA)?.[0] ?? null, `${rota}: promessa de identidade revelada`).toBeNull();
  });
}
