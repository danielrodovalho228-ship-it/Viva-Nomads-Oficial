import { test, expect, type Browser } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";

/*
  T463 — ADMIN-3: /admin/sistema ("Chaves e integrações"). Só no laboratório, com a sessão de admin em duas etapas.
  SÓ LEITURA: o teste não liga nem desliga chave nenhuma (abre a confirmação do SMS e CANCELA).
   1. A página (390 e 1280): chaves da plataforma, a lista das chaves de ambiente (sem botão) e a saúde; título pela barra.
   2. Pedidos e Parceiros: sem as chaves, só o aviso de uma linha com o link para Sistema.
*/
const nova = async (browser: Browser, width: number) =>
  (await browser.newContext({ storageState: authFile("admin"), viewport: { width, height: width === 390 ? 844 : 900 } })).newPage();
const SAIDA = "tests/laboratorio/saida";

test.describe("T463 — ADMIN-3: Chaves e integrações", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin em duas etapas).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: chaves da plataforma, chaves de ambiente (só leitura) e saúde`, async ({ browser }) => {
      const page = await nova(browser, w);
      await page.goto("/admin/sistema", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("admin-sistema")).toBeVisible({ timeout: 30_000 });
      await expect(page).toHaveTitle("Chaves e integrações — Admin · Viva Nomads");
      await expect(page.locator("main h1").first()).toHaveText("Chaves e integrações");
      await expect(page.getByTestId("chave-sms")).toBeVisible();
      await expect(page.getByTestId("chave-parceiro-geral")).toBeVisible();
      const ambiente = page.getByTestId("chaves-ambiente");
      await expect(ambiente.getByTestId("chave-ambiente")).toHaveCount(17);
      await expect(ambiente.locator("button, input, form")).toHaveCount(0);
      // Abre a confirmação do SMS e cancela: nada muda.
      await page.getByTestId("chave-sms-trocar").click();
      await expect(page.getByTestId("chave-sms-confirmacao")).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t463-sistema-confirmacao-${w}.png` });
      await page.getByTestId("chave-sms-confirmacao").getByRole("button", { name: "Cancelar" }).click();
      await expect(page.getByTestId("chave-sms-confirmacao")).toHaveCount(0);
      await page.screenshot({ path: `${SAIDA}/t463-sistema-${w}.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }

  test("2. Pedidos e Parceiros: sem as chaves, só o aviso com o link para Sistema", async ({ browser }) => {
    const page = await nova(browser, 1280);
    await page.goto("/admin/pedidos", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("aviso-chave-sms")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("chave-sms")).toHaveCount(0);
    await expect(page.getByTestId("aviso-chave-sms").getByRole("link", { name: "alterar em Sistema" })).toHaveAttribute("href", "/admin/sistema#chaves");
    await page.goto("/admin/parceiros", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("aviso-chaves-parceiros")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("parceiro-geral-admin")).toHaveCount(0);
    await page.getByTestId("aviso-chaves-parceiros").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t463-parceiros-aviso-1280.png` });
    await page.context().close();
  });
});
