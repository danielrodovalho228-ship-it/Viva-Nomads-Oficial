import { test, expect, type Locator, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/*
  T271 — regressão visual do admin no Prompt 46 (D5): mesma escala, cores e raios do sistema, decisões primeiro e
  números em lista com divisor fino. Desktop (1280): /admin, /admin/financeiro, /admin/documentos, /admin/atendimento,
  /admin/parceiros, /admin/contratos (lista e [id]) e /admin/usuarios. Celular (390): só /admin e as filas
  (documentos, atendimento) — o admin é web, fora do app.
  O que muda de uma base para outra (números, datas, nomes, linhas das tabelas) vai mascarado: a imagem guarda a
  anatomia da tela (título, decisões, herói, listas, filtros, cabeçalhos), não os dados.
*/
const DESKTOP = ["/admin", "/admin/financeiro", "/admin/documentos", "/admin/atendimento", "/admin/parceiros", "/admin/contratos", "CONTRATO", "/admin/usuarios"];
const CELULAR = ["/admin", "/admin/documentos", "/admin/atendimento"];
const nome = (rota: string) => (rota === "CONTRATO" ? "admin-contrato-id" : rota.replace(/^\//, "").replace(/\W+/g, "-"));

function mascaras(page: Page): Locator[] {
  return [
    page.locator("main [data-valor], main time, main td, main [data-decisao], main [data-precisa]"),
    page.locator("main ul li, main ol li, main dl dd"),
    page.locator('main [data-testid="admin-decisoes"] h1, main [data-testid="cartao-backup"], main [data-testid="aviso-atendimento-admin"]'),
    page.locator("main img, main canvas, main svg image, main textarea, main input, main select"),
    page.locator('[data-visual="muda"], [aria-label$="aguardando"], nav [aria-label$="não lidas"], nav [aria-label$="novos"]'),
  ];
}

test.describe("T271 — admin: regressão visual (Prompt 46)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.skip(!hasAccount("admin"), "conta de admin do laboratório não configurada");
  test.use({ storageState: authFile("admin") });

  for (const [largura, rotas] of [[1280, DESKTOP], [390, CELULAR]] as const) {
    for (const rota of rotas) {
      test(`${largura}px — ${rota === "CONTRATO" ? "/admin/contratos/[id]" : rota}`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
        let alvo = rota;
        if (rota === "CONTRATO") {
          await page.goto("/admin/contratos", { waitUntil: "domcontentloaded" });
          const primeiro = page.locator('main a[href^="/admin/contratos/"]:not([href*="encerramentos"])').first();
          test.skip((await primeiro.count()) === 0, "nenhum contrato no laboratório");
          alvo = (await primeiro.getAttribute("href"))!;
        }
        await page.goto(alvo, { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 25_000 });
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
        await expect(page).toHaveScreenshot(`t271-${nome(rota)}-${largura}.png`, { mask: mascaras(page), maxDiffPixelRatio: 0.03, animations: "disabled" });
      });
    }
  }
});
