import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T428 — E142 (levantamento do Daniel, 25/10; correção na Pista A). Ao entrar no Passo 5 (Comodidades), o bloco da
  detecção ("Encontramos isto numa foto sua") aparece sem rolar nem mexer em nada: visível e dentro da tela na chegada.
  A mesma galeria e a mesma chave do laboratório da t432 (cookie vn_lab_deteccao). 390 e 1280 px. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t428.${sufixo}@lab.vivanomads.test`, nome: "Dalva Detecta", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

async function ligarNoLaboratorio(page: Page) {
  await page.context().addCookies([{ name: "vn_lab_deteccao", value: "1", url: new URL(page.url()).origin }]);
}

test.describe("T428 — E142: o bloco da detecção na chegada ao Passo 5", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Detecta ${sufixo}`);
    const caminhos: string[] = [];
    for (let i = 0; i < 4; i++) {
      const c = `${ids.dono}/${randomUUID()}.webp`;
      const { error } = await adm().storage.from("property-photos").upload(c, pngDeTeste(i), { contentType: "image/png", upsert: true });
      if (error) throw error;
      caminhos.push(c);
    }
    const urls = caminhos.map((c) => `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${c}`);
    await adm().from("property_photos").delete().eq("property_id", ids.imovel);
    const { error } = await adm().from("property_photos").insert(urls.map((url, i) => ({ property_id: ids.imovel, url, sort_order: i })));
    if (error) throw error;
    const { error: eRasc } = await adm()
      .from("properties")
      .update({ draft_data: { title: `Studio Detecta ${sufixo}`, city: "Uberlândia", photos: urls.map((url) => ({ url })), amenityKeys: {} } })
      .eq("id", ids.imovel);
    if (eRasc) throw eRasc;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: o bloco da detecção aparece e está dentro da tela na chegada, sem rolar`, async ({ browser }) => {
      // E142 (corrigido na Pista A): a detecção abre o Passo 5, no topo; o resultado aparece sem rolar.
      const page = await entrar(browser, dono.email, senha);
      await ligarNoLaboratorio(page);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("deteccao-fotos");
      // Nenhum scroll, clique ou movimento do mouse: só espera.
      await expect(bloco.getByTestId("deteccao-sugestao-maquina_lavar")).toBeVisible({ timeout: 30_000 });
      expect(await page.evaluate(() => window.scrollY), "a página não rolou sozinha").toBe(0);
      await expect(bloco, "o bloco da detecção dentro da tela na chegada").toBeInViewport();
      await page.screenshot({ path: `tests/laboratorio/saida/t428-chegada-${w}.png` });
      await page.context().close();
    });
  }
});
