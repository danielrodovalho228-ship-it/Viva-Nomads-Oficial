import { test, expect } from "@playwright/test";
import { NO_LABORATORIO } from "../fixtures/laboratorio";
import { authFile } from "../fixtures/auth";
import { BARRA_ADMIN } from "../../../src/config/menu-admin";

/*
  T467 — ADMIN-6: as rotas da barra do admin. Só no laboratório, com a sessão de admin em duas etapas.
   1. Toda folha da barra: <title> = "Rótulo — Admin · Viva Nomads", o <h1> = o rótulo da barra, e o item da barra
      marcado como página atual.
   2. Retenção: "Simulado" só nos itens que não apagam de verdade, cada um com o porquê em uma linha.
   3. Qualidade: os sinais sem medição dizem o que falta gravar para medir (nada de "sem medição" solto).
*/
const SAIDA = "tests/laboratorio/saida";
const FOLHAS = BARRA_ADMIN.flatMap((i) => (i.filhos ? i.filhos : [i])).filter((i): i is typeof i & { href: string } => !!i.href);

test.describe("T467 — ADMIN-6: rotas da barra do admin", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (sessão de admin em duas etapas).");
  test.describe.configure({ mode: "serial", timeout: 300_000 });
  test.use({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });

  test("1. título, h1 e rótulo da barra batem em todas as folhas", async ({ page }) => {
    expect(FOLHAS.length).toBeGreaterThanOrEqual(27);
    for (const f of FOLHAS) {
      await page.goto(f.href, { waitUntil: "domcontentloaded" });
      await expect(page.locator("main h1").first(), f.href).toHaveText(f.rotulo, { timeout: 30_000 });
      await expect(page, f.href).toHaveTitle(`${f.rotulo} — Admin · Viva Nomads`);
      await expect(page.getByTestId("menu-cascata").filter({ visible: true }).locator(`a[href="${f.href}"]`), f.href).toHaveAttribute("aria-current", "page");
    }
  });

  test("2. Retenção: 'Simulado' só onde é simulado, com o porquê", async ({ page }) => {
    await page.goto("/admin/retencao", { waitUntil: "domcontentloaded" });
    const modos = page.getByTestId("inventario-modo");
    await expect(modos.first()).toBeVisible({ timeout: 30_000 });
    for (const m of await modos.all()) {
      const real = (await m.getAttribute("data-real")) === "1";
      if (real) await expect(m).toHaveText("Apaga de verdade");
      else await expect(m).toContainText(/^Simulado\s*\S/);
    }
    await page.getByTestId("retencao-inventario").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t467-retencao-1280.png`, fullPage: true });
  });

  test("3. Qualidade: sem medição, a linha diz o que falta gravar", async ({ page }) => {
    await page.goto("/admin/qualidade", { waitUntil: "domcontentloaded" });
    const painel = page.getByTestId("qualidade-quebradores");
    await expect(painel).toBeVisible({ timeout: 30_000 });
    await expect(painel).not.toContainText("sem medição");
    for (const chave of ["abandono_valores", "contrato_sem_assinatura"]) {
      await expect(painel.locator(`[data-chave="${chave}"]`).getByTestId("quebrador-falta"), chave).toContainText(/^Para medir, falta gravar /);
    }
    await painel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t467-qualidade-1280.png` });
  });
});
