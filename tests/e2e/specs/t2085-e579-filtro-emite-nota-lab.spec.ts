import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2085 (laboratório; antes t2050-lab) — E579 @E579 (sem @ao-vivo-seguro: cria conta e anúncio pela chave de serviço). O caso que dava
  SEMPRE 0: um dono PJ que declarou emitir nota, com anúncio ativo → o chip "Emite nota fiscal" conta ≥ 1 e, aplicado,
  a lista traz esse anúncio. É a prova vermelha do t2050 de visitante (o alvo local de demonstração não tem declarante).
*/
test.use({ storageState: { cookies: [], origins: [] } });
const sufixo = novoSufixo();
const ids: Record<string, string> = {};

async function abrirFolha(page: Page) {
  const folha = page.getByTestId("painel-filtros");
  await expect(async () => {
    if (!(await folha.isVisible())) await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(folha).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  return folha;
}

test.describe("T2085 (lab) — E579: o dono PJ declarante entra no filtro @E579", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.beforeAll(async () => {
    ids.dono = await criarConta({ email: `dono.t2050.${sufixo}@lab.vivanomads.test`, nome: "Dora Nota", role: "owner" }, novaSenha());
    await adm().from("profiles").update({ person_type: "pj", emite_nota_locacao: true }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio nota ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("o chip conta o anúncio semeado (≥ 1) e, aplicado, a lista o traz", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first()).toBeVisible({ timeout: 30_000 });
    const folha = await abrirFolha(page);
    const chip = folha.getByTestId("faceta-nota");
    const n = Number(await chip.getAttribute("data-n"));
    expect(n, "o anúncio do dono PJ declarante conta no chip (antes: sempre 0)").toBeGreaterThanOrEqual(1);
    await chip.click();
    await folha.getByTestId("aplicar-filtros").click();
    await expect(page).toHaveURL(/[?&]nota=1(&|$)/);
    await expect(page.getByTestId("card-resultado")).toHaveCount(n, { timeout: 15_000 });
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.imovel}"]`)).toHaveCount(1);
  });
});
