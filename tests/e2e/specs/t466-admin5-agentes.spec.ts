import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T466 — ADMIN-5: a Central de Agentes nos tokens do admin. Só no laboratório, com a sessão de admin em duas etapas.
   1. (390 e 1280) fundo claro do admin (sem o tema escuro), <h1> e <title> = rótulo da barra, sem rolagem lateral;
      a página responde em menos de 2 s (tempo de servidor do documento).
   2. O chat e as atas NÃO vêm na abertura: só quando a aba abre (Conversar lê o agente escolhido; Sala lê as atas),
      com "ver anteriores" quando há mais.
*/
const SAIDA = "tests/laboratorio/saida";

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test.describe("T466 — ADMIN-5: Central de Agentes", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin em duas etapas).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  const novaPagina = async (browser: import("@playwright/test").Browser, width: number) =>
    (await browser.newContext({ storageState: authFile("admin"), viewport: { width, height: width === 390 ? 844 : 900 } })).newPage();

  for (const w of [390, 1280] as const) {
    test(`1–2. a ${w} px: tema do admin, abre em < 2 s; chat e atas só na aba`, async ({ browser }) => {
      const page = await novaPagina(browser, w);
      const leiturasDoChat: string[] = [];
      page.on("request", (r) => {
        // O chat e as atas são lidos por GET em /api/admin/agentes/conversas, só quando a aba abre.
        if (r.url().includes("/api/admin/agentes/conversas")) leiturasDoChat.push(r.url());
      });
      // Aquecimento (a primeira carga compila a rota no servidor do laboratório), depois a medida.
      await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
      await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
      const ttfb = await page.evaluate(() => {
        const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
        return n.responseStart - n.requestStart;
      });
      expect(ttfb, "tempo de servidor do documento").toBeLessThan(2_000);

      const central = page.getByTestId("central-agentes");
      await expect(central).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("main h1").first()).toHaveText("Central de Agentes");
      await expect(page).toHaveTitle("Central de Agentes — Admin · Viva Nomads");
      // Fundo claro: nenhum ancestral da Central (nem ela) com o azul-escuro do QG.
      const fundos = await central.evaluate((el) => {
        const cores: string[] = [];
        for (let e: Element | null = el; e; e = e.parentElement) cores.push(getComputedStyle(e).backgroundColor);
        return cores;
      });
      expect(fundos).not.toContain("rgb(5, 10, 24)");
      // O primeiro fundo não transparente a partir da Central (o main herda o do layout).
      const luz = await central.evaluate((el) => {
        for (let e: Element | null = el; e; e = e.parentElement) {
          const [r, g, b, a] = (getComputedStyle(e).backgroundColor.match(/[\d.]+/g) ?? []).map(Number);
          if (r !== undefined && (a === undefined || a > 0)) return (r + g + b) / 3;
        }
        return 255;
      });
      expect(luz, "fundo claro").toBeGreaterThan(200);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t466-equipe-${w}.png` });

      // O chat e as atas não vêm na abertura: as abas os leem quando abrem.
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      const naAbertura = leiturasDoChat.length;
      expect(naAbertura, "nenhuma leitura do chat/atas na aba Equipe").toBe(0);
      expect(await page.content(), "nenhuma mensagem do chat no HTML da abertura").not.toContain('data-testid="bolha-agente"');

      await page.getByRole("tab", { name: "Conversar" }).click();
      await expect(page.getByTestId("chat-agente")).toBeVisible();
      await expect(page.getByTestId("chat-carregando")).toHaveCount(0, { timeout: 20_000 });
      expect(leiturasDoChat.length, "a aba Conversar lê o chat").toBeGreaterThan(naAbertura);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t466-conversar-${w}.png` });

      const antes = leiturasDoChat.length;
      await page.getByRole("tab", { name: "Sala de reunião" }).click();
      await expect(page.getByTestId("atas-carregando")).toHaveCount(0, { timeout: 20_000 });
      expect(leiturasDoChat.length, "a Sala lê as atas").toBeGreaterThan(antes);
      await expect(page.getByText(/Nenhuma reunião ainda|Atas anteriores/).first()).toBeVisible();
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t466-sala-${w}.png`, fullPage: true });
      await page.context().close();
    });
  }
});
