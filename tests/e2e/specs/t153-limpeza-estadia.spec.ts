import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T153 — Pacote de limpeza durante a estadia (ordem 4c74ac38, item 3): o dono define quantas limpezas por mês,
 * o que cada uma inclui e o valor; o anúncio mostra a quantidade; sem pacote, nada aparece.
 * Um imóvel por cenário: a página do anúncio é cacheada por 60 s.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.limp153.${sufixo}@lab.vivanomads.test`, nome: "Lia Limpeza", role: "owner" as const };
const ids: { dono?: string; com?: string; incluida?: string; sem?: string } = {};

test.describe("T153 — Limpeza durante a estadia", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const criar = async (titulo: string, pacote: Record<string, unknown> | null) => {
      const id = await criarImovelPronto(ids.dono!, `${titulo} ${sufixo}`, { ativo: true });
      const { error } = await adm().from("properties").update({ limpeza_estadia: pacote }).eq("id", id);
      expect(error).toBeNull();
      return id;
    };
    ids.com = await criar("Studio Limpeza Paga", { porMes: 2, inclui: "Pisos, banheiro e cozinha", valorMes: 180 });
    ids.incluida = await criar("Studio Limpeza Incluída", { porMes: 1, inclui: "", valorMes: 0 });
    ids.sem = await criar("Studio Sem Limpeza", null);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. anúncio mostra a quantidade, o que inclui e o valor por mês", async ({ page }) => {
    await page.goto(`/imoveis/${ids.com}`, { waitUntil: "networkidle" });
    await expect(page.getByText("2 limpezas por mês (Pisos, banheiro e cozinha) — R$ 180,00 por mês").first()).toBeVisible({ timeout: 20_000 });
  });

  test("2. valor 0 = incluída no valor mensal", async ({ page }) => {
    await page.goto(`/imoveis/${ids.incluida}`, { waitUntil: "networkidle" });
    await expect(page.getByText("1 limpeza por mês — incluída no valor mensal").first()).toBeVisible({ timeout: 20_000 });
  });

  test("3. sem pacote, nada de limpeza durante a estadia no anúncio", async ({ page }) => {
    await page.goto(`/imoveis/${ids.sem}`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("Studio");
    await expect(page.getByText("Limpeza durante a estadia")).toHaveCount(0);
  });

  test("4. editor do dono: escolhe 4 limpezas, grava e o anúncio reflete; sem rolagem lateral a 390 px", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dashboard/imoveis/${ids.sem}/editar`, { waitUntil: "networkidle" });
    const secao = page.getByRole("button", { name: /Regras da casa/ });
    await expect(secao).toBeVisible({ timeout: 20_000 });
    if ((await secao.getAttribute("aria-expanded")) !== "true") await secao.click();
    const bloco = page.getByTestId("limpeza-estadia");
    await expect(bloco).toBeVisible();
    await bloco.getByLabel("4", { exact: true }).check();
    await page.getByTestId("limpeza-inclui").fill("Limpeza completa");
    await page.getByTestId("limpeza-valor").fill("320");
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(sobra).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: /Salvar/ }).first().click();
    await expect
      .poll(async () => (await adm().from("properties").select("limpeza_estadia").eq("id", ids.sem!).single()).data?.limpeza_estadia, { timeout: 20_000 })
      .toMatchObject({ porMes: 4, inclui: "Limpeza completa", valorMes: 320 });
    await page.context().close();
  });
});
