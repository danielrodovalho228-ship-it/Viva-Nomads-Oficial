import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T742 — PUBLICO-A (desenho aprovado em 24/10): o topo público continua Imóveis · Anunciar · Empresas + "Fale com a
  Viva" em texto + "Entrar" como único botão cheio, a 1280 e 390. O globo PT/EN fica atrás da chave SELETOR_IDIOMA:
  desligada (padrão), nada muda; ligada, o português vem marcado e o inglês aparece "em breve", sem poder ser escolhido.
*/
const SAIDA = "tests/laboratorio/saida";
const LIGADA = process.env.NEXT_PUBLIC_SELETOR_IDIOMA === "on";

test.describe("T742 — PUBLICO-A: topo público e o globo PT/EN atrás da chave", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  for (const largura of [1280, 390] as const) {
    test(`${largura} px: 3 destinos, Fale com a Viva em texto, Entrar único botão cheio; globo só com a chave`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const p = await ctx.newPage();
      await p.goto("/", { waitUntil: "domcontentloaded" });
      const topo = p.getByTestId("topo-publico");
      if (largura === 390) await topo.getByTestId("nav-menu").click();
      const area = largura === 390 ? topo.getByTestId("nav-menu-lista") : topo;
      for (const nome of ["Imóveis", "Anunciar", "Empresas", "Fale com a Viva"]) await expect(area.getByRole("link", { name: nome, exact: true })).toBeVisible();
      for (const fora of ["Para proprietários", "Para parceiros", "Parceiros"]) await expect(area.getByRole("link", { name: fora, exact: true })).toHaveCount(0);
      await expect(area.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();

      const globo = topo.getByTestId(largura === 390 ? "seletor-idioma-celular" : "seletor-idioma");
      if (!LIGADA) {
        await expect(globo).toHaveCount(0);
      } else {
        await expect(globo).toBeVisible();
        const id = largura === 390 ? "seletor-idioma-celular" : "seletor-idioma";
        if (largura === 1280) await globo.click();
        await expect(topo.getByTestId(`${id}-pt`)).toHaveAttribute("aria-checked", "true");
        await expect(topo.getByTestId(`${id}-en`)).toHaveAttribute("aria-disabled", "true");
        await expect(topo.getByTestId(`${id}-en`)).toContainText("em breve");
      }
      await p.screenshot({ path: `${SAIDA}/t742-topo-${LIGADA ? "ligada" : "desligada"}-${largura}.png` });
      await ctx.close();
    });
  }
});
