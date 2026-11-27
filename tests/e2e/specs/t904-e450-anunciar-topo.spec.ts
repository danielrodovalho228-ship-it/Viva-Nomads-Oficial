import { test, expect } from "@playwright/test";

/*
  T904 — E450: o "Anunciar" do cabeçalho público não joga o dono direto no login. De Início, Buscar e Parceiros, o
  visitante que toca em "Anunciar" chega primeiro à página pública do dono (/para-proprietarios) — o mesmo destino do
  CTA da seção de donos e do rodapé —, nunca à parede /auth?motivo=anunciar. 390 (menu) e 1280 (barra).
*/
test.use({ storageState: { cookies: [], origins: [] } });

for (const largura of [1280, 390] as const) {
  test.describe(`T904 — Anunciar no topo a ${largura} px`, () => {
    test.use({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });

    for (const origem of ["/", "/buscar", "/parceiros"]) {
      test(`de ${origem}: Anunciar abre /para-proprietarios, sem login`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.goto(origem, { waitUntil: "domcontentloaded" });
        // A /buscar acerta a própria URL ao montar (filtros): um toque antes disso pode ser engolido pela troca de rota.
        await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
        const topo = page.getByTestId("topo-publico");
        let anunciar;
        if (largura === 390) {
          // O toque pode se perder se o topo hidratar no meio: repete até a lista abrir.
          const lista = page.getByTestId("nav-menu-lista");
          await expect(async () => {
            if (!(await lista.isVisible())) await topo.getByTestId("nav-menu").click();
            await expect(lista).toBeVisible({ timeout: 2_000 });
          }).toPass({ timeout: 30_000 });
          anunciar = lista.getByRole("link", { name: "Anunciar", exact: true });
        } else {
          anunciar = topo.getByTestId("nav-links").getByRole("link", { name: "Anunciar", exact: true });
        }
        await expect(anunciar).toHaveAttribute("href", "/para-proprietarios", { timeout: 20_000 });
        await anunciar.click();
        await page.waitForURL((u) => u.pathname === "/para-proprietarios", { timeout: 60_000 });
        expect(new URL(page.url()).pathname).not.toBe("/auth");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      });
    }
  });
}
