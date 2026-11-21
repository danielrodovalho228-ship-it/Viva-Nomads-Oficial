import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1575 — guarda permanente de três merges de 08/11 sem spec de laboratório:
    E755 (#3561)  a vitrine de /buscar não troca de ordem entre carregamentos (desempate sempre pelo id): duas cargas seguidas listam os
                  cartões na mesma ordem, a 390 e 1280 px (visitante).
    E760 (#3565)  /dashboard/meus-imoveis (nome antigo) redireciona para /dashboard/imoveis (era 404); o redirect não é permanente (sem 308).
    E764 (#3569)  o estado vazio de Mensagens (conta nova, sem conversa) não diz mais que "telefone e e-mail só aparecem depois do aceite":
                  a regra de contato (E445) é que contato nunca é trocado no chat.
  Só no laboratório (E760 e E764 usam conta nova).
*/
const senha = novaSenha();
const dono = { email: `dono.t1575.${novoSufixo()}@lab.vivanomads.test`, nome: "Dora Guarda", role: "owner" as const };
const ids: { dono?: string } = {};

test.describe("T1575 — E755 (visitante)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  for (const [w, h] of [[390, 844], [1280, 900]] as const) {
    test(`E755 a ${w} px: duas cargas de /buscar listam os cartões na mesma ordem`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      const ordem = async () => {
        await page.goto("/buscar", { waitUntil: "networkidle" });
        await expect(page.getByTestId("cartao-imovel").first()).toBeVisible({ timeout: 30_000 });
        return page.getByTestId("cartao-imovel").evaluateAll((els) => els.map((e) => e.querySelector("a")?.getAttribute("href") ?? ""));
      };
      const a = await ordem();
      const b = await ordem();
      expect(a.length).toBeGreaterThan(0);
      expect(b, "a ordem da vitrine mudou entre carregamentos").toEqual(a);
    });
  }
});

test.describe("T1575 — E760 e E764 (conta nova)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("E760: /dashboard/meus-imoveis leva a /dashboard/imoveis, sem 404 e sem redirect permanente", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    const r = await p.request.get("/dashboard/meus-imoveis", { maxRedirects: 0 });
    expect(r.status(), "redirect temporário (307), nunca 308 nem 404").toBe(307);
    expect(r.headers()["location"] ?? "").toMatch(/\/dashboard\/imoveis$/);
    await p.goto("/dashboard/meus-imoveis", { waitUntil: "domcontentloaded" });
    await expect(p).toHaveURL(/\/dashboard\/imoveis\/?$/);
    await p.context().close();
  });

  for (const [w, h] of [[390, 844], [1280, 900]] as const) {
    test(`E764 a ${w} px: estado vazio de Mensagens sem a promessa de contato depois do aceite`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: h });
      await p.goto("/dashboard/mensagens", { waitUntil: "domcontentloaded" });
      const texto = p.getByTestId("mensagens-vazio-texto");
      await expect(texto).toBeVisible({ timeout: 30_000 });
      expect(await texto.innerText()).not.toMatch(/telefone e e-mail só aparecem depois do aceite/i);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), "rolagem lateral").toBeLessThanOrEqual(1);
      await p.context().close();
    });
  }
});
