import { test, expect } from "@playwright/test";

/*
  T252 — Integrações simuladas (ordem 21708cca, parte F): a prévia /dev/emails.
  Sem TEST_ROUTES_KEY (o caso do laboratório) a página tem de ficar protegida, sem iframe e sem indexação.
  Com a chave, tem de renderizar todos os modelos sem "undefined", "NaN" ou "[object Object]", a 390 e 1280 px,
  sem rolagem horizontal da página. Os modelos em si são conferidos por src/lib/notifications/auditoria-emails.test.ts.
*/
test.use({ storageState: { cookies: [], origins: [] } });

const CHAVE = process.env.TEST_ROUTES_KEY;
const CRU = /undefined|NaN|\[object Object\]/;

test("/dev/emails sem chave: protegida, sem modelos e fora do índice", async ({ page }, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
  test.skip(!!CHAVE, "TEST_ROUTES_KEY existe nesta execução: vale o teste com chave");
  await page.goto("/dev/emails");
  await expect(page.getByRole("heading", { name: "Preview de e-mails" })).toBeVisible();
  await expect(page.getByText("Protegido")).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});

for (const largura of [390, 1280]) {
  test(`/dev/emails com chave a ${largura} px: todos os modelos renderizam, sem texto cru`, async ({ page }, info) => {
    test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
    test.skip(!CHAVE, "sem TEST_ROUTES_KEY nesta execução (a prova dos modelos fica no unitário auditoria-emails)");
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto(`/dev/emails?key=${encodeURIComponent(CHAVE!)}`);
    const quadros = page.locator("iframe");
    expect(await quadros.count(), "quantidade de modelos").toBeGreaterThanOrEqual(20);
    const docs = await quadros.evaluateAll((els) => els.map((e) => ({ t: (e as HTMLIFrameElement).title, h: (e as HTMLIFrameElement).srcdoc })));
    for (const d of docs) {
      expect(d.h.length, `${d.t} vazio`).toBeGreaterThan(200);
      expect(d.h, `${d.t} com texto cru`).not.toMatch(CRU);
    }
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra, "rolagem horizontal da página").toBeLessThanOrEqual(1);
  });
}
