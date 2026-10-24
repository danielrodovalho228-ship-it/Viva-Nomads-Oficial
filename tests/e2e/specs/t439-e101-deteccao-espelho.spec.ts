import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T439 — E101-DETECCAO-A. Só no laboratório (resposta fixa da detecção, nada sai).
   1. Hífen pendurado: o anúncio sem UF mostra "Bairro, Cidade" (nunca "Cidade -"); com UF, "Bairro, Cidade - UF".
   2. Detecção na edição: em "Nível, ruído e extras", com a chave desligada nada aparece; ligada, as sugestões ficam
      ACIMA dos itens de prova. Item de nível: "Parece que você tem isto: fotografe agora para comprovar" + a câmera do
      item (nunca "Usar esta foto"). Comodidade: Confirmar grava na hora no anúncio.
   3. E55: o espelho do perfil acompanha o papel em uso. Proprietário: "É assim que o morador te vê no seu anúncio",
      com foto, nome e "Na Viva desde"; "Ver como morador" troca para o espelho de morador.
  Em 390 e 1280 px, com prints.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.e101.${sufixo}@lab.vivanomads.test`, nome: "Dora Espelho", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}

test.describe("T439 — E101: localização, detecção na edição e espelho por papel", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Espelho ${sufixo}`);
    // A mesma galeria da t389 (a 1ª foto mostra micro-ondas e máquina de lavar na resposta fixa do laboratório).
    const urls: string[] = [];
    for (let i = 0; i < 4; i++) {
      const c = `${ids.dono}/${randomUUID()}.webp`;
      const { error } = await adm().storage.from("property-photos").upload(c, pngDeTeste(i), { contentType: "image/png", upsert: true });
      if (error) throw error;
      urls.push(`https://lab.vivanomads.test/storage/v1/object/public/property-photos/${c}`);
    }
    await adm().from("property_photos").delete().eq("property_id", ids.imovel);
    const { error } = await adm().from("property_photos").insert(urls.map((url, i) => ({ property_id: ids.imovel, url, sort_order: i })));
    if (error) throw error;
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. sem UF, a localização não deixa hífen pendurado; com UF, 'Bairro, Cidade - UF'", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await adm().from("properties").update({ neighborhood: "Santa Mônica", city: "Uberlândia", state: "" }).eq("id", ids.imovel);
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    const linha = page.locator("header").filter({ hasText: "Santa Mônica" }).first();
    await expect(linha).toContainText("Santa Mônica, Uberlândia");
    expect(await page.locator("main").innerText()).not.toMatch(/Uberlândia\s*-\s*(\n|$)/);
    await adm().from("properties").update({ state: "MG" }).eq("id", ids.imovel);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("main")).toContainText("Santa Mônica, Uberlândia - MG");
    await page.context().close();
  });

  for (const w of LARGURAS) {
    test(`2. a ${w} px: desligada, nada; ligada, as sugestões acima dos itens de prova`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await largura(page, w);
      await page.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("nivel-resumo")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("deteccao-fotos")).toHaveCount(0);

      await page.context().addCookies([{ name: "vn_lab_deteccao", value: "1", url: new URL(page.url()).origin }]);
      await page.reload({ waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("deteccao-fotos");
      const item = bloco.getByTestId("deteccao-sugestao-cozinha_microondas");
      await expect(item).toBeVisible({ timeout: 30_000 });
      await expect(item.getByTestId("deteccao-texto-cozinha_microondas")).toHaveText("Parece que você tem isto: fotografe agora para comprovar");
      await expect(item.getByTestId("deteccao-fotografar-cozinha_microondas")).toBeVisible();
      await expect(bloco.getByText("Usar esta foto")).toHaveCount(0);
      // Acima dos itens de prova (o formulário do nível).
      const yBloco = (await bloco.boundingBox())!.y;
      const form = page.locator("form, [data-testid^='nivel-item-']").first();
      expect(yBloco).toBeLessThan((await form.boundingBox())!.y);
      await page.screenshot({ path: `${SAIDA}/t439-nivel-sugestoes-${w}.png` });

      if (w === 1280) {
        // Comodidade: confirma e grava no anúncio na hora.
        const maquina = bloco.getByTestId("deteccao-sugestao-maquina_lavar");
        await expect(maquina).toHaveAttribute("data-tipo", "comodidade");
        await maquina.getByTestId("deteccao-confirmar-maquina_lavar").click();
        await expect(bloco.getByTestId("deteccao-sugestao-maquina_lavar")).toHaveCount(0, { timeout: 15_000 });
        await expect
          .poll(async () => ((await adm().from("property_amenities").select("label").eq("property_id", ids.imovel!)).data ?? []).length, { timeout: 15_000 })
          .toBeGreaterThan(0);
      }
      await page.context().close();
    });
  }

  for (const w of LARGURAS) {
    test(`3. a ${w} px: espelho do proprietário e 'Ver como morador'`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await largura(page, w);
      await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      const espelho = page.locator('[data-testid="espelho-papel"]:visible').first();
      await expect(espelho).toHaveAttribute("data-papel", "proprietario", { timeout: 30_000 });
      await expect(espelho.getByTestId("espelho-titulo")).toHaveText("É assim que o morador te vê no seu anúncio");
      await expect(espelho.getByTestId("espelho-nome")).toContainText("Dora");
      await expect(espelho.getByTestId("espelho-desde")).toContainText("Na Viva desde");
      await page.screenshot({ path: `${SAIDA}/t439-espelho-proprietario-${w}.png` });
      await espelho.getByTestId("espelho-ver-como").click();
      await expect(espelho).toHaveAttribute("data-papel", "morador");
      await expect(espelho.getByTestId("espelho-titulo")).toHaveText("É assim que o proprietário te vê quando você pede para morar");
      await expect(espelho.getByTestId("espelho-ver-como")).toHaveText("Ver como proprietário");
      await page.screenshot({ path: `${SAIDA}/t439-espelho-morador-${w}.png` });
      await page.context().close();
    });
  }
});
