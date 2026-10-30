import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T720 — E286 (#1632), o que a t740 não olha: o RÓTULO que a pessoa lê no seletor "Categoria" (a t740 confere o value).
  Pista C, bloco 76 (30/10). Visitante, 1280 e 390.
   1. /parceiros/buscar?categoria=montagem → o seletor mostra "Montagem de móveis"; /parceiros/buscar → "Todas".
   2. Cada categoria do catálogo aberta pela URL mostra o próprio rótulo no seletor (não fica em "Todas" nem na anterior).
   3. Vindo pela faixa de categorias (navegação no cliente) e voltando para "Todas" pela faixa: o rótulo acompanha.
*/
const SAIDA = "tests/laboratorio/saida";
const CATALOGO: { valor: string; rotulo: string }[] = [
  { valor: "montagem", rotulo: "Montagem de móveis" },
  { valor: "limpeza", rotulo: "Limpeza" },
];

/** O texto da opção escolhida — o que aparece escrito no seletor fechado. */
const rotuloDoSeletor = (p: Page) => p.locator("#bp-categoria").evaluate((s: HTMLSelectElement) => s.options[s.selectedIndex]?.text.trim() ?? "");

test.describe("T720 — E286: o seletor de Categoria mostra o rótulo da categoria da URL", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ timeout: 120_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: "Montagem de móveis" com ?categoria=montagem, "Todas" sem categoria, e cada categoria com o seu rótulo`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const p = await ctx.newPage();

      // 1. O caso da conferência.
      await p.goto("/parceiros/buscar?categoria=montagem", { waitUntil: "domcontentloaded" });
      await expect(p.locator("#bp-categoria")).toHaveValue("montagem", { timeout: 20_000 });
      await expect.poll(() => rotuloDoSeletor(p)).toBe("Montagem de móveis");
      await p.locator("#bp-categoria").scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t720-montagem-${largura}.png` });
      await p.goto("/parceiros/buscar", { waitUntil: "domcontentloaded" });
      await expect(p.locator("#bp-categoria")).toHaveValue("", { timeout: 20_000 });
      await expect.poll(() => rotuloDoSeletor(p)).toBe("Todas");

      // 2. Todas as categorias do catálogo (lidas do próprio seletor): cada URL mostra o seu rótulo.
      const opcoes = await p.locator("#bp-categoria option").evaluateAll((os) => (os as HTMLOptionElement[]).map((o) => ({ valor: o.value, rotulo: o.text.trim() })));
      expect(opcoes[0]).toEqual({ valor: "", rotulo: "Todas" });
      for (const esperado of CATALOGO) expect(opcoes).toContainEqual(esperado);
      for (const { valor, rotulo } of opcoes.filter((o) => o.valor)) {
        await p.goto(`/parceiros/buscar?categoria=${valor}`, { waitUntil: "domcontentloaded" });
        await expect.poll(() => rotuloDoSeletor(p), { message: `?categoria=${valor}`, timeout: 20_000 }).toBe(rotulo);
      }

      // 3. Pela faixa (sem recarregar): Montagem → Todas, o rótulo acompanha nos dois sentidos.
      await p.goto("/parceiros/buscar", { waitUntil: "domcontentloaded" });
      await p.getByTestId("faixa-categoria-montagem").click();
      await expect(p).toHaveURL(/categoria=montagem/, { timeout: 30_000 });
      await expect.poll(() => rotuloDoSeletor(p)).toBe("Montagem de móveis");
      const todas = p.locator('[data-testid^="faixa-categoria-"]').filter({ hasText: /^Todas$/ });
      if (await todas.count()) {
        await todas.first().click();
        await expect(p).not.toHaveURL(/categoria=/, { timeout: 30_000 });
        await expect.poll(() => rotuloDoSeletor(p)).toBe("Todas");
      }
      await ctx.close();
    });
  }
});
