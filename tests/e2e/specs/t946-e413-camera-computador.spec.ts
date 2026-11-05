import { test, expect, chromium, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, definirPlano, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { fotografarEUsar, quadroFalso } from "../fixtures/camera";

/*
  T946 — E413 (#2046): no COMPUTADOR, a prova do nível também sai pela câmera do próprio computador (foto ao vivo, com o
  mesmo token de uso único) — antes, só o QR para o celular. Pela tela real, num computador (1280 px, sem toque):
   1. com câmera (Chromium com câmera falsa): o painel "Fotografar pelo celular" traz, embaixo do QR, "Ou fotografe agora
      com a câmera deste computador, no imóvel." e o botão "Usar a câmera deste computador"; a câmera NÃO abre sozinha;
      o botão abre a câmera ao vivo, a foto é feita e o item conta com origem câmera;
   2. sem câmera (a lista de aparelhos sem "videoinput"): só o QR — nem o texto nem o botão aparecem;
   3. a galeria nunca é oferecida no caminho da câmera do computador (nenhum input de arquivo).
  É um caminho só do computador (no celular a câmera abre direto, t397), por isso só 1280.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t946.${sufixo}@lab.vivanomads.test`, nome: "Cami Computador", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const BASE_URL = (process.env.TESTES_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ITEM = "sono_dois_jogos";

async function computador(comCamera: boolean): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
    args: comCamera ? ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${quadroFalso()}`] : [],
  });
  const ctx = await browser.newContext({ baseURL: BASE_URL, viewport: { width: 1280, height: 900 }, hasTouch: false, isMobile: false, extraHTTPHeaders: { "x-vn-origem": "e2e" } });
  if (!comCamera) {
    // Computador sem câmera: a lista de aparelhos não tem "videoinput".
    await ctx.addInitScript(() => {
      if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, "enumerateDevices", { value: async () => [] });
    });
  }
  const page = await ctx.newPage();
  await entrarNaPagina(page, dono.email, senha);
  return { browser, page };
}
async function abrirPainelDoItem(page: Page) {
  await page.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("nivel-itens")).toBeVisible({ timeout: 30_000 });
  const botao = page.getByTestId(`nivel-foto-${ITEM}-botao`);
  await expect(botao).toHaveText("Fotografar pelo celular");
  await botao.click();
  const painel = page.getByTestId(`prova-celular-${ITEM}`);
  await expect(painel.getByTestId("prova-celular-qr")).toBeVisible({ timeout: 20_000 });
  return painel;
}

test.describe("T946 — E413: prova do nível pela câmera do próprio computador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "o computador com câmera sai dentro do teste"));

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await definirPlano(ids.dono, "pro");
    ids.imovel = await criarImovelPronto(ids.dono, `Studio Webcam ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  test("sem câmera: só o QR, sem o botão da câmera do computador", async () => {
    const { browser, page } = await computador(false);
    try {
      const painel = await abrirPainelDoItem(page);
      await page.waitForTimeout(1_500); // a lista de aparelhos é lida depois de abrir
      await expect(painel.getByTestId("prova-celular-link")).toHaveText("Continuar no celular");
      await expect(page.getByTestId("prova-camera-computador")).toHaveCount(0);
      await expect(page.getByTestId("prova-camera-computador-botao")).toHaveCount(0);
      await expect(page.getByTestId("camera-prova")).toHaveCount(0);
    } finally {
      await browser.close();
    }
  });

  test("com câmera: o texto e o botão embaixo do QR; o botão abre a câmera ao vivo e o item conta pela câmera", async () => {
    const { browser, page } = await computador(true);
    try {
      await abrirPainelDoItem(page);
      const bloco = page.getByTestId("prova-camera-computador");
      await expect(bloco).toBeVisible({ timeout: 15_000 });
      await expect(bloco).toContainText("Ou fotografe agora com a câmera deste computador, no imóvel.");
      const botao = page.getByTestId("prova-camera-computador-botao");
      await expect(botao).toHaveText("Usar a câmera deste computador");
      // A câmera não abre sozinha.
      await expect(page.getByTestId("camera-prova")).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: "tests/laboratorio/saida/t946-qr-com-camera-1280.png", fullPage: true });

      await botao.click();
      await expect(page.getByTestId("camera-prova")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId("camera-prova").locator('input[type="file"]')).toHaveCount(0);
      await fotografarEUsar(page);
      await expect(page.getByTestId(`nivel-msg-${ITEM}`)).toContainText("recebida", { timeout: 30_000 });
      await expect(page.getByTestId(`nivel-item-${ITEM}`)).toHaveAttribute("data-origem", "camera", { timeout: 20_000 });
      const { data } = await adm().from("nivel_itens").select("foto_origem, foto_path").eq("property_id", ids.imovel!).eq("chave", ITEM).maybeSingle();
      expect((data as { foto_origem?: string } | null)?.foto_origem).toBe("camera");
      expect((data as { foto_path?: string } | null)?.foto_path).toBeTruthy();
    } finally {
      await browser.close();
    }
  });
});
