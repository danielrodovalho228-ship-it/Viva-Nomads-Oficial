import { test, expect } from "@playwright/test";

/*
  T2053 — E626 (Pista 3; autorizado pelo Gerente em 16/11 como TRAVA DE REGRESSÃO dos selos, cobertura nomeada do item)
  @E626 @ao-vivo-seguro. Regra (estudo de selos aprovado pelo Daniel, 06/11): o cartão da busca mostra no MÁXIMO 2
  pílulas sobre a foto — a 1ª é o nível EM PALAVRA (Essencial, Conforto ou Premium), sem "· vistoriado"; a 2ª é só de
  símbolos, nesta ordem: verificado, preço justo, pets, negociação, cada um com o texto completo em aria-label e title.
  Visitante, só leitura: confere todos os cartões da /buscar, a 390 e a 1280 px.
*/
test.use({ storageState: { cookies: [], origins: [] } });
const ORDEM = ["verificado", "precoJusto", "pets", "negocia"];
const NIVEIS = ["Essencial", "Conforto", "Premium"];

for (const largura of [390, 1280] as const) {
  test(`T2053 — E626 a ${largura} px: no máximo 2 pílulas, nível em palavra e símbolos na ordem @E626 @ao-vivo-seguro`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first()).toBeVisible({ timeout: 30_000 });
    const cartoes = await page.getByTestId("card-resultado").all();
    expect(cartoes.length).toBeGreaterThan(0);
    let comSelos = 0;
    for (const c of cartoes) {
      const id = await c.getAttribute("data-id");
      const faixa = c.getByTestId("selos-foto");
      if (!(await faixa.count())) continue;
      comSelos++;
      const nivel = faixa.getByTestId("card-nivel");
      const simbolos = faixa.getByTestId("selos-simbolos");
      const pilulas = (await nivel.count()) + (await simbolos.count());
      expect(pilulas, `${id}: pílulas`).toBeGreaterThanOrEqual(1);
      expect(pilulas, `${id}: no máximo 2 pílulas`).toBeLessThanOrEqual(2);
      expect(await faixa.getAttribute("data-pilulas"), `${id}: data-pilulas`).toBe(String(pilulas));
      expect(await nivel.count(), `${id}: um nível só`).toBeLessThanOrEqual(1);
      expect(await simbolos.count(), `${id}: uma pílula de símbolos só`).toBeLessThanOrEqual(1);
      if (await nivel.count()) {
        const t = (await nivel.innerText()).trim();
        expect(NIVEIS, `${id}: nível "${t}"`).toContain(t);
      }
      if (await simbolos.count()) {
        const itens = simbolos.locator("[data-selo]");
        const ids = await itens.evaluateAll((es) => es.map((e) => e.getAttribute("data-selo")!));
        expect(ids.length, `${id}: pílula de símbolos vazia`).toBeGreaterThan(0);
        expect(ids, `${id}: ordem dos símbolos`).toEqual(ORDEM.filter((o) => ids.includes(o)));
        for (const s of await itens.all()) {
          const rotulo = await s.getAttribute("aria-label");
          expect(rotulo && rotulo.trim().length > 0, `${id}: símbolo sem nome`).toBe(true);
          expect(await s.getAttribute("title"), `${id}: title = aria-label`).toBe(rotulo);
          expect((await s.innerText()).trim(), `${id}: símbolo só com ícone`).toBe("");
        }
      }
      await expect(faixa, `${id}: sem 'vistoriado' sobre a foto`).not.toContainText(/vistoriad/i);
    }
    test.info().annotations.push({ type: "cartões com selos", description: String(comSelos) });
  });
}
