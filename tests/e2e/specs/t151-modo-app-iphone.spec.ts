import { test, expect, devices, type Page, type Locator } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T151 — MODO APP no iPhone (ordem ec7988fe). Roda no projeto `webkit-iphone`
 * (WebKit, iPhone 14) com o user-agent do app "VivaNomadsApp/1.0.4 (expo)" e o
 * cookie vn_app=1. Confere o painel e a Conta com a capa 3S e a tela
 * Anúncio → Disponibilidade: abre em menos de 2 s, sem tarefa longa (> 200 ms)
 * ao trocar de mês, sem elemento sobre as abas e com o "carregando" sumindo.
 */
const UA_APP = `${devices["iPhone 14"].userAgent} VivaNomadsApp/1.0.4 (expo)`;

test.describe("T151 — Modo app no iPhone (proprietário)", () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "webkit-iphone", "só no projeto webkit-iphone");
    test.skip(!hasAccount("proprietario"), "sem conta de teste do proprietário");
  });
  test.use({
    storageState: hasAccount("proprietario") ? authFile("proprietario") : { cookies: [], origins: [] },
    // O aparelho (WebKit, iPhone) vem do projeto `webkit-iphone`: espalhar `devices[...]` aqui derruba a suíte inteira
    // ("Cannot use({ defaultBrowserType }) in a describe group").
    userAgent: UA_APP,
  });

  async function entrarNoApp(page: Page, rota: string) {
    const origem = new URL(rota, process.env.TESTES_BASE_URL || "http://localhost:3000").origin;
    await page.context().addCookies([{ name: "vn_app", value: "1", url: origem }]);
    await page.goto(rota, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-app", "1");
  }

  test("/dashboard e /dashboard/conta mostram a capa 3S", async ({ page }) => {
    await entrarNoApp(page, "/dashboard");
    await expect(page.getByTestId("painel-capa").first()).toBeVisible();
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("painel-capa").first()).toBeVisible();
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra).toBeLessThanOrEqual(0);
  });

  test("Disponibilidade: abre rápido, sem tarefa longa, sem nada sobre as abas e sem carregando preso", async ({ page }) => {
    await entrarNoApp(page, "/dashboard/imoveis");
    const editar = page.locator('a[href*="/dashboard/imoveis/"][href$="/editar"]').first();
    test.skip((await editar.count()) === 0, "conta de teste sem imóvel (no laboratório o teste seguinte cria o próprio)");
    await provarDisponibilidade(page, editar);
  });
});

/** Anúncio → Disponibilidade no app: rápido, sem tarefa longa, sem nada sobre as abas, sem "carregando" preso. */
async function provarDisponibilidade(page: Page, editar: Locator) {
  await page.evaluate(() => {
    const w = window as unknown as { __longas: number[] };
    w.__longas = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__longas.push(e.duration))).observe({
      entryTypes: ["longtask"],
    });
  });
  await editar.click();
  await expect(page).toHaveURL(/\/editar/);
  const t0 = Date.now();
  await page.getByRole("button", { name: /Disponibilidade/ }).click();
  await expect(page.getByText("Fechar datas")).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(2000);

  // O "carregando" das datas some (sucesso ou erro com "Tentar de novo").
  await expect(page.getByTestId("bloqueios-carregando")).toHaveCount(0, { timeout: 10_000 });

  // Toques no calendário (selecionar período) não geram tarefa longa.
  const dias = page.locator("button:not([disabled])").filter({ hasText: /^\d{1,2}$/ });
  await dias.nth(2).click();
  await dias.nth(5).click();
  await page.mouse.wheel(0, 600);
  const longas = await page.evaluate(() => (window as unknown as { __longas: number[] }).__longas);
  expect(Math.max(0, ...longas), `tarefas longas: ${longas.join(", ")} ms`).toBeLessThan(200);

  // Nenhum elemento fixo/sticky sobre a faixa do cabeçalho do app, além dele mesmo.
  const cobertura = await page.evaluate(() => {
    const cab = document.querySelector("header.app-only-flex");
    if (!cab) return [];
    const r = cab.getBoundingClientRect();
    return Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((el) => {
        if (cab.contains(el) || el.contains(cab)) return false;
        const pos = getComputedStyle(el).position;
        if (pos !== "fixed" && pos !== "sticky") return false;
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && b.top < r.bottom && b.bottom > r.top && getComputedStyle(el).display !== "none";
      })
      .map((el) => el.tagName + "." + String(el.className).slice(0, 60));
  });
  expect(cobertura, "elementos fixos sobre o cabeçalho/abas").toEqual([]);
}

// No laboratório a conta fixa do proprietário não tem imóvel: o teste acima pula.
// Aqui o spec cria o próprio proprietário e imóvel, então a Disponibilidade é provada de verdade.
test.describe("T151 — Disponibilidade no app com imóvel próprio (laboratório)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  const senha = novaSenha();
  const dono = { email: `dono.app151.${novoSufixo()}@lab.vivanomads.test`, nome: "Dora App", role: "owner" as const };
  const ids: { dono?: string; imovel?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, "Studio App 151", { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("Disponibilidade: abre rápido, sem tarefa longa, sem nada sobre as abas e sem carregando preso", async ({ browser }, info) => {
    test.skip(info.project.name !== "webkit-iphone", "só no projeto webkit-iphone");
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ ...devices["iPhone 13"], userAgent: UA_APP });
    const page = await ctx.newPage();
    await page.goto("/auth", { waitUntil: "networkidle" });
    await page.locator('input[name="email"], input[type="email"]').first().fill(dono.email);
    await page.locator('input[name="password"], input[type="password"]').first().fill(senha);
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
    await page.evaluate(() => localStorage.setItem("vivanomads-role-asked", "1"));
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-app", "1");
    const editar = page.locator(`a[href="/dashboard/imoveis/${ids.imovel}/editar"]`).first();
    await expect(editar).toBeVisible({ timeout: 20_000 });
    await provarDisponibilidade(page, editar);
    await ctx.close();
  });
});
