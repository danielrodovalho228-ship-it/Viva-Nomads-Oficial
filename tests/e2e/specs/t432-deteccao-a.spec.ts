// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, pngDeTeste } from "../fixtures/laboratorio";

/*
  T432 — Detecção-A (Entrega 3, chave DETECCAO_FOTOS_ATIVO; no laboratório o cookie vn_lab_deteccao liga só neste
  navegador). Mesma galeria da t389 (micro-ondas + máquina de lavar na 1ª foto; pessoa na 2ª). 390 e 1280, com prints.
   1. Desligada: nem o alerta do topo, nem o bloco, nem comodidade tracejada.
   2. Ligada: "Encontramos isto numa foto sua" com "Confirmar" e "Não é isso" (FOTO-NA-HORA: nunca "Usar esta foto"); a máquina de lavar achada aparece
      tracejada na grade, com "Confirme"; no topo, o alerta do que falta foto com "Enviar foto", que leva à lista do nível.
   3. "Confirmar" na máquina de lavar: a comodidade fica marcada e deixa de ser tracejada.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t432.${sufixo}@lab.vivanomads.test`, nome: "Dalia Detecta", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const caminhos: string[] = [];
const LARGURAS = [390, 1280] as const;

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function ligarNoLaboratorio(page: Page) {
  await page.context().addCookies([{ name: "vn_lab_deteccao", value: "1", url: new URL(page.url()).origin }]);
}
const passo = (page: Page) => page.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=comodidades`, { waitUntil: "domcontentloaded" });

test.describe("T432 — Detecção-A: a tela das sugestões das fotos", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Fotos ${sufixo}`);
    // Galeria com caminhos no formato do envio de hoje (dono/uuid.webp), que o item de nível aceita.
    for (let i = 0; i < 4; i++) {
      const c = `${ids.dono}/${randomUUID()}.webp`;
      const { error } = await adm().storage.from("property-photos").upload(c, pngDeTeste(i), { contentType: "image/png", upsert: true });
      if (error) throw error;
      caminhos.push(c);
    }
    // Endereço https (a regra do editor só guarda https na pasta do dono; o Supabase local é http) — o mesmo da
    // fixture criarImovelPronto. O rascunho leva as mesmas fotos: o autosave do cadastro regrava a galeria a partir dele.
    const urls = caminhos.map((c) => `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${c}`);
    await adm().from("property_photos").delete().eq("property_id", ids.imovel);
    const { error } = await adm()
      .from("property_photos")
      .insert(urls.map((url, i) => ({ property_id: ids.imovel, url, sort_order: i })));
    if (error) throw error;
    const { error: eRasc } = await adm()
      .from("properties")
      .update({ draft_data: { title: `Studio Fotos ${sufixo}`, city: "Uberlândia", photos: urls.map((url) => ({ url })), amenityKeys: {} } })
      .eq("id", ids.imovel);
    if (eRasc) throw eRasc;
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. desligada: nada da detecção aparece", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await passo(page);
    await expect(page.getByTestId("nivel-cadastro-agora")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("deteccao-fotos")).toHaveCount(0);
    await expect(page.getByTestId("deteccao-falta")).toHaveCount(0);
    await expect(page.locator("[data-detectada]")).toHaveCount(0);
    await page.context().close();
  });

  for (const w of LARGURAS) {
    test(`2. a ${w} px: sugestão com "Confirmar"/"Não é isso", comodidade tracejada, detecção no topo e uma cobrança só`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await ligarNoLaboratorio(page);
      await largura(page, w);
      await passo(page);
      const bloco = page.getByTestId("deteccao-fotos");
      await expect(bloco.getByTestId("deteccao-sugestao-maquina_lavar")).toBeVisible({ timeout: 30_000 });
      await expect(bloco.locator("h3")).toHaveText("Encontramos isto numa foto sua");
      await expect(page.getByTestId("deteccao-confirmar-maquina_lavar")).toHaveText("Confirmar");
      await expect(page.getByTestId("deteccao-descartar-maquina_lavar")).toHaveText("Não é isso");
      const chip = page.locator('[data-comodidade="maquina_lavar"]').first();
      await expect(chip).toHaveAttribute("data-detectada", "1");
      await expect(chip).toHaveAttribute("aria-pressed", "false");
      await expect(chip.getByTestId("comodidade-confirme-maquina_lavar")).toHaveText("Confirme");
      expect(await chip.evaluate((el) => getComputedStyle(el).borderStyle)).toBe("dashed");
      // E141: sem o "Falta foto de" no topo — a cobrança das fotos é uma só, no bloco do nível (opcional).
      // E142: a detecção vem antes da grade de comodidades.
      await expect(page.getByTestId("deteccao-falta")).toHaveCount(0);
      await expect(page.getByTestId("nivel-cadastro-falta")).toBeVisible();
      const [b, g] = await Promise.all([bloco.boundingBox(), page.getByTestId("etapa-encontramos").boundingBox()]);
      expect(b!.y).toBeLessThan(g!.y);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `tests/laboratorio/saida/t432-deteccao-topo-${w}.png` });
      await bloco.scrollIntoViewIfNeeded();
      await bloco.screenshot({ path: `tests/laboratorio/saida/t432-deteccao-bloco-${w}.png` });
      await page.context().close();
    });
  }

  test("3. 'Confirmar' na comodidade: fica marcada e deixa de ser tracejada", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await ligarNoLaboratorio(page);
    await largura(page, 1280);
    await passo(page);
    await page.getByTestId("deteccao-confirmar-maquina_lavar").click({ timeout: 30_000 });
    const chip = page.locator('[data-comodidade="maquina_lavar"]').first();
    await expect(chip).toHaveAttribute("aria-pressed", "true", { timeout: 20_000 });
    await expect(chip).not.toHaveAttribute("data-detectada", "1");
    await page.context().close();
  });
});
