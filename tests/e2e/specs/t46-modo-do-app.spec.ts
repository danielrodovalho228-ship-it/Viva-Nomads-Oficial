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

const ABAS_INQUILINO = ["Buscar", "Favoritos", "Candidaturas", "Mensagens", "Conta"];
const ABAS_PROPRIETARIO = ["Painel", "Imóveis", "Interessados", "Mensagens", "Conta"];

async function abas(page: Page, nomes: string[]) {
  const barra = page.locator("nav.vn-tabbar");
  await expect(barra).toBeVisible();
  for (const n of nomes) await expect(barra.getByRole("link", { name: n })).toBeVisible();
}

async function entrarNoApp(page: Page) {
  await page.goto("/auth", { waitUntil: "networkidle" });
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

  test("chip no topo troca o modo, a barra de abas acompanha e a escolha persiste", async ({ page }) => {
    test.setTimeout(120_000);
    await entrarNoApp(page);
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(page.locator("html")).toHaveAttribute("data-app", "1");
    const chip = page.getByTestId("modo-chip");
    await expect(chip).toHaveAttribute("data-modo", "owner");
    await abas(page, ABAS_PROPRIETARIO);

    await chip.click();
    await expect(chip).toHaveAttribute("data-modo", "tenant");
    await abas(page, ABAS_INQUILINO);
    await expect.poll(async () => (await adm().from("profiles").select("preferred_mode").eq("id", ids.id!).single()).data?.preferred_mode, { timeout: 15_000 }).toBe("tenant");

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("modo-chip")).toHaveAttribute("data-modo", "tenant");
    await abas(page, ABAS_INQUILINO);

    await page.getByTestId("modo-chip").click();
    await expect(page.getByTestId("modo-chip")).toHaveAttribute("data-modo", "owner");
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByTestId("modo-chip")).toHaveAttribute("data-modo", "owner");
    await abas(page, ABAS_PROPRIETARIO);
  });

  test("sem rolagem lateral a 390 px nas telas principais do modo", async ({ page }) => {
    test.setTimeout(120_000);
    await entrarNoApp(page);
    for (const rota of ["/dashboard", "/dashboard/imoveis", "/dashboard/mensagens", "/dashboard/conta"]) {
      await page.goto(rota, { waitUntil: "networkidle" });
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(sobra, `rolagem lateral em ${rota}`).toBeLessThanOrEqual(0);
    }
  });
});
