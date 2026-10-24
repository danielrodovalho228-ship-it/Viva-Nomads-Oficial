import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T350 — FILTROS-1: a folha de filtros da /buscar com facetas honestas, num fixture FIXO (cidade única do teste):
 *   A — Studio, R$ 2.300 + condomínio R$ 300 (total R$ 2.600), internet informada e MEDIDA (150 Mbps), só seguro-fiança;
 *   B — Apartamento, R$ 2.000, internet informada (300 Mbps, sem medição), caução;
 *   C — Apartamento, R$ 2.400, sem internet informada, caução.
 *   D — (outra cidade) Studio sem medição: a seção "Internet medida" some.
 *   E — Apartamento na mesma cidade, mas EM ADEQUAÇÃO (falta item do padrão mínimo): não entra em resultado nenhum.
 * Prova: cada chip mostra a contagem que o aplicar entrega; 0 desabilita; as faixas de velocidade saem das medições
 * reais (E40) e 100 Mbps não termina em beco sem saída; um chip só de seguro-fiança e "Pronto para Morar" só na folha
 * (E43); "Até R$ 2.500" compara o TOTAL (E20). FILTROS-2: Wi-Fi e Cozinha equipada não são chips — viram a linha de
 * garantia do padrão mínimo — e nenhum filtro traz de volta o imóvel em adequação. Prints 390 e 1280.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const CIDADE = `Cidade Filtros ${sufixo}`;
const CIDADE_SEM = `Cidade Sem Medicao ${sufixo}`;
const dono = { email: `dono.t350.${sufixo}@lab.vivanomads.test`, nome: "Dulce Filtros", role: "owner" as const };
const ids: { dono?: string; a?: string; b?: string; c?: string; d?: string; e?: string } = {};

