import { test, expect } from "@playwright/test";

/*
  T882 — E295 (perna do celular, lista-master 01/11): na home a 390 px, a caixa do vídeo "A Viva em 30 segundos"
  aparece com a capa de verdade carregada (a imagem decodifica, 1280×720 — não só o atributo poster), com o play
  verde visível e centrado, e com a moldura íntegra: borda de 2 px nos quatro lados, cantos arredondados, 16:9,
  dentro da largura da tela, sem rolagem horizontal, e sem baixar o mp4 antes do play. O desktop já foi provado
  em 31/10 (t177/t730). Captura arquivada em tests/laboratorio/capturas/e295/.
*/
const SAIDA = "tests/laboratorio/saida";

test("T882 — E295: caixa do vídeo da home íntegra a 390 px (capa, play, moldura)", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const mp4: string[] = [];
  page.on("request", (r) => {
    if (/\/media\/institucional(-540)?\.mp4/.test(r.url())) mp4.push(r.url());
  });
  await page.goto("/", { waitUntil: "networkidle" });

  const secao = page.getByTestId("secao-video-institucional");
  await expect(secao.getByRole("heading", { name: "A Viva em 30 segundos" })).toBeVisible();
  const caixa = secao.getByTestId("video-institucional-caixa");
  await caixa.scrollIntoViewIfNeeded();
  await expect(caixa).toBeVisible();
  const play = secao.getByTestId("video-institucional-play");
  await expect(play).toBeVisible();

  const m = await caixa.evaluate(async (c) => {
    const v = c.querySelector("video") as HTMLVideoElement;
    const img = new Image();
    img.src = v.poster;
    await img.decode().catch(() => undefined);
    const cs = getComputedStyle(c);
    const r = c.getBoundingClientRect();
    const bola = c.querySelector('[data-testid="video-institucional-play"] span') as HTMLElement;
    const b = bola.getBoundingClientRect();
    return {
      poster: [img.naturalWidth, img.naturalHeight],
      bordas: [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth],
      raio: parseFloat(cs.borderTopLeftRadius),
      esquerda: r.left,
      direita: r.right,
      razao: r.width / r.height,
      larguraTela: document.documentElement.clientWidth,
      rolagem: document.documentElement.scrollWidth,
      bolaDx: b.left + b.width / 2 - (r.left + r.width / 2),
      bolaDy: b.top + b.height / 2 - (r.top + r.height / 2),
      bolaLargura: b.width,
      bolaCor: getComputedStyle(bola).backgroundColor,
      pausado: v.paused,
    };
  });

  expect(m.poster, "a capa decodifica de verdade (1280×720)").toEqual([1280, 720]);
  expect(m.bordas, "moldura de 2 px nos quatro lados").toEqual(["2px", "2px", "2px", "2px"]);
  expect(m.raio, "cantos arredondados").toBeGreaterThan(0);
  expect(m.esquerda, "a caixa começa dentro da tela").toBeGreaterThanOrEqual(0);
  expect(m.direita, "a caixa termina dentro da tela").toBeLessThanOrEqual(m.larguraTela);
  expect(m.rolagem, "sem rolagem horizontal").toBeLessThanOrEqual(m.larguraTela);
  expect(Math.abs(m.razao - 16 / 9), "caixa 16:9").toBeLessThan(0.02);
  expect(Math.abs(m.bolaDx), "play centrado na horizontal").toBeLessThanOrEqual(2);
  expect(Math.abs(m.bolaDy), "play centrado na vertical").toBeLessThanOrEqual(2);
  expect(m.bolaLargura, "play grande o bastante para o toque").toBeGreaterThanOrEqual(44);
  expect(m.bolaCor, "play no verde da marca (não cinza nem transparente)").not.toMatch(/rgba\(0, 0, 0, 0\)|rgb\(1\d\d, 1\d\d, 1\d\d\)/);
  expect(m.pausado, "parado até o toque").toBe(true);
  expect(mp4, "mp4 baixado antes do play").toEqual([]);
  await secao.screenshot({ path: `${SAIDA}/t882-e295-video-home-390.png` });
  await ctx.close();
});
