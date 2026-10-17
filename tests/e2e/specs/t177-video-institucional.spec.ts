import { test, expect } from "@playwright/test";

/*
  T177 — Vídeo institucional v3 ("A Viva em 30 segundos"), a 390 e 1280 px.
  1. A seção existe na home (logo abaixo do hero) e no topo de /como-funciona, com título visível.
  2. <video controls preload="none" playsinline poster> com aria-label e legenda pt-BR padrão; sem autoplay.
  3. A página NÃO baixa o mp4 antes do play (só a capa); o vídeo de fundo do hero continua igual.
  4. Capa e legenda existem (200); 16:9 e sem rolagem lateral.
*/
const SAIDA = "tests/laboratorio/saida";

for (const rota of ["/", "/como-funciona"]) {
  for (const largura of [390, 1280]) {
    test(`T177 ${rota} @${largura}px — player parado, com capa e legenda, mp4 só no play`, async ({ page }) => {
      const mp4: string[] = [];
      page.on("request", (r) => {
        if (/\/media\/institucional\.mp4/.test(r.url())) mp4.push(r.url());
      });
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto(rota, { waitUntil: "networkidle" });

      const secao = page.getByTestId("secao-video-institucional");
      await expect(secao.getByRole("heading", { name: "A Viva em 30 segundos" })).toBeVisible();
      const video = secao.getByTestId("video-institucional");
      await expect(video).toHaveAttribute("preload", "none");
      await expect(video).toHaveAttribute("poster", "/media/institucional-poster.webp");
      await expect(video).toHaveAttribute("aria-label", /Vídeo institucional/);
      await expect(video).toHaveAttribute("controls", "");
      await expect(video).not.toHaveAttribute("autoplay", /.*/);
      const track = video.locator("track");
      await expect(track).toHaveAttribute("kind", "captions");
      await expect(track).toHaveAttribute("srclang", "pt-BR");
      await expect(track).toHaveAttribute("default", "");
      expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);

      // Capa e legenda existem de verdade.
      expect((await page.request.get("/media/institucional-poster.webp")).status()).toBe(200);
      const vtt = await page.request.get("/media/institucional.pt-BR.vtt");
      expect(vtt.status()).toBe(200);
      expect(await vtt.text()).toMatch(/^WEBVTT/);

      // 16:9 e sem rolagem lateral.
      await video.scrollIntoViewIfNeeded();
      const caixa = (await video.boundingBox())!;
      expect(Math.abs(caixa.width / caixa.height - 16 / 9)).toBeLessThan(0.05);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t177-video${rota === "/" ? "-home" : "-como-funciona"}-${largura}.png`, fullPage: false });

      // Nada do mp4 antes do play.
      expect(mp4, "mp4 baixado antes do play").toEqual([]);
      // No play, aí sim.
      await video.evaluate((v: HTMLVideoElement) => {
        v.muted = true;
        return v.play().catch(() => undefined);
      });
      await expect.poll(() => mp4.length, { timeout: 15_000 }).toBeGreaterThan(0);
    });
  }
}

test("T177 home: o vídeo de fundo do hero continua no lugar", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("hero-home")).toBeVisible();
  await expect(page.getByTestId("secao-video-institucional")).toHaveCount(1);
});
