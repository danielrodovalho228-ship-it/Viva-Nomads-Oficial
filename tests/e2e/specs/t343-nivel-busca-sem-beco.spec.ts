import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T343 — NIVEL-BUSCA-A (filtro de nível sem beco sem saída) e MIUDOS-A item 1 ("e menos" na home). A 390 e 1280.
  Massa num bairro só deste teste: um Essencial, um Conforto e um sem nível; num 2º bairro, só um sem nível.
   1. Folha: contagens "a partir de" (Essencial 2, Conforto 1, Premium 0); Premium desabilitado com o "· 0".
   2. 2º bairro (tudo 0): o grupo some e entra a linha "Os níveis aparecem quando…" (sem link).
   3. ?nivel=premium no 1º bairro: "Nenhum imóvel com nível Premium nesta busca" + "Ver todos" volta os 3.
   4. Home: o h2 de "Para proprietários" lê "Mais estabilidade e menos tempo com o imóvel parado." (innerText).
  A /buscar guarda cache de 60 s: o primeiro passo espera os imóveis novos entrarem.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t343.${sufixo}@lab.vivanomads.test`, nome: "Nina Nível", role: "owner" as const };
const BAIRRO = `Bairro T343 ${sufixo}`;
const BAIRRO2 = `Vila T343 ${sufixo}`;
const ids: Record<string, string> = {};
const busca = (bairro: string, q = "") => `/buscar?local=${encodeURIComponent(bairro)}${q}`;
const cards = (page: Page) => page.getByTestId("grade-resultados").getByTestId("card-resultado");
const SAIDA = "tests/laboratorio/saida";

/** Abre a folha de filtros. E82-A: a pílula "Mais filtros" da linha única, em toda largura (como no t244). */
async function abrirFolha(page: Page) {
  await page.getByTestId("pilula-mais").click();
  const folha = page.getByRole("dialog", { name: "Filtros" });
  await expect(folha).toBeVisible();
  return folha;
}

/** E105: abre o painel da pílula "Nível" (o único lugar do filtro de nível). */
async function abrirNivel(page: Page) {
  await expect(async () => {
    await page.getByTestId("pilula-nivel").click({ timeout: 5_000 });
    await expect(page.getByTestId("painel-pilula-nivel")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  return page.getByTestId("painel-pilula-nivel");
}

test.describe("T343 — nível na busca sem beco sem saída", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const massa = [
      ["essencial", BAIRRO, "essencial"],
      ["conforto", BAIRRO, "conforto"],
      ["semNivel", BAIRRO, null],
      ["semNivel2", BAIRRO2, null],
    ] as const;
    for (const [k, bairro, nivel] of massa) {
      ids[k] = await criarImovelPronto(ids.dono, `Studio ${k} t343 ${sufixo}`, { ativo: true, preco: 2600 });
      const { error } = await adm().from("properties").update({ address: bairro }).eq("id", ids[k]);
      if (error) throw error;
      if (nivel) {
        const { error: eN } = await adm().from("imovel_nivel").upsert({ property_id: ids[k], nivel });
        if (eN) throw eN;
      }
    }
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280]) {
    test(`1-3. a ${w} px: contagens, Premium desabilitado, grupo some com tudo 0 e 'Ver todos'`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await expect(async () => {
        await page.goto(busca(BAIRRO), { waitUntil: "domcontentloaded" });
        await expect(cards(page)).toHaveCount(3, { timeout: 5_000 });
      }).toPass({ timeout: 90_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

      // E105: o nível mora só na pílula "Nível" (saiu da folha "Mais filtros").
      const grupo = await abrirNivel(page);
      await expect(grupo.getByTestId("pilula-nivel-essencial-n")).toHaveText("· 2");
      await expect(grupo.getByTestId("pilula-nivel-conforto-n")).toHaveText("· 1");
      await expect(grupo.getByTestId("pilula-nivel-premium-n")).toHaveText("· 0");
      await expect(grupo.getByTestId("pilula-nivel-premium")).toBeDisabled();
      await expect(grupo.getByTestId("pilula-nivel-essencial")).toBeEnabled();
      await expect(grupo.getByTestId("pilula-nivel-conforto")).toBeEnabled();
      await page.screenshot({ path: `${SAIDA}/t343-folha-nivel-${w}.png` });
      await page.keyboard.press("Escape");

      // 2º bairro: tudo 0 → o grupo some e a linha explica, sem link.
      await expect(async () => {
        await page.goto(busca(BAIRRO2), { waitUntil: "domcontentloaded" });
        await expect(cards(page)).toHaveCount(1, { timeout: 5_000 });
      }).toPass({ timeout: 60_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      const grupo2 = await abrirNivel(page);
      await expect(grupo2.getByTestId("pilula-nivel-essencial")).toHaveCount(0);
      const linha = grupo2.getByTestId("painel-nivel-vazio");
      await expect(linha).toHaveText("Os níveis aparecem quando os anúncios desta busca tiverem o padrão mínimo confirmado.");
      await expect(linha.locator("a")).toHaveCount(0);
      await linha.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t343-folha-sem-niveis-${w}.png` });
      await page.keyboard.press("Escape");

      // ?nivel=premium zera a busca: aviso próprio e "Ver todos" tira só o nível.
      await page.goto(busca(BAIRRO, "&nivel=premium"), { waitUntil: "domcontentloaded" });
      const aviso = page.getByTestId("busca-vazia-nivel");
      await expect(aviso).toContainText("Nenhum imóvel com nível Premium nesta busca", { timeout: 30_000 });
      await expect(page.getByTestId("busca-vazia")).toHaveCount(0);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await page.screenshot({ path: `${SAIDA}/t343-aviso-premium-${w}.png` });
      await aviso.getByTestId("busca-vazia-nivel-ver-todos").click();
      await expect(cards(page)).toHaveCount(3, { timeout: 15_000 });
      await expect(page).not.toHaveURL(/nivel=/);
      expect(new URL(page.url()).searchParams.get("local")).toBe(BAIRRO);
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra).toBeLessThanOrEqual(1);
    });
  }

  for (const w of [390, 1280]) {
    test(`4. home a ${w} px: "Mais estabilidade e menos tempo com o imóvel parado." (innerText)`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      const h2 = page.locator("h2", { hasText: "Mais estabilidade" });
      await h2.scrollIntoViewIfNeeded();
      const texto = await h2.evaluate((el) => (el as HTMLElement).innerText.replace(/\s+/g, " ").trim());
      expect(texto).toContain("e menos");
      expect(texto).toBe("Mais estabilidade e menos tempo com o imóvel parado.");
      await page.screenshot({ path: `${SAIDA}/t343-home-proprietarios-${w}.png` });
    });
  }
});
