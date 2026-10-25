import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * Rodada da vigia 24/10 (Pista C): triagem do lab completo de 5f44161, no lab-crítico, sem a carga do lab inteiro.
 * L-44 (24/10): F18 e F20 não dependem mais da ordem nem dos dados das outras specs.
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
      // ADMIN-1: no celular a barra abre em "Menu da equipe"; a Central de Agentes mora no grupo "Equipe" (recolhido).
      if (largura < 1024) await page.getByTestId("admin-abrir-menu").click();
      const menu = page.getByTestId("menu-cascata").filter({ visible: true });
      const agentes = menu.locator('a[href="/admin/agentes"]').first();
      if (!(await agentes.isVisible())) await menu.locator("li[data-menu-grupo] > button").filter({ hasText: "Equipe" }).first().click();
      await expect(agentes).toBeVisible({ timeout: 20_000 });
      const selo = agentes.locator('[aria-label$="aguardando"]');
      await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
      // o rótulo claro dos achados P1 mora dentro de /admin/agentes (não no selo do menu); é desenhado no cliente,
      // então espera aparecer em vez de contar logo após o domcontentloaded (contava 0).
      await expect(page.getByText(/achados P1/i).first()).toBeVisible({ timeout: 20_000 });
      if (await selo.count()) expect(await selo.getAttribute("aria-label")).toMatch(/^\d+ aguardando$/);
      await page.screenshot({ path: info.outputPath(`f15-${largura}.png`), fullPage: false });
    });

    test(`F16 — "Chamados abertos" da home bate com /admin/atendimento (${largura} px)`, async ({ page }, info) => {
      // ADMIN-4: o número da inicial e o da página de destino vêm da MESMA função (contarChamadosAbertos).
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/admin", { waitUntil: "domcontentloaded" });
      const cartao = page.getByTestId("admin-numero-chamados");
      await expect(cartao).toBeVisible({ timeout: 20_000 });
      await expect(cartao).toHaveAttribute("href", "/admin/atendimento");
      const reais = await cartao.getAttribute("data-reais");
      const teste = await cartao.getAttribute("data-teste");
      await page.waitForLoadState("networkidle").catch(() => {});
      await cartao.click();
      await expect(page).toHaveURL(/\/admin\/atendimento/, { timeout: 30_000 });
      const fonte = page.getByTestId("numero-fonte-chamados");
      await expect(fonte).toHaveAttribute("data-reais", reais!, { timeout: 30_000 });
      await expect(fonte).toHaveAttribute("data-teste", teste!);
      await page.screenshot({ path: info.outputPath(`f16-${largura}.png`), fullPage: false });
    });

    test(`F18 — filtrar o funil por cidade só estreita, nunca soma (${largura} px)`, async ({ page }, info) => {
      await page.setViewportSize({ width: largura, height: 900 });
      test.setTimeout(150_000);
      const valores = async (url: string) => {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        const itens = page.getByTestId("funil-links").locator("[data-valor]");
        await expect(itens.first()).toBeVisible({ timeout: 20_000 });
        return (await itens.allInnerTexts()).map((t) => Number(t.replace(/\D/g, "")));
      };
      await page.goto("/admin/funil?periodo=90", { waitUntil: "domcontentloaded" });
      const cidades = await page.locator('select:has(option:text-is("Todas as cidades")) option').evaluateAll((os) =>
        (os as HTMLOptionElement[]).map((o) => o.value).filter(Boolean),
      );
      test.skip(cidades.length === 0, "Sem cidade com anúncio no ambiente.");
      // L-44: outras specs criam dados enquanto esta lê (lab completo 40 → 75). Só compara quando o funil sem cidade
      // ficou igual antes e depois das leituras por cidade; se mudou no meio, lê tudo de novo.
      await expect(async () => {
        const sem = await valores("/admin/funil?periodo=90");
        const porCidade: [string, number[]][] = [];
        for (const cidade of cidades.slice(0, 3)) porCidade.push([cidade, await valores(`/admin/funil?periodo=90&cidade=${encodeURIComponent(cidade)}`)]);
        expect(await valores("/admin/funil?periodo=90"), "o funil sem cidade mudou durante a leitura").toEqual(sem);
        for (const [cidade, com] of porCidade) {
          expect(com.length).toBe(sem.length);
          com.forEach((v, i) => expect(v, `etapa ${i} em ${cidade}`).toBeLessThanOrEqual(sem[i]));
        }
      }).toPass({ timeout: 100_000, intervals: [2_000, 5_000] });
      await page.screenshot({ path: info.outputPath(`f18-${largura}.png`), fullPage: false });
    });

    test(`F20 — /admin/pedidos tem busca, abas por situação e sem rolagem lateral (${largura} px)`, async ({ page }, info) => {
      await page.setViewportSize({ width: largura, height: 900 });
      await page.goto("/admin/pedidos", { waitUntil: "domcontentloaded" });
      const busca = page.getByTestId("pedidos-busca");
      await expect(busca).toBeVisible({ timeout: 20_000 });
      const abas = page.getByRole("tab");
      // L-44: há "Todos (n)" e uma aba por situação que tem pedido (abasPedidos). Sem pedido no recorte, só "Todos (0)".
      await expect(abas.first()).toHaveText(/^Todos \(\d+\)$/);
      const total = (rotulo: string) => Number(rotulo.match(/\((\d+)\)$/)?.[1] ?? NaN);
      const rotulos = await abas.allInnerTexts();
      const todos = total(rotulos[0]);
      expect(rotulos.slice(1).reduce((soma, r) => soma + total(r), 0), "as abas por situação somam o total").toBe(todos);
      if (todos > 0) expect(rotulos.length).toBeGreaterThan(1);
      const antes = await page.getByTestId("lista-total").innerText();
      await busca.fill("zzzz-sem-resultado-t255");
      await expect(page.getByText("Nenhum pedido com esse filtro.").or(page.getByText("Nenhum pedido no sistema."))).toBeVisible();
      await busca.fill("");
      await expect(page.getByTestId("lista-total")).toHaveText(antes);
      if (rotulos.length > 1) {
        await abas.nth(1).click();
        await expect(abas.nth(1)).toHaveAttribute("aria-selected", "true");
      }
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(0);
      await page.screenshot({ path: info.outputPath(`f20-${largura}.png`), fullPage: false });
    });
  }
});
