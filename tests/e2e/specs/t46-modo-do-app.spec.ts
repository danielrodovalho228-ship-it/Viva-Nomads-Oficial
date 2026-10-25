import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T46 — MODO DO APP (laboratório, ordem 225d0648). Roda no projeto `app-mobile` (390x844, user-agent do app).
 * O chip no topo troca Proprietário ⇄ Inquilino (o app não tem modo "Parceiro": parceiro usa a conta de dono):
 *  1. A barra de 5 abas muda junto com o modo;
 *  2. a escolha persiste no banco (profiles.preferred_mode) e sobrevive ao recarregar a página;
 *  3. sem rolagem lateral a 390 px.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `dono.modo.${sufixo}@lab.vivanomads.test`, nome: "Moa Modo App", role: "owner" as const };
const ids: { id?: string } = {};

// Prompt 41: barra por papel (5 itens).
const ABAS_PROPRIETARIO = ["Início", "Anúncios", "Mensagens", "Ganhos", "Perfil"];

async function abas(page: Page, nomes: string[]) {
  const barra = page.locator("nav.vn-tabbar");
  await expect(barra).toBeVisible();
  for (const n of nomes) await expect(barra.getByRole("link", { name: n })).toBeVisible();
}

async function entrarNoApp(page: Page) {
  await page.goto("/auth?senha=1", { waitUntil: "networkidle" });
  await page.locator('input[name="email"], input[type="email"]').first().fill(conta.email);
  await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
  await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/(dashboard|app\/boas-vindas|buscar)/, { timeout: 20_000 });
  await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
}

test.describe("T46 — Modo do app", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "app-mobile", "só no projeto app-mobile");
    test.skip(!NO_LABORATORIO, "Só no laboratório.");
  });
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    if (!NO_LABORATORIO || test.info().project.name !== "app-mobile") return;
    ids.id = await criarConta(conta, senha);
    await adm().from("profiles").update({ preferred_mode: "owner" }).eq("id", ids.id);
  });
  test.afterAll(async () => {
    if (ids.id) await apagarContas([ids.id]);
  });

  test("conta única: sem seletor de modo no topo e o menu de abas continua inteiro", async ({ page }) => {
    test.setTimeout(120_000);
    await entrarNoApp(page);
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-app", "1");
    // Ordem a8c05cd0: não existe mais o chip Inquilino/Proprietário.
    await expect(page.getByTestId("modo-chip")).toHaveCount(0);
    // O texto do painel cita "inquilinos" de propósito; o que saiu é o SELETOR de modo.
    await expect(page.getByRole("button", { name: /^Trocar para /i })).toHaveCount(0);
    await expect(page.getByText(/^Modo:/)).toHaveCount(0);
    await abas(page, ABAS_PROPRIETARIO);
  });

  test("sem rolagem lateral a 390 px nas telas principais do modo", async ({ page }) => {
    test.setTimeout(120_000);
    await entrarNoApp(page);
    for (const rota of ["/dashboard", "/dashboard/imoveis", "/dashboard/mensagens", "/dashboard/conta"]) {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await page.locator("main").first().waitFor();
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra, `rolagem lateral em ${rota}`).toBeLessThanOrEqual(0);
    }
  });
});
