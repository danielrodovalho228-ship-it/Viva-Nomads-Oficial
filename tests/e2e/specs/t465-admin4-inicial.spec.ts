import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T465 — ADMIN-4: a inicial enxuta do /admin. Só no laboratório, com a sessão de admin já em duas etapas (authFile).
   1. (390 e 1280) 4 números, cada um com link; "Precisa da sua atenção" com no máximo 5 itens, sem duplicata, e
      "Ver todas (N)"; "Atividade recente"; a linha de saúde; o rodapé das contas de teste. Nada de Receita, Crescimento,
      Áreas do admin nem "decisões" na inicial.
   2. Cada número da inicial = o número da página de destino (a mesma função, "N reais · M de teste").
   3. "Funil e indicadores" (/admin/funil) tem os indicadores do período, e nenhuma base "N de 0".
   4. Pendências abre com as decisões; "Ver todas (N)" leva a ela com o mesmo N.
*/
const SAIDA = "tests/laboratorio/saida";
const DESTINO = { estadias: "numero-fonte-estadias", anuncios: "numero-fonte-anuncios", pedidos: "numero-fonte-pedidos", chamados: "numero-fonte-chamados" } as const;

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

test.describe("T465 — ADMIN-4: inicial enxuta do admin", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin em duas etapas).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  const novaPagina = async (browser: import("@playwright/test").Browser, width: number) =>
    (await browser.newContext({ storageState: authFile("admin"), viewport: { width, height: width === 390 ? 844 : 900 } })).newPage();

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: números, atenção sem duplicata, atividade, saúde e rodapé`, async ({ browser }) => {
      const page = await novaPagina(browser, w);
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main h1").first()).toHaveText("Visão geral", { timeout: 30_000 });
      await expect(page).toHaveTitle("Visão geral — Admin · Viva Nomads");
      const numeros = page.getByTestId("admin-numeros");
      await expect(numeros.locator("a")).toHaveCount(4);
      for (const [k, rotulo] of [["estadias", "Estadias ativas"], ["anuncios", "Anúncios publicados"], ["pedidos", "Pedidos de moradia no ar"], ["chamados", "Chamados abertos"]] as const) {
        await expect(page.getByTestId(`admin-numero-${k}`)).toContainText(rotulo);
      }
      const itens = page.getByTestId("admin-atencao-item");
      const n = await itens.count();
      expect(n).toBeLessThanOrEqual(5);
      const chaves = await itens.evaluateAll((els) => els.map((e) => e.querySelector("[data-href]")?.getAttribute("data-href")));
      expect(new Set(chaves).size, "nenhum destino repetido na atenção").toBe(chaves.length);
      await expect(page.getByTestId("admin-atencao-todas")).toHaveText(/^Ver todas \(\d+\)/);
      await expect(page.getByTestId("admin-atividade")).toBeVisible();
      await expect(page.getByTestId("admin-saude")).toHaveText(/^(Tudo funcionando|Há alertas em “Precisa da sua atenção”\.)$/);
      await expect(page.getByTestId("admin-rodape")).toHaveText("Contas de teste não entram nestas contagens.");
      const corpo = page.locator("main");
      for (const fora of ["Áreas do admin", "Receita", "Crescimento", "Liquidez", "decisões"]) await expect(corpo, fora).not.toContainText(fora);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t465-inicial-${w}.png`, fullPage: true });
      await page.context().close();
    });
  }

  test("2. cada número da inicial = o da página de destino", async ({ browser }) => {
    const page = await novaPagina(browser, 1280);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("admin-numeros")).toBeVisible({ timeout: 30_000 });
    const lidos: Record<string, { href: string; reais: string; teste: string }> = {};
    for (const k of Object.keys(DESTINO) as (keyof typeof DESTINO)[]) {
      const a = page.getByTestId(`admin-numero-${k}`);
      lidos[k] = { href: (await a.getAttribute("href"))!, reais: (await a.getAttribute("data-reais"))!, teste: (await a.getAttribute("data-teste"))! };
      expect(lidos[k].reais, `${k}: número lido`).toMatch(/^\d+$/);
    }
    for (const k of Object.keys(DESTINO) as (keyof typeof DESTINO)[]) {
      await page.goto(lidos[k].href, { waitUntil: "domcontentloaded" });
      const fonte = page.getByTestId(DESTINO[k]);
      await expect(fonte, `${k} na página de destino`).toHaveAttribute("data-reais", lidos[k].reais, { timeout: 30_000 });
      await expect(fonte).toHaveAttribute("data-teste", lidos[k].teste);
      await expect(fonte).toContainText(/\d+ (real|reais)/);
      if (k === "estadias") await page.screenshot({ path: `${SAIDA}/t465-destino-estadias-1280.png` });
    }
    await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("numero-fonte-usuarios")).toContainText(/Usuários: \d+ (real|reais)/, { timeout: 30_000 });
    await page.context().close();
  });

  for (const w of [390, 1280] as const) {
    test(`3–4. a ${w} px: Funil e indicadores sem "N de 0"; "Ver todas" = Pendências`, async ({ browser }) => {
      const page = await novaPagina(browser, w);
      await page.goto("/admin/funil", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main h1").first()).toHaveText("Funil e indicadores", { timeout: 30_000 });
      await expect(page.getByTestId("funil-indicadores")).toBeVisible();
      const texto = await page.locator("main").innerText();
      expect(texto).not.toMatch(/\b\d+ de 0\b/);
      expect(texto).not.toMatch(/NaN|Infinity/);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t465-funil-${w}.png` });

      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      const todas = page.getByTestId("admin-atencao-todas");
      const total = await todas.getAttribute("data-n");
      await todas.click();
      await expect(page).toHaveURL(/\/admin\/pendencias$/, { timeout: 30_000 });
      await expect(page.getByTestId("admin-decisoes")).toHaveAttribute("data-total", total!, { timeout: 30_000 });
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t465-pendencias-${w}.png` });
      await page.context().close();
    });
  }
});
