import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T342 — galeria do imóvel (65-B, alteração da Pista A): o vídeo é o 2º item, logo depois da capa. A 390 (carrossel) e
  1280 (mosaico): o item 0 é a capa (foto), o item 1 é o vídeo e abre a janela do vídeo; o item 2 abre o lightbox na
  2ª foto ("2 / 8"). Sem vídeo, nenhum item de vídeo. Laboratório (cria e apaga o imóvel).
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t342.${sufixo}@lab.vivanomads.test`, nome: "Dora Dona", role: "owner" as const };
const ids: Record<string, string> = {};

test.describe("T342 — vídeo como 2º item da galeria", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.comVideo = await criarImovelPronto(ids.dono, `Galeria com vídeo t342 ${sufixo}`, { ativo: true });
    ids.semVideo = await criarImovelPronto(ids.dono, `Galeria sem vídeo t342 ${sufixo}`, { ativo: true });
    const { error } = await adm().from("properties").update({ video_url: "https://youtu.be/dQw4w9WgXcQ" }).eq("id", ids.comVideo);
    if (error) throw error;
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280]) {
    test(`a ${w} px: capa, vídeo, fotos — e o lightbox abre a foto certa`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto(`/imoveis/${ids.comVideo}`, { waitUntil: "domcontentloaded" });
      const galeria = page.getByTestId(w === 390 ? "galeria-celular" : "galeria-mosaico");
      await expect(galeria.getByTestId("galeria-tile-1")).toHaveAttribute("data-item", "video", { timeout: 30_000 });
      await expect(galeria.getByTestId("galeria-tile-0")).not.toHaveAttribute("data-item", "video");
      await expect(galeria.locator('[data-item="video"]')).toHaveCount(1);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
      await page.screenshot({ path: `tests/laboratorio/saida/t342-galeria-${w}.png` });

      await galeria.getByTestId("galeria-tile-1").click();
      await expect(page.getByTestId("video-modal")).toBeVisible({ timeout: 15_000 });
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("video-modal")).toHaveCount(0, { timeout: 10_000 });

      await galeria.getByTestId("galeria-tile-2").click();
      await expect(page.getByTestId("galeria-contador")).toHaveText("2 / 8", { timeout: 15_000 });
      await page.keyboard.press("Escape");

      await page.goto(`/imoveis/${ids.semVideo}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId(w === 390 ? "galeria-celular" : "galeria-mosaico").getByTestId("galeria-tile-0")).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-item="video"]')).toHaveCount(0);
    });
  }
});
