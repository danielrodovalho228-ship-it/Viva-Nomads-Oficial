import { test, expect } from "@playwright/test";
import sharp from "sharp";

/*
  T1665 — E398 (cosmético D-ISO8, reprova isolada de 01/11): o painel de imagem do /auth apareceu numa captura como uma
  área cinza simples. Enquanto a foto não chega (servidor frio: quase 4 s medidos no laboratório), o painel mostrava um
  cinza-claro liso, com o texto branco por cima.
  Com a foto segurada de propósito, a 1280 px:
   1. o painel não é uma cor lisa: mostra o borrão da própria foto (a variação de cor na área sem texto prova);
   2. quando a foto chega, o painel assenta nela e o borrão sai.
*/
const FOTO = /\/_next\/image\?.*auth-lateral|\/media\/auth-lateral\.webp/;
/** Faixa do painel sem logo nem texto (o painel ocupa a metade esquerda; os véus ficam no topo esquerdo e na base). */
const AREA_SEM_TEXTO = { x: 60, y: 220, width: 520, height: 300 };

test.describe("T1665 — E398: o painel de imagem da porta não fica cinza liso enquanto a foto carrega", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("com a foto ainda a caminho, o painel mostra o borrão da foto; depois assenta na foto", async ({ page }) => {
    let soltar: () => void = () => {};
    const segurada = new Promise<void>((r) => (soltar = r));
    await page.route(FOTO, async (rota) => {
      await segurada;
      await rota.continue();
    });
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    const painel = page.locator("[data-foto-estado]").first();
    await expect(painel).toHaveAttribute("data-foto-estado", "carregando");
    await expect(page.getByTestId("porta-titulo-foto")).toBeVisible();
    // A animação de "respirar" muda a opacidade: espera um quadro estável antes de medir.
    await page.waitForTimeout(300);
    const carregando = await page.screenshot({ clip: AREA_SEM_TEXTO, path: "tests/laboratorio/saida/t1665-porta-carregando-1280.png" });
    const { channels } = await sharp(carregando).stats();
    const variacao = Math.max(...channels.slice(0, 3).map((c) => c.stdev));
    const brilho = channels.slice(0, 3).reduce((s, c) => s + c.mean, 0) / 3;
    // Cor lisa = variação perto de zero. O borrão de uma foto varia de um canto ao outro.
    expect(variacao, `variação de cor na área sem texto (brilho médio ${Math.round(brilho)})`).toBeGreaterThan(6);
    expect(await painel.locator("img").evaluate((img) => getComputedStyle(img).backgroundImage), "o borrão é da própria foto").toContain("image/webp");

    soltar();
    await expect(painel).toHaveAttribute("data-foto-estado", "pronta", { timeout: 30_000 });
    const img = painel.locator("img");
    expect(await img.evaluate((e: HTMLImageElement) => e.naturalWidth)).toBeGreaterThan(0);
    expect(await img.evaluate((e) => getComputedStyle(e).backgroundImage), "com a foto carregada, o borrão sai").toBe("none");
    await page.screenshot({ path: "tests/laboratorio/saida/t1665-porta-pronta-1280.png" });
  });
});
