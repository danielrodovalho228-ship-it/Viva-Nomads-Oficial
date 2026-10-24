import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T409 — ADENDO 3 AO FILTROS-B (E39–E43), na MASSA VARIADA do laboratório (cidade única do teste; a base pública só tem
 * exemplos, e exemplo não conta quando há filtro — E9):
 *   A — Apartamento, caução, 30–180 dias, Pronto para Morar;
 *   B — Casa, SEM caução (só seguro-fiança);
 *   C — Studio, mínimo de 120 dias;
 *   D — Apartamento, máximo de 60 dias.
 * Ninguém tem medição de internet.
 * Prova: Wi-Fi fora do painel e ?comod=wifi ignorado (E39); sem medição, a seção de velocidade não existe e ?internet= é
 * ignorado (E40); caução e estadia filtram (E41); tipos em 0 ficam com "· 0" e desativados (E42); ?seguro=1 vira a
 * garantia "Seguro-fiança" e não há chip à parte (E43.6); Pronto para Morar é um estado só — folha e chip ativo (E43.7).
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Cidade Adendo3 ${sufixo}`;
const dono = { email: `dono.t409.${sufixo}@lab.vivanomads.test`, nome: "Dalva Filtros", role: "owner" as const };
const ids: { dono?: string; a?: string; b?: string; c?: string; d?: string } = {};
const LOCAL = `/buscar?local=${encodeURIComponent(CIDADE)}`;

async function abrirFolha(page: Page, url: string) {
  await expect(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    const celular = page.getByTestId("abrir-filtros").filter({ visible: true });
    if (await celular.count()) await celular.first().click({ timeout: 5_000 });
    else {
      if (!(await page.getByTestId("mais-filtros").isVisible())) await page.getByTestId("busca-compacta").click({ timeout: 5_000 });
      await page.getByTestId("mais-filtros").click({ timeout: 5_000 });
    }
    await expect(page.getByTestId("painel-filtros")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  return page.getByTestId("painel-filtros");
}
const n = async (page: Page, testId: string) => Number(await page.getByTestId(testId).getAttribute("data-n"));
const total = async (page: Page) => Number(await page.getByTestId("aplicar-filtros").getAttribute("data-total"));
const cartoes = (page: Page) => page.locator('[data-testid="card-resultado"]');

test.describe("T409 — Adendo 3 ao FILTROS-B: auditoria dos filtros (E39–E43)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarImovelPronto(ids.dono, `Apto A ${sufixo}`, { ativo: true, preco: 2200 });
    ids.b = await criarImovelPronto(ids.dono, `Casa B ${sufixo}`, { ativo: true, preco: 3000 });
    ids.c = await criarImovelPronto(ids.dono, `Studio C ${sufixo}`, { ativo: true, preco: 2400 });
    ids.d = await criarImovelPronto(ids.dono, `Apto D ${sufixo}`, { ativo: true, preco: 2600 });
    const muda = async (id: string, campos: Record<string, unknown>) => {
      const { error } = await adm().from("properties").update(campos).eq("id", id);
      if (error) throw error;
    };
    const comum = { city: CIDADE, utilities_mode: "real", internet_mbps: 200 };
    await muda(ids.a, { ...comum, property_type: "Apartamento", garantias_aceitas: ["caucao"], min_period_days: 30, max_period_days: 180, ready_to_live_badge: true });
    await muda(ids.b, { ...comum, property_type: "Casa", garantias_aceitas: ["seguro_fianca"], accepts_insurance: true, min_period_days: 30, max_period_days: 180 });
    await muda(ids.c, { ...comum, property_type: "Studio", garantias_aceitas: ["caucao"], min_period_days: 120, max_period_days: 180 });
    await muda(ids.d, { ...comum, property_type: "Apartamento", garantias_aceitas: ["caucao"], min_period_days: 30, max_period_days: 60 });
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  test("E39 + E40: sem Wi-Fi no painel (?comod=wifi ignorado); sem medição, sem seção de velocidade (?internet= ignorado)", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const folha = await abrirFolha(page, `${LOCAL}&comod=wifi&internet=100&medida=1`);
    // Os filtros antigos não tiram ninguém: os 4 continuam contando.
    await expect.poll(() => total(page), { timeout: 30_000 }).toBe(4);
    await expect(folha.getByTestId("faceta-comodidade-wifi")).toHaveCount(0);
    await expect(folha.getByTestId("painel-comodidades").getByRole("button", { name: /Wi-Fi/ })).toHaveCount(0);
    await expect(folha.getByTestId("painel-internet")).toHaveCount(0);
    await expect(folha.getByTestId("painel-internet-vazio")).toBeVisible();
    await page.screenshot({ path: `${SAIDA}/t409-sem-wifi-sem-medicao-1280.png`, fullPage: false });
    await page.keyboard.press("Escape");
    // A URL perde o filtro de internet e a comodidade antiga; nenhum chip ativo de internet.
    await expect(page).not.toHaveURL(/[?&](internet|medida)=/);
    await expect(page).not.toHaveURL(/comod=wifi/);
    await expect(page.getByRole("button", { name: /Remover filtro Internet/ })).toHaveCount(0);
    await expect(cartoes(page)).toHaveCount(4, { timeout: 20_000 });
  });

  test("E41 + E42: caução e estadia filtram; tipos em 0 mostram '· 0' e ficam desativados", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirFolha(page, LOCAL);
    await expect.poll(() => total(page), { timeout: 30_000 }).toBe(4);
    expect(await n(page, "faceta-garantia-caucao")).toBe(3);
    expect(await n(page, "faceta-garantia-seguro_fianca")).toBe(1);
    expect(await n(page, "faceta-estadia-60")).toBe(3); // C (mínimo 120) fora
    expect(await n(page, "faceta-estadia-120")).toBe(3); // D (máximo 60) fora
    expect(await n(page, "faceta-estadia-180")).toBe(3);
    for (const tipo of ["loft", "cobertura", "casa_condominio", "flat", "quarto", "chacara"]) {
      await expect(page.getByTestId(`faceta-tipo-${tipo}`), tipo).toBeDisabled();
      await expect(page.getByTestId(`faceta-tipo-${tipo}-n`), tipo).toHaveText("· 0");
    }
    expect(await n(page, "faceta-tipo-apartamento")).toBe(2);
    // Escolher caução leva o "Mostrar N" ao número do chip, e a lista ao mesmo número.
    await page.getByTestId("faceta-garantia-caucao").click();
    await expect.poll(() => total(page)).toBe(3);
    await page.screenshot({ path: `${SAIDA}/t409-caucao-tipos-390.png`, fullPage: false });
    await page.getByTestId("aplicar-filtros").click();
    await expect(cartoes(page)).toHaveCount(3, { timeout: 20_000 });
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.b}"]`)).toHaveCount(0);
  });

  test("E43 (6): ?seguro=1 vira a garantia 'Seguro-fiança' — um chip só, mesmo critério", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${LOCAL}&seguro=1`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/garantia=seguro_fianca/, { timeout: 30_000 });
    await expect(page).not.toHaveURL(/[?&]seguro=1/);
    await expect(cartoes(page)).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.b}"]`)).toBeVisible();
    const folha = await abrirFolha(page, page.url());
    await expect(folha.getByTestId("faceta-garantia-seguro_fianca")).toHaveAttribute("aria-pressed", "true");
    await expect(folha.getByRole("button", { name: /Aceita Seguro/i })).toHaveCount(0);
  });

  test("E43 (7): Pronto para Morar — o chip da folha e o chip ativo são o mesmo estado e contam 1", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrirFolha(page, LOCAL);
    await expect.poll(() => total(page), { timeout: 30_000 }).toBe(4);
    expect(await n(page, "faceta-pronto")).toBe(1);
    await page.getByTestId("faceta-pronto").click();
    await expect.poll(() => total(page)).toBe(1);
    await page.getByTestId("aplicar-filtros").click();
    await expect(page).toHaveURL(/pronto=1/);
    await expect(cartoes(page)).toHaveCount(1, { timeout: 20_000 });
    // Um filtro ativo só, com o mesmo rótulo; tirar pelo chip ativo desmarca a folha.
    const remover = page.getByRole("button", { name: "Remover filtro Pronto para Morar" });
    await expect(remover).toHaveCount(1);
    await remover.click();
    await expect(page).not.toHaveURL(/pronto=1/);
    await expect(cartoes(page)).toHaveCount(4, { timeout: 20_000 });
    const folha = await abrirFolha(page, page.url());
    await expect(folha.getByTestId("faceta-pronto")).toHaveAttribute("aria-pressed", "false");
  });
});
