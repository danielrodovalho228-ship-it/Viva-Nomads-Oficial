import { test, expect } from "@playwright/test";
import { problemasDoMapaAnonimo, type TileVisto } from "../../../src/lib/lab/mapa-regras";

/*
  T258 — mapa da /buscar em sessão ANÔNIMA (ordem c4323fd9, PR #478; antes um script em scripts/lab):
  0 tile da CARTO sem ?key=, 0 tile carimbado de 2049 bytes e data-mapa-base="carto" no #mapa-busca.
  Roda contra a produção (LAB_MAPA_CARTO=1 ou baseURL de produção); no lab local, sem a chave da CARTO,
  o mapa fica em "sem-chave" de propósito e o teste pula com o motivo explícito, nunca "passa".
*/
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1440, height: 900 } });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
});

test("mapa anônimo da /buscar: tiles com chave, nenhum carimbado, base carto", async ({ page, baseURL }) => {
  const emProducao = /vivanomads\.com\.br/.test(baseURL ?? "") || process.env.LAB_MAPA_CARTO === "1";
  test.skip(!emProducao, "sem a chave da CARTO no lab local (data-mapa-base=sem-chave); roda na produção ou com LAB_MAPA_CARTO=1");

  const tiles: TileVisto[] = [];
  page.on("response", async (r) => {
    if (!/cartocdn\.com/.test(r.url())) return;
    let bytes = -1;
    try {
      bytes = (await r.body()).length;
    } catch {}
    tiles.push({ url: r.url(), bytes });
  });
  await page.goto("/buscar", { waitUntil: "networkidle" });
  await expect(page.getByTestId("mapa-busca")).toHaveAttribute("data-mapa-base", "carto");
  await page.waitForTimeout(3000);
  expect(await page.context().cookies(), "sessão anônima não deve ter cookies de login").not.toContainEqual(expect.objectContaining({ name: expect.stringMatching(/auth-token/) }));
  expect(problemasDoMapaAnonimo(tiles)).toEqual([]);
});
