import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T916 — Varredura 17 (05/11): em Buscas salvas havia DUAS barras de abas empilhadas (subabas do morador e a FavoritosTabs
  antiga, que repetia Favoritos e Buscas salvas e a 390 saía cortada). Agora: Buscas salvas aparece UMA vez (a subaba do
  menu) e "Comparações" só em Favoritos e Comparações. 390 e 1280, sessão real (morador).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const mor = { email: `mor.t916.${sufixo}@lab.vivanomads.test`, nome: "Bia Buscas", role: "tenant" as const };
const ids: string[] = [];

// O Playwright serializa a função: o rótulo vai como ARGUMENTO do evaluateAll (a closure não atravessa para o navegador).
const contaVisiveis = (els: Element[], rotulo: string) =>
  els.filter((a) => a.getBoundingClientRect().height > 0 && a.textContent?.trim() === rotulo && !a.closest("footer")).length;

test.describe("T916 — Buscas salvas com uma barra de abas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    const id = await criarConta(mor, senha);
    ids.push(id);
    await adm().from("profiles").update({ is_teste: true, preferred_mode: "tenant", papel_ativo: "morador" }).eq("id", id);
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const p = await entrarNaPagina(await ctx.newPage(), mor.email, senha);
      await p.goto("/dashboard/buscas", { waitUntil: "domcontentloaded" });
      await expect(p.getByRole("heading", { name: "Buscas salvas", level: 1 })).toBeVisible({ timeout: 30_000 });
      expect(await p.locator("a").evaluateAll(contaVisiveis, "Buscas salvas"), "um link Buscas salvas (a subaba)").toBe(1);
      expect(await p.locator("a").evaluateAll(contaVisiveis, "Comparações"), "sem a barra Favoritos · Comparações").toBe(0);
      await p.screenshot({ path: `tests/laboratorio/saida/t916-buscas-${w}.png` });
      for (const r of ["/dashboard/favoritos", "/dashboard/comparar"]) {
        await p.goto(r, { waitUntil: "domcontentloaded" });
        await expect(p.locator("a", { hasText: "Comparações" }).first()).toBeVisible({ timeout: 30_000 });
        expect(await p.locator("a").evaluateAll(contaVisiveis, "Buscas salvas"), `${r}: Buscas salvas uma vez`).toBe(1);
      }
      expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
});
