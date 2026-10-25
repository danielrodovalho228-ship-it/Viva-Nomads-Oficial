import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T462 — ADMIN-2: fusões sem quebrar links. Só no laboratório, com a sessão de admin em duas etapas (authFile).
   1. Rotas antigas: /admin/fotografos → Parceiros (Fotógrafos); /admin/avaliacoes → Central (Avaliações contestadas);
      /admin/emails-teste → Dados de teste (E-mails); /admin/agentes#aprovacoes → aba Aprovações.
   2. Parceiros (390 e 1280): abas Todos | Fotógrafos | Outros, e Todos = Fotógrafos + Outros. Prints.
*/
const nova = async (browser: Browser, width: number) =>
  (await browser.newContext({ storageState: authFile("admin"), viewport: { width, height: width === 390 ? 844 : 900 } })).newPage();
const SAIDA = "tests/laboratorio/saida";

test.describe("T462 — ADMIN-2: fusões sem quebrar links", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin em duas etapas).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test("1. as rotas antigas levam ao lugar novo", async ({ browser }) => {
    const page = await nova(browser, 1280);
    await page.goto("/admin/fotografos", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/parceiros\?tipo=fotografo$/, { timeout: 30_000 });
    await expect(page.getByTestId("admin-parceiros-tipo-fotografo")).toHaveAttribute("aria-current", "page");

    await page.goto("/admin/avaliacoes", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/pendencias\?filtro=avaliacoes_contestadas$/, { timeout: 30_000 });
    await expect(page.getByTestId("central-pendencias")).toBeVisible();

    await page.goto("/admin/emails-teste", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/admin\/dados-de-teste\?aba=emails$/, { timeout: 30_000 });
    await expect(page.getByTestId("dados-teste-aba-emails")).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("emails-teste")).toBeVisible();
    await page.screenshot({ path: `${SAIDA}/t462-dados-teste-emails-1280.png` });

    await page.goto("/admin/agentes#aprovacoes", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("aba-aprovacoes")).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    await expect(page.getByTestId("secao-aprovacoes")).toBeVisible();
    await page.goto("/admin/agentes?aba=aprovacoes", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("aba-aprovacoes")).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    await page.screenshot({ path: `${SAIDA}/t462-agentes-aprovacoes-1280.png` });
    await page.context().close();
  });

  for (const w of [390, 1280] as const) {
    test(`2. a ${w} px: Parceiros com Todos | Fotógrafos | Outros e Todos = soma`, async ({ browser }) => {
      const page = await nova(browser, w);
      await page.goto("/admin/parceiros", { waitUntil: "domcontentloaded" });
      const tipos = page.getByTestId("admin-parceiros-tipos");
      await expect(tipos.locator("a")).toHaveCount(3, { timeout: 30_000 });
      const n = async (t: string) => Number(await page.getByTestId(`admin-parceiros-tipo-${t}`).getAttribute("data-n"));
      expect(await n("todos")).toBe((await n("fotografo")) + (await n("outros")));
      await expect(page.getByTestId("admin-parceiros-tipo-todos")).toHaveAttribute("aria-current", "page");
      await page.screenshot({ path: `${SAIDA}/t462-parceiros-${w}.png` });
      await page.getByTestId("admin-parceiros-tipo-fotografo").click();
      await expect(page).toHaveURL(/tipo=fotografo/, { timeout: 30_000 });
      await page.screenshot({ path: `${SAIDA}/t462-parceiros-fotografos-${w}.png` });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }
});
