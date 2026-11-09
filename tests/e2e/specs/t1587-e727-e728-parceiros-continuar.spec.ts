import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1587 — E727 + E728 (#3505): /parceiros passa pelo proxy (quem está logado vê "Continuar" direto, sem ser tratado como visitante e mandado a /auth) e
  o CNPJ digitado volta do /auth com o resto do rascunho (só o aceite não volta). Guarda no lab:
    E728  visitante, 390 e 1280 px: o rascunho guardado na sessão do navegador (com o CNPJ) reaparece no campo ao abrir /parceiros;
    E727  conta logada: /parceiros abre na própria página (não vai a /auth) e o envio mostra "Enviar pedido de parceria".
  Só no laboratório (E727 usa conta nova).
*/
const RASCUNHO = "vn-parceria-rascunho";
const CNPJ = "11.222.333/0001-81";
const senha = novaSenha();
const dono = { email: `parc.t1587.${novoSufixo()}@lab.vivanomads.test`, nome: "Paula Parceira", role: "tenant" as const };
const ids: { u?: string } = {};

test.describe("T1587 — E728 (visitante)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const [w, h] of [[390, 844], [1280, 900]] as const) {
    test(`a ${w} px: o CNPJ guardado volta ao campo, o aceite não`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto("/parceiros", { waitUntil: "domcontentloaded" });
      await page.evaluate(([k, doc]) => sessionStorage.setItem(k, JSON.stringify({ documento: doc, aceite: true })), [RASCUNHO, CNPJ]);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.locator("#sp-doc")).toHaveValue(CNPJ, { timeout: 30_000 });
      await expect(page.getByTestId("sp-aceite")).not.toBeChecked();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), "rolagem lateral").toBeLessThanOrEqual(1);
    });
  }
});

test.describe("T1587 — E727 (conta logada)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.beforeAll(async () => {
    ids.u = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.u]);
  });

  test("logado, /parceiros abre na própria página e oferece 'Enviar pedido de parceria'", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.goto("/parceiros", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("seja-parceiro-enviar")).toHaveText("Enviar pedido de parceria", { timeout: 30_000 });
    await expect(p).toHaveURL(/\/parceiros\/?$/);
    await p.context().close();
  });
});
