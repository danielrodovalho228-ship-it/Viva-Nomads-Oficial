import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T275 — Internet medida no imóvel (Prompt 57, fase 1). Motor simulado no laboratório (328/42/12 ms, nada sai para a
 * rede) e localização simulada pelo navegador. Dono mede na edição perto do imóvel → a página mostra o número com a
 * data e "Boa para videochamadas" + "Ideal para: Home office · internet medida"; mede longe → "não validada" e a página
 * fica no informado; medição vencida → volta ao informado.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t273.${sufixo}@lab.vivanomads.test`, nome: "Iris Internet", role: "owner" as const };
// Um imóvel por caso: a página do imóvel é ISR (60 s) e o teste mexe direto no banco nos casos 3 e 4.
const ids: { dono?: string; imovel?: string; longe?: string; vencida?: string } = {};
const IMOVEL = { lat: -18.9186, lng: -48.2772 };
const PERTO = { latitude: -18.9178, longitude: -48.2772 }; // ~90 m
const LONGE = { latitude: -18.8736, longitude: -48.2772 }; // ~5 km
const hoje = () => new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

async function medir(page: Page, imovel: string, onde: { latitude: number; longitude: number }) {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation(onde);
  await page.goto(`/dashboard/imoveis/${imovel}/editar`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Comodidades/ }).click();
  const bloco = page.getByTestId("medir-internet");
  await expect(bloco).toBeVisible({ timeout: 20_000 });
  await bloco.getByTestId("medir-internet-wifi").check();
  await bloco.getByTestId("medir-internet-botao").click();
  const r = bloco.getByTestId("medir-internet-resultado");
  await expect(r).toBeVisible({ timeout: 30_000 });
  return r;
}

test.describe("T275 — internet medida no imóvel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    for (const k of ["imovel", "longe", "vencida"] as const) {
      ids[k] = await criarImovelPronto(ids.dono, `Studio Internet ${k} ${sufixo}`, { ativo: true });
      const { error } = await adm()
        .from("properties")
        .update({ lat: IMOVEL.lat, lng: IMOVEL.lng, lat_exata: IMOVEL.lat, lng_exata: IMOVEL.lng, internet_mbps: 300, tag_home_office: true })
        .eq("id", ids[k]!);
      if (error) throw error;
    }
  });

  test.afterAll(async () => {
    await adm().from("internet_medicoes").delete().in("property_id", [ids.imovel, ids.longe, ids.vencida].filter(Boolean) as string[]);
    await apagarContas([ids.dono]);
  });

  test("1. sem medição: a página mostra só o informado, sem frase de capacidade", async ({ browser }) => {
    const ctx = await browser.newContext();
    const v = await ctx.newPage();
    await v.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    await expect(v.getByTestId("internet-informada")).toHaveText("Internet informada pelo proprietário: 300 Mbps (não medida)", { timeout: 20_000 });
    await expect(v.getByTestId("internet-capacidade")).toHaveCount(0);
    await ctx.close();
  });

  test("2. dono mede perto do imóvel → a página mostra o número com a data, a capacidade e a etiqueta medida", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    const r = await medir(page, ids.imovel!, PERTO);
    await expect(r).toHaveAttribute("data-validada", "1");
    await expect(r).toContainText("328 Mbps para baixar · 42 para enviar · 12 ms");
    const { data } = await adm().from("internet_medicoes").select("distancia_m, validada, papel, origem").eq("property_id", ids.imovel!);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ validada: true, papel: "dono", origem: "edicao" });
    expect(data![0].distancia_m).toBeLessThanOrEqual(300);
    await page.screenshot({ path: "tests/laboratorio/saida/t275-medir-390.png", fullPage: true });
    await page.context().close();

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const v = await ctx.newPage();
    await v.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    await expect(v.getByTestId("internet-medida")).toHaveText(`Internet medida no imóvel: 328 Mbps para baixar · 42 para enviar · 12 ms — medida em ${hoje()}`, { timeout: 20_000 });
    await expect(v.getByTestId("internet-capacidade")).toHaveText("Boa para videochamadas");
    await expect(v.getByTestId("ideal-para").first()).toContainText("Home office · internet medida");
    await v.screenshot({ path: "tests/laboratorio/saida/t275-pagina-1280.png", fullPage: true });
    await ctx.close();
  });

  test("3. medido longe → não validada; a página fica no informado", async ({ browser }) => {
    test.setTimeout(120_000);
    const page = await entrar(browser, dono.email, senha);
    const r = await medir(page, ids.longe!, LONGE);
    await expect(r).toHaveAttribute("data-validada", "0");
    await expect(r).toContainText("Não validada: o aparelho estava a mais de 300 m do imóvel");
    await page.context().close();
    const ctx = await browser.newContext();
    const v = await ctx.newPage();
    await v.goto(`/imoveis/${ids.longe}`, { waitUntil: "domcontentloaded" });
    await expect(v.getByTestId("internet-informada")).toBeVisible({ timeout: 20_000 });
    await expect(v.getByTestId("internet-medida")).toHaveCount(0);
    await ctx.close();
  });

  test("4. medição vencida volta ao informado", async ({ browser }) => {
    const passado = new Date(Date.now() - 200 * 86_400_000);
    const { error } = await adm()
      .from("internet_medicoes")
      .insert({ property_id: ids.vencida, user_id: ids.dono, papel: "dono", download_mbps: 500, upload_mbps: 50, latencia_ms: 9, distancia_m: 20, validada: true, origem: "edicao", medido_em: passado.toISOString(), valido_ate: new Date(Date.now() - 86_400_000).toISOString() });
    if (error) throw error;
    const ctx = await browser.newContext();
    const v = await ctx.newPage();
    await v.goto(`/imoveis/${ids.vencida}`, { waitUntil: "domcontentloaded" });
    await expect(v.getByTestId("internet-informada")).toHaveText("Internet informada pelo proprietário: 300 Mbps (não medida)", { timeout: 20_000 });
    await expect(v.getByTestId("internet-medida")).toHaveCount(0);
    await ctx.close();
  });
});
