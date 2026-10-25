import { test, expect } from "@playwright/test";
import { brandedNotification, emailImage } from "../../../src/lib/notifications/templates";
import { TEMPLATES } from "../../../src/lib/notifications/eventos-email";
import { imagemDoEvento } from "../../../src/lib/notifications/imagens-email";

/**
 * T206 — E-mails no modelo único, renderizados de verdade (ordem d250ea2f itens 1–3, achado ddf5d851):
 * cada evento a 390 px, no claro e no escuro, com o botão certo, o rodapé de fase de testes, sem rolagem
 * lateral. As imagens remotas são bloqueadas (sem rede); o print vai como anexo do relatório.
 * Não envia e-mail: só desenha o HTML que o notify() montaria.
 */
const SITE = "https://vivanomads.com.br";
const eventos = Object.entries(TEMPLATES);

test.describe("T206 — E-mails do modelo único a 390 px", () => {
  test("há eventos para conferir", () => {
    expect(eventos.length).toBeGreaterThanOrEqual(25);
  });

  for (const esquema of ["light", "dark"] as const) {
    test.describe(esquema === "dark" ? "modo escuro" : "modo claro", () => {
      test.use({ colorScheme: esquema, viewport: { width: 390, height: 844 } });

      for (const [evento, tpl] of eventos) {
        test(`${evento}`, async ({ page }, info) => {
          await page.route(/^https?:\/\//, (r) => r.abort());
          const html = brandedNotification({
            title: tpl.subject,
            intro: tpl.body("Marcos"),
            cta: { label: tpl.cta, url: `${SITE}${tpl.path}` },
            image: emailImage(imagemDoEvento(evento as keyof typeof TEMPLATES).arquivo, imagemDoEvento(evento as keyof typeof TEMPLATES).alt),
          });
          await page.setContent(html, { waitUntil: "domcontentloaded" });

          await expect(page.getByRole("link", { name: tpl.cta, exact: true })).toBeVisible();
          await expect(page.getByRole("link", { name: "Entrar", exact: true })).toBeVisible();
          await expect(page.getByRole("link", { name: "Central de Ajuda" })).toBeVisible();
          await expect(page.getByText("Plataforma em fase de testes. Lançamento oficial em 2027.")).toBeVisible();
          await expect(page.locator("h1")).toContainText(tpl.subject);

          const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(sobra, "sem rolagem lateral a 390 px").toBeLessThanOrEqual(0);

          if (esquema === "dark") {
            const fundo = await page.evaluate(() => getComputedStyle(document.querySelector(".vn-card")!).backgroundColor);
            expect(fundo, "cartão escuro").toBe("rgb(24, 33, 28)");
          }
          if (["new_message", "contract_status"].includes(evento)) {
            await info.attach(`${evento}-${esquema}-390.png`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
          }
        });
      }
    });
  }
});
