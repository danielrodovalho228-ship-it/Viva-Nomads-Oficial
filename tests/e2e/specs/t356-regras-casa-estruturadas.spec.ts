import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T356 — CAMPOS-1: regras da casa ESTRUTURADAS.
 *   1. o dono define no editor (grupo "Regras da casa" → Convivência): silêncio 22h–8h, fumar só na área externa, festas
 *      proibidas, visitas até 22h sem pernoite → o servidor grava regras_casa validado e o smoking_allowed antigo acompanha;
 *   2. a folha pública "Regras da casa" (Bom saber) mostra os fatos de sempre e uma linha com ícone por regra definida,
 *      sem "não informado"; a linha-resumo continua com os 2 primeiros fatos (390 e 1280);
 *   3. o dono volta "Festas" para "Não definido" → a linha some da folha.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t356.${sufixo}@lab.vivanomads.test`, nome: "Rita Regras", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
async function abrirSecaoRegras(d: Page) {
  await d.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
  const secao = d.getByTestId("secao-regras");
  await expect(async () => {
    if ((await secao.getAttribute("data-aberta")) !== "true") await secao.getByRole("button").first().click({ timeout: 3_000 });
    await expect(secao.getByTestId("regras-casa")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  return secao;
}
async function abrirFolhaRegras(page: Page) {
  const janela = page.getByRole("dialog");
  await expect(async () => {
    if (!(await janela.isVisible())) await page.getByTestId("bom-saber-regras").click();
    await expect(janela).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  return janela;
}
const regrasNoBanco = async () => (await adm().from("properties").select("regras_casa, smoking_allowed").eq("id", ids.imovel!).single()).data;

test.describe("T356 — CAMPOS-1: regras da casa estruturadas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio das regras ${sufixo}`, { ativo: true, preco: 2800 });
    await adm().from("properties").update({ max_guests: 3, pets_allowed: false, smoking_allowed: true, regras_casa: null }).eq("id", ids.imovel);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  test("1. o dono define as regras no editor → o servidor grava validado", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    const secao = await abrirSecaoRegras(d);
    await secao.getByTestId("regras-casa-silencio-inicio").fill("22:00");
    await secao.getByTestId("regras-casa-silencio-fim").fill("08:00");
    await secao.getByTestId("regras-casa-fumo").getByLabel("Só na área externa", { exact: true }).check();
    await secao.getByTestId("regras-casa-festas").getByLabel("Proibidas", { exact: true }).check();
    await secao.getByTestId("regras-casa-visitas").getByLabel("Sim", { exact: true }).check();
    await secao.getByTestId("regras-casa-visitas-ate").fill("22:00");
    await secao.getByTestId("regras-casa-pernoite").getByLabel("Não", { exact: true }).check();
    await semRolagemLateral(d);
    await secao.getByTestId("regras-casa").screenshot({ path: `${SAIDA}/t356-editor-regras-1280.png` });
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect.poll(async () => (await regrasNoBanco())?.regras_casa, { timeout: 20_000 }).toEqual({
      silencio: { inicio: "22:00", fim: "08:00" },
      fumo: "area_externa",
      festas: "proibido",
      visitas: { permitidas: true, ate: "22:00", pernoite: false },
    });
    // Fumar só na área externa não é fumar no imóvel: o fato antigo acompanha.
    expect((await regrasNoBanco())?.smoking_allowed).toBe(false);
    await d.context().close();
  });

  for (const largura of [390, 1280]) {
    test(`2. a folha pública mostra cada regra definida com ícone, resumo curto — ${largura} px`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("bom-saber-regras")).toContainText("Até 3 pessoas · sem pets", { timeout: 30_000 });
      const janela = await abrirFolhaRegras(page);
      const lista = janela.getByTestId("regras-casa-lista");
      await expect(lista.locator("li")).toHaveCount(6);
      await expect(janela.getByTestId("regra-casa-pessoas")).toHaveText("Até 3 pessoas");
      await expect(janela.getByTestId("regra-casa-pets")).toHaveText("Sem pets");
      await expect(janela.getByTestId("regra-casa-silencio")).toHaveText("Silêncio das 22h às 8h");
      await expect(janela.getByTestId("regra-casa-fumo")).toHaveText("Não fuma dentro de casa · só na área externa");
      await expect(janela.getByTestId("regra-casa-festas")).toHaveText("Festas não são permitidas");
      await expect(janela.getByTestId("regra-casa-visitas")).toHaveText("Visitas até às 22h · não podem pernoitar");
      for (const li of await lista.locator("li").all()) await expect(li.locator("svg")).toHaveCount(1);
      await expect(janela).not.toContainText(/não informad|não definid/i);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t356-folha-regras-${largura}.png` });
    });
  }

  test("3. regra que volta a 'Não definido' some da folha", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 390, height: 844 });
    const secao = await abrirSecaoRegras(d);
    await secao.getByTestId("regras-casa-festas").getByLabel("Não definido", { exact: true }).check();
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect.poll(async () => ((await regrasNoBanco())?.regras_casa as { festas?: string } | null)?.festas ?? null, { timeout: 20_000 }).toBeNull();
    await d.context().close();

    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await expect(async () => {
      await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      const janela = await abrirFolhaRegras(p);
      await expect(janela.getByTestId("regra-casa-festas")).toHaveCount(0, { timeout: 3_000 });
      await expect(janela.getByTestId("regra-casa-silencio")).toBeVisible({ timeout: 3_000 });
    }).toPass({ timeout: 60_000 });
    await p.close();
  });
});