async function abrirFolha(page: Page, url: string) {
  await expect(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    // E82-A: a pílula "Mais filtros" da linha única, em toda largura.
    await page.getByTestId("pilula-mais").click({ timeout: 5_000 });
    await expect(page.getByTestId("painel-filtros")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  return page.getByTestId("painel-filtros");
}
const n = async (page: Page, testId: string) => Number(await page.getByTestId(testId).getAttribute("data-n"));
const total = async (page: Page) => Number(await page.getByTestId("aplicar-filtros").getAttribute("data-total"));

test.describe("T350 — FILTROS-1: filtros honestos na /buscar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.a = await criarImovelPronto(ids.dono, `Studio A ${sufixo}`, { ativo: true, preco: 2300 });
    ids.b = await criarImovelPronto(ids.dono, `Apto B ${sufixo}`, { ativo: true, preco: 2000 });
    ids.c = await criarImovelPronto(ids.dono, `Apto C ${sufixo}`, { ativo: true, preco: 2400 });
    ids.d = await criarImovelPronto(ids.dono, `Studio D ${sufixo}`, { ativo: true, preco: 2000 });
    ids.e = await criarImovelPronto(ids.dono, `Apto E ${sufixo}`, { ativo: true, preco: 1800 });
    const muda = async (id: string, campos: Record<string, unknown>) => {
      const { error } = await adm().from("properties").update(campos).eq("id", id);
      if (error) throw error;
    };
    await muda(ids.a, { city: CIDADE, property_type: "Studio", condo_fee: 300, utilities_mode: "real", internet_mbps: 300, garantias_aceitas: ["seguro_fianca"], accepts_insurance: true });
    await muda(ids.b, { city: CIDADE, property_type: "Apartamento", utilities_mode: "real", internet_mbps: 300, garantias_aceitas: ["caucao"] });
    await muda(ids.c, { city: CIDADE, property_type: "Apartamento", utilities_mode: "real", internet_mbps: null, garantias_aceitas: ["caucao"] });
    await muda(ids.d, { city: CIDADE_SEM, property_type: "Studio", utilities_mode: "real", internet_mbps: 300 });
    await muda(ids.e, { city: CIDADE, property_type: "Apartamento", utilities_mode: "real", internet_mbps: 300, garantias_aceitas: ["caucao"] });
    const { error: eN } = await adm().from("imovel_nivel").upsert({ property_id: ids.e, nivel: "em_adequacao" });
    if (eN) throw eN;
    const agora = Date.now();
    const { error } = await adm().from("internet_medicoes").insert({
      property_id: ids.a, user_id: ids.dono, papel: "dono", download_mbps: 150, upload_mbps: 20, latencia_ms: 12, distancia_m: 30,
      validada: true, origem: "edicao", medido_em: new Date(agora - 86_400_000).toISOString(), valido_ate: new Date(agora + 150 * 86_400_000).toISOString(),
    });
    if (error) throw error;
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("internet_medicoes").delete().eq("property_id", ids.a ?? "");
    await apagarContas([ids.dono]);
  });

  for (const largura of [1280, 390]) {
    test(`facetas com contagem, zero desabilitado e aplicar = chip — ${largura} px`, async ({ page }) => {
      test.setTimeout(150_000);
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const folha = await abrirFolha(page, `/buscar?local=${encodeURIComponent(CIDADE)}`);
      await expect.poll(() => total(page), { timeout: 30_000 }).toBe(3);

      // FILTROS-2: Wi-Fi e Cozinha equipada são garantia do padrão mínimo — linha no lugar do chip; E (em adequação) não conta.
      await expect(page.getByTestId("painel-garantia-minima")).toHaveText("Padrão mínimo Viva em todos os imóveis: internet Wi-Fi, cozinha equipada e mais 10 itens.");
      await expect(page.getByTestId("faceta-comodidade-wifi")).toHaveCount(0);
      await expect(page.getByTestId("faceta-comodidade-cozinha")).toHaveCount(0);
      await expect(page.getByTestId("faceta-comodidade-garagem")).toBeVisible();
      await expect(page.getByTestId("faceta-comodidade-lavar")).toBeVisible();
      // E20: "Até R$ 2.500" compara o total (A = 2.300 + 300 de condomínio fica fora).
      expect(await n(page, "faceta-preco-2500")).toBe(2);
      expect(await n(page, "faceta-preco-3500")).toBe(3);
      // E42: tipos com contagem; os de 0 ficam desabilitados.
      expect(await n(page, "faceta-tipo-studio")).toBe(1);
      expect(await n(page, "faceta-tipo-apartamento")).toBe(2);
      await expect(page.getByTestId("faceta-tipo-loft")).toBeDisabled();
      await expect(page.getByTestId("faceta-tipo-loft-n")).toHaveText("· 0");
      // E41/E43: caução e seguro-fiança com critério real, um chip só de seguro.
      expect(await n(page, "faceta-garantia-caucao")).toBe(2);
      expect(await n(page, "faceta-garantia-seguro_fianca")).toBe(1);
      await expect(folha.getByRole("button", { name: /Aceita Seguro/i })).toHaveCount(0);
      await expect(folha.getByTestId("faceta-pronto")).toBeVisible();
      // E40: as faixas saem das medições reais (150 Mbps → 50 e 100; 300 não existe).
      await expect(page.getByTestId("painel-internet")).toBeVisible();
      await expect(page.getByTestId("faceta-internet-50")).toBeVisible();
      await expect(page.getByTestId("faceta-internet-100")).toBeVisible();
      await expect(page.getByTestId("faceta-internet-300")).toHaveCount(0);

      // E6: escolher um chip leva o "Mostrar N" exatamente ao número que o chip mostrava.
      for (const id of ["faceta-tipo-apartamento", "faceta-garantia-caucao"]) {
        const esperado = await n(page, id);
        await page.getByTestId(id).click();
        await expect.poll(() => total(page)).toBe(esperado);
        await page.getByTestId(id).click();
        await expect.poll(() => total(page)).toBe(3);
      }

      // 100 Mbps: termina em 1 imóvel (o medido), nunca num "Nenhum imóvel" sem explicação.
      expect(await n(page, "faceta-internet-100")).toBe(1);
      await page.getByTestId("faceta-internet-100").click();
      await expect(page.getByTestId("aplicar-filtros")).toBeEnabled();
      await expect(page.getByTestId("aplicar-filtros")).toHaveText("Mostrar 1 imóvel");
      await expect(page.getByTestId("painel-total-anuncio")).toHaveText("Mostrar 1 imóvel");
      await page.screenshot({ path: `${SAIDA}/t350-folha-${largura}.png`, fullPage: false });
      await page.getByTestId("aplicar-filtros").click();
      await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.a}"]`)).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-testid="card-resultado"]')).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });
  }

  test("FILTROS-2: imóvel em adequação não volta por filtro nenhum, nem por link antigo de Wi-Fi/Cozinha", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const extra of ["", "&comod=wifi,cozinha", "&garantia=caucao", "&tipo=apartamento"]) {
      await page.goto(`/buscar?local=${encodeURIComponent(CIDADE)}${extra}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.b}"]`)).toBeVisible({ timeout: 30_000 });
      await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.e}"]`)).toHaveCount(0);
    }
  });

  test("E40: sem medição na busca, a seção some e a linha explica; Pronto para Morar não está na barra de cima", async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrirFolha(page, `/buscar?local=${encodeURIComponent(CIDADE_SEM)}`);
    await expect.poll(() => total(page), { timeout: 30_000 }).toBe(1);
    await expect(page.getByTestId("painel-internet")).toHaveCount(0);
    await expect(page.getByTestId("painel-internet-vazio")).toHaveText("A internet medida aparece quando algum anúncio desta busca tiver a velocidade medida.");
    await page.screenshot({ path: `${SAIDA}/t350-sem-medicao-1280.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("painel-filtros")).toHaveCount(0);
    // E82-A: a barra de cima é a linha de pílulas — "Mais filtros" nela, "Pronto para Morar" não.
    const linha = page.getByTestId("linha-pilulas");
    await expect(linha.getByTestId("pilula-mais")).toBeVisible();
    await expect(linha.getByRole("button", { name: /Pronto/i })).toHaveCount(0);

    // Veio pela URL com ?internet=100 e nada medido: o chip ligado fica (para desligar) e a linha diz o porquê do 0.
    await abrirFolha(page, `/buscar?local=${encodeURIComponent(CIDADE_SEM)}&internet=100`);
    await expect(page.getByTestId("faceta-internet-100")).toBeEnabled();
    await expect(page.getByTestId("painel-internet-vazio")).toBeVisible();
    await page.getByTestId("faceta-internet-100").click();
    await expect.poll(() => total(page)).toBe(1);
  });
});
