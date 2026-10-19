import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/**
 * T86 — PROVAS QUE FALTAVAM (ordens 562d581e e 5c75910b, Moacir 15/10/2026).
 * 1) /decisao (#519): a duração do contrato é editável e a tela compara a regra
 *    antiga (só o 1º mês) com a nova (valor total do contrato), a 390 e 1280 px.
 *    A página é dos sócios: usa o cookie vn_socios derivado do código
 *    (SOCIOS_ACCESS_CODE); sem o código o teste se pula, nunca passa em falso.
 * 2) #536: o avatar do proprietário de exemplo mostra "P" (nunca "P(") e o
 *    capa da Visão geral do dono tem o alt com "sala mobiliada".
 */
const CODIGO = process.env.SOCIOS_ACCESS_CODE ?? process.env.TESTES_SOCIOS_CODIGO;

function moeda(texto: string): number {
  const n = texto.replace(/[^\d,]/g, "").replace(",", ".");
  return Number(n);
}

test.describe("T86 — /decisao: duração editável, regra antiga × nova", () => {
  test.skip(!CODIGO, "Sem SOCIOS_ACCESS_CODE: não dá para abrir a página dos sócios.");

  for (const largura of [390, 1280]) {
    test(`muda a duração e a regra nova acompanha (${largura}px)`, async ({ browser, baseURL }) => {
      const ctx = await browser.newContext({ baseURL, viewport: { width: largura, height: 900 } });
      const token = createHash("sha256").update(`viva-nomads::socios::v1::${CODIGO}`).digest("hex");
      await ctx.addCookies([{ name: "vn_socios", value: token, url: baseURL! }]);
      const page = await ctx.newPage();
      await page.goto("/decisao", { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: /Regra antiga \(1º mês\) × regra nova/ })).toBeVisible();

      const linhaAntiga = page.locator("tr", { hasText: "Antiga (histórica)" });
      const linhaNova = page.locator("tr", { hasText: "Nova (vigente)" });
      const antiga = moeda((await linhaAntiga.locator("td").nth(1).innerText()));
      expect(antiga).toBeGreaterThan(0);

      for (const meses of [2, 6]) {
        await page.locator("#meses").fill(String(meses));
        await page.getByRole("button", { name: "Recalcular" }).click();
        await page.waitForURL(new RegExp(`meses=${meses}`));
        await expect(linhaNova).toContainText(`valor total de ${meses} meses`);
        const nova = moeda(await linhaNova.locator("td").nth(1).innerText());
        // A antiga fica fixa no 1º mês; a nova é a antiga × meses.
        expect(moeda(await linhaAntiga.locator("td").nth(1).innerText())).toBeCloseTo(antiga, 2);
        expect(nova).toBeCloseTo(antiga * meses, 0);
        const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sobra, `rolagem lateral a ${largura}px`).toBeLessThanOrEqual(1);
      }

      // Caso negativo: valor fora de 1–12 volta ao padrão, sem quebrar nem mostrar NaN.
      await page.goto("/decisao?meses=99", { waitUntil: "networkidle" });
      await expect(page.locator("#meses")).not.toHaveValue("99");
      await expect(page.locator("main, body").first()).not.toContainText(/NaN|undefined/);
      await ctx.close();
    });
  }
});

test.describe("T86 — #536: avatar sem 'P(' e alt 'imóvel mobiliado'", () => {
  test("avatar do proprietário de exemplo mostra só as iniciais, nunca '('", async ({ page }) => {
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const card = page.getByTestId("sobre-proprietario");
    test.skip((await card.count()) === 0, "imóvel de exemplo não está no ar neste ambiente.");
    // "Helena M. (exemplo)" → "HM" (o que está entre parênteses nunca entra no avatar).
    const avatar = card.locator("div[aria-hidden]").filter({ hasText: /^\p{Lu}{1,2}$/u }).first();
    await expect(avatar).toHaveText(/^\p{Lu}{1,2}$/u);
    await expect(page.locator("body")).not.toContainText(/\b\p{Lu}\($/u);
    await expect(card.locator("div[aria-hidden]").filter({ hasText: "(" })).toHaveCount(0);
  });

  test.describe("banner da Visão geral do dono", () => {
    test.skip(!hasAccount("proprietario"), "conta de teste do proprietário não configurada");
    test.use({ storageState: authFile("proprietario") });

    test("capa da Visão geral do dono: alt de sala mobiliada (nunca 'apartamento mobiliado')", async ({ page }) => {
      // "networkidle" estourava 45 s no lab (a Visão geral mantém requisições abertas): basta o HTML.
      await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
      // O banner antigo virou a capa do painel (ordem ec7988fe): o alt agora vem de CAPAS.imoveis.
      const capa = page.locator('[data-testid="painel-capa"]:visible').first().locator("img");
      await expect(capa).toHaveAttribute("alt", /sala mobiliada/i, { timeout: 20_000 });
      await expect(page.getByAltText(/apartamento mobiliado/i)).toHaveCount(0);
    });
  });
});
