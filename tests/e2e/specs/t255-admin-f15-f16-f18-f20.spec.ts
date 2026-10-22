import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T255 — Reteste dos achados F15, F16, F18 e F20 do /admin com o admin de teste em AAL2
 * (ordem 45ce8baf; 1 teste por achado, prints a 390 e 1280 px). Sem TESTES_ADMIN_TOTP_SEGREDO o
 * admin de teste não entra no /admin, então tudo se PULA com o motivo (nunca passa em falso).
 */
test.describe("T255 — Admin: reteste F15/F16/F18/F20", () => {
  test.skip(!process.env.TESTES_ADMIN_TOTP_SEGREDO, "Sem TESTES_ADMIN_TOTP_SEGREDO: o admin de teste não elevou a AAL2.");
  test.use({ storageState: authFile("admin") });

  for (const largura of [390, 1280]) {
    test(`F15 — selo de "Agentes" no menu conta aprovações, não achados P1 (${largura} px)`, async ({ page }, info) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      if (largura < 1024) await page.getByRole("button", { name: "Abrir menu" }).click();
      const menu = page.getByRole("navigation", { name: "Menu do painel" });
      const agentes = menu.getByRole("link", { name: /^Agentes/ }).first();
      await expect(agentes).toBeVisible({ timeout: 20_000 });
      const selo = agentes.locator('[aria-label$="aguardando"]');
      await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
      // o rótulo claro dos achados P1 mora dentro de /admin/agentes (não no selo do menu); é desenhado no cliente,
      // então espera aparecer em vez de contar logo após o domcontentloaded (contava 0).
      await expect(page.getByText(/achados P1/i).first()).toBeVisible({ timeout: 20_000 });
      if (await selo.count()) expect(await selo.getAttribute("aria-label")).toMatch(/^\d+ aguardando$/);
      await page.screenshot({ path: info.outputPath(`f15-${largura}.png`), fullPage: false });
    });

    test(`F16 — "Atendimento: chamados abertos" da home bate com a fila de /admin/atendimento (${largura} px)`, async ({ page }, info) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      const cartao = page.getByTestId("home-agora").locator('[data-agora="Atendimento: chamados abertos"] [data-href]');
      await expect(cartao).toBeVisible({ timeout: 20_000 });
      await expect(cartao).toHaveAttribute("href", /\/admin\/atendimento\?aba=fila/);
      const n = Number((await cartao.innerText()).match(/\d[\d.]*/g)?.pop()?.replace(/\./g, "") ?? NaN);
      expect(Number.isNaN(n)).toBe(false);
      // A home termina de carregar os números no cliente; clica só com a página parada (a 390 px a lista ainda cresce).
      await page.waitForLoadState("networkidle");
      await cartao.scrollIntoViewIfNeeded();
      await cartao.click();
      await expect(page).toHaveURL(/\/admin\/atendimento/);
      const linhas = await page.getByTestId("chamado-linha").count();
      if (n === 0) expect(linhas).toBe(0);
      else expect(linhas).toBeGreaterThan(0); // 0 na home com chamado aberto na fila era o F16
      await page.screenshot({ path: info.outputPath(`f16-${largura}.png`), fullPage: false });
    });

    test(`F18 — filtrar o funil por cidade só estreita, nunca soma (${largura} px)`, async ({ page }, info) => {
      await page.setViewportSize({ width: largura, height: 900 });
      const valores = async (url: string) => {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const itens = page.getByTestId("funil-links").locator("[data-valor]");
        await expect(itens.first()).toBeVisible({ timeout: 20_000 });
        return (await itens.allInnerTexts()).map((t) => Number(t.replace(/\D/g, "")));
      };
      const sem = await valores("/admin?periodo=90");
      await page.goto("/admin?periodo=90", { waitUntil: "domcontentloaded" });
      const cidades = await page.locator('select:has(option:text-is("Todas as cidades")) option').evaluateAll((os) =>
        (os as HTMLOptionElement[]).map((o) => o.value).filter(Boolean),
      );
      test.skip(cidades.length === 0, "Sem cidade com anúncio no ambiente.");
      for (const cidade of cidades.slice(0, 3)) {
        const com = await valores(`/admin?periodo=90&cidade=${encodeURIComponent(cidade)}`);
        expect(com.length).toBe(sem.length);
        com.forEach((v, i) => expect(v, `etapa ${i} em ${cidade}`).toBeLessThanOrEqual(sem[i]));
      }
      await page.screenshot({ path: info.outputPath(`f18-${largura}.png`), fullPage: false });
    });

    test(`F20 — /admin/pedidos tem busca, abas por situação e sem rolagem lateral (${largura} px)`, async ({ page }, info) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/admin/pedidos", { waitUntil: "domcontentloaded" });
      const busca = page.getByTestId("pedidos-busca");
      await expect(busca).toBeVisible({ timeout: 20_000 });
      const abas = page.getByRole("tab");
      expect(await abas.count()).toBeGreaterThan(1);
      const antes = await page.getByTestId("lista-total").innerText();
      await busca.fill("zzzz-sem-resultado-t255");
      await expect(page.getByText("Nenhum pedido com esse filtro.").or(page.getByText("Nenhum pedido no sistema."))).toBeVisible();
      await busca.fill("");
      await expect(page.getByTestId("lista-total")).toHaveText(antes);
      await abas.nth(1).click();
      await expect(abas.nth(1)).toHaveAttribute("aria-selected", "true");
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(0);
      await page.screenshot({ path: info.outputPath(`f20-${largura}.png`), fullPage: false });
    });
  }
});
