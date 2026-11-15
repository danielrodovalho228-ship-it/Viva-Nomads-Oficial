import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2050 — E579 (Pista 3, cobertura do mapa das 142; autorizado pelo Gerente em 15/11) @E579 @ao-vivo-seguro
  Regra: o filtro "Emite nota fiscal" (?nota=1, E574) da /buscar deixa passar os anúncios de dono PJ que declarou emitir
  nota — antes dava SEMPRE 0 (o cruzamento com o dono nunca casava). O chip mostra o número certo, e ao aplicar a lista
  mostra exatamente esses anúncios.
  Visitante, só leitura no alvo. No LABORATÓRIO o spec semeia um dono PJ que declarou emitir nota, com um anúncio ativo
  (é o caso que dava 0); em produção usa o que houver (sem nenhum declarante, diz por que não roda).
*/
test.use({ storageState: { cookies: [], origins: [] } });
const sufixo = novoSufixo();
const titulo = `Studio nota ${sufixo}`;
const ids: Record<string, string> = {};

async function abrirFolha(page: Page) {
  const folha = page.getByTestId("painel-filtros");
  await expect(async () => {
    if (!(await folha.isVisible())) await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(folha).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  return folha;
}

test.describe("T2050 — E579: o filtro 'Emite nota fiscal' encontra os anúncios do dono declarante @E579 @ao-vivo-seguro", () => {
  test.beforeAll(async () => {
    if (!NO_LABORATORIO) return;
    ids.dono = await criarConta({ email: `dono.t2050.${sufixo}@lab.vivanomads.test`, nome: "Dora Nota", role: "owner" }, novaSenha());
    await adm().from("profiles").update({ person_type: "pj", emite_nota_locacao: true }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, titulo, { ativo: true });
  });
  test.afterAll(async () => {
    if (NO_LABORATORIO) await apagarContas([ids.dono]);
  });

  test("chip com N ≥ 1 → aplicar → ?nota=1 e a lista com exatamente N anúncios (no lab, o semeado entre eles)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("card-resultado").first()).toBeVisible({ timeout: 30_000 });
    const folha = await abrirFolha(page);
    const chip = folha.getByTestId("faceta-nota");
    await expect(chip).toBeVisible();
    const n = Number(await chip.getAttribute("data-n"));
    if (NO_LABORATORIO) expect(n, "o anúncio do dono PJ declarante conta no chip (antes: sempre 0)").toBeGreaterThanOrEqual(1);
    test.skip(n === 0, "Nenhum anúncio de dono declarante neste alvo: a regra só se prova com um (o laboratório semeia).");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(folha.getByTestId("aplicar-filtros")).toHaveAttribute("data-total", String(n));
    await folha.getByTestId("aplicar-filtros").click();
    await expect(page).toHaveURL(/[?&]nota=1(&|$)/);
    await expect(page.getByTestId("card-resultado")).toHaveCount(n, { timeout: 15_000 });
    if (NO_LABORATORIO) await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.imovel}"]`)).toHaveCount(1);
  });
});
