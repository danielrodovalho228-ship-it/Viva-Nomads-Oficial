import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T284 — Busca por internet medida (Prompt 57, fase 2). Quatro imóveis num bairro só deste teste:
 *   medido 320 Mbps · medido 80 Mbps (informou 500) · só informado 500 · sem internet nenhuma.
 *  1. Sem o filtro: os quatro aparecem e não há linha "não medida" (a busca não muda).
 *  2. E1078 (ORDEM-382 (a), asserção alterada): "Velocidade a partir de 100 Mbps" — a lista mostra o medido 320 e o só
 *     informado 500 (com o rótulo "não medida"); o medido 80 não volta pelo informado; "Mostrar N imóveis" bate com a
 *     lista; no fim, "Velocidade desconhecida: 1 imóvel" (o sem internet nenhuma).
 *  3. "Só com internet medida" (dentro de "Para trabalhar de casa"): os dois medidos; o só informado na linha de baixo.
 *  4. 300 Mbps pela URL (E1078): contagem da folha = lista (o medido 320 e o informado 500); o medido 80 não volta pela
 *     porta do informado.
 * A /buscar guarda cache de 60 s: o primeiro passo espera os imóveis novos entrarem.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t284.${sufixo}@lab.vivanomads.test`, nome: "Ivo Velocidade", role: "owner" as const };
const BAIRRO = `Bairro T284 ${sufixo}`;
const ids: Record<"dono" | "m320" | "m80" | "info" | "nada", string | undefined> = { dono: undefined, m320: undefined, m80: undefined, info: undefined, nada: undefined };
const TITULOS = { m320: `Studio medido 320 ${sufixo}`, m80: `Studio medido 80 ${sufixo}`, info: `Studio informado ${sufixo}`, nada: `Studio sem internet ${sufixo}` };

const busca = (q = "") => `/buscar?local=${encodeURIComponent(BAIRRO)}${q}`;
const cards = (page: Page) => page.getByTestId("grade-resultados").getByTestId("card-resultado");

// E82-A: a folha abre pela pílula "Mais filtros" da linha única.
async function abrirFolha(page: Page) {
  await page.getByTestId("pilula-mais").click();
  return page.getByRole("dialog", { name: "Filtros" });
}

test.describe("T284 — busca por internet medida", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const informado = { m320: null, m80: 500, info: 500, nada: null } as const;
    for (const k of ["m320", "m80", "info", "nada"] as const) {
      ids[k] = await criarImovelPronto(ids.dono, TITULOS[k], { ativo: true, preco: 2500 });
      const { error } = await adm().from("properties").update({ address: BAIRRO, internet_mbps: informado[k], tag_home_office: true }).eq("id", ids[k]!);
      if (error) throw error;
    }
    const agora = Date.now();
    const medicao = (property_id: string, download_mbps: number) => ({
      property_id, user_id: ids.dono!, papel: "dono", download_mbps, upload_mbps: 20, latencia_ms: 12, distancia_m: 30,
      validada: true, origem: "edicao", medido_em: new Date(agora - 86_400_000).toISOString(), valido_ate: new Date(agora + 150 * 86_400_000).toISOString(),
    });
    const { error } = await adm().from("internet_medicoes").insert([medicao(ids.m320!, 320), medicao(ids.m80!, 80)]);
    if (error) throw error;
  });

  test.afterAll(async () => {
    await adm().from("internet_medicoes").delete().in("property_id", [ids.m320, ids.m80].filter(Boolean) as string[]);
    await apagarContas([ids.dono]);
  });

  test("1. sem o filtro: os quatro aparecem e não há linha 'não medida'", async ({ page }) => {
    test.setTimeout(120_000);
    await expect(async () => {
      await page.goto(busca(), { waitUntil: "domcontentloaded" });
      await expect(cards(page)).toHaveCount(4, { timeout: 5_000 });
    }).toPass({ intervals: [2_000, 5_000, 10_000], timeout: 90_000 });
    await expect(page.getByTestId("nao-medidos")).toHaveCount(0);
  });

  test("2. E1078 — velocidade 100 Mbps: o medido 320 e o informado 500 (não medida); contagem bate; desconhecidos no fim", async ({ page }) => {
    await page.goto(busca(), { waitUntil: "domcontentloaded" });
    await expect(cards(page)).toHaveCount(4, { timeout: 20_000 });
    const folha = await abrirFolha(page);
    await expect(folha.getByTestId("painel-internet")).toContainText("Velocidade a partir de");
    await folha.getByTestId("painel-internet").getByRole("button", { name: "100 Mbps", exact: true }).click();
    const aplicar = folha.getByTestId("aplicar-filtros");
    await expect(aplicar).toHaveText("Mostrar 2 imóveis");
    await expect(aplicar).toHaveAttribute("data-nao-medidos", "0");
    await folha.screenshot({ path: "tests/laboratorio/saida/t284-folha-100-390.png" });
    await aplicar.click();
    await expect(page).toHaveURL(/internet=100/);
    await expect(cards(page)).toHaveCount(2);
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.m320}"]`)).toHaveCount(1);
    const info = page.locator(`[data-testid="card-resultado"][data-id="${ids.info}"]`);
    await expect(info).toHaveCount(1);
    await expect(info.getByTestId("rotulo-nao-medida")).toHaveText("Internet informada pelo proprietário (não medida)");
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.m320}"]`).getByTestId("rotulo-nao-medida")).toHaveCount(0);
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.m80}"]`)).toHaveCount(0);
    await expect(page.getByTestId("mais-nao-medidos")).toHaveCount(0);
    await expect(page.getByTestId("velocidade-desconhecida")).toHaveText("Velocidade desconhecida: 1 imóvel");
    await page.screenshot({ path: "tests/laboratorio/saida/t284-lista-100-390.png", fullPage: true });
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sobra).toBeLessThanOrEqual(1);
  });

  test("3. 'Só com internet medida' dentro de 'Para trabalhar de casa': os dois medidos", async ({ page }) => {
    await page.goto(busca(), { waitUntil: "domcontentloaded" });
    await expect(cards(page)).toHaveCount(4, { timeout: 20_000 });
    const folha = await abrirFolha(page);
    await expect(folha.getByTestId("painel-home-office")).toHaveCount(0);
    await folha.getByTestId("faceta-home-office").click(); // o chip mostra a contagem ("· N"): pelo testid, não pelo texto exato
    await folha.getByTestId("painel-home-office").getByRole("button", { name: "Só com internet medida", exact: true }).click();
    await expect(folha.getByTestId("aplicar-filtros")).toHaveText("Mostrar 2 imóveis");
    await folha.getByTestId("aplicar-filtros").click();
    await expect(page).toHaveURL(/medida=1/);
    await expect(cards(page)).toHaveCount(2);
    await expect(page.getByTestId("mais-nao-medidos")).toHaveText("Mais 1 imóvel com internet informada, mas não medida");
  });

  test("4. 300 Mbps pela URL (E1078): a contagem da folha é a lista; o medido 80 não volta pelo informado", async ({ page }) => {
    await page.goto(busca("&internet=300"), { waitUntil: "domcontentloaded" });
    await expect(cards(page)).toHaveCount(2, { timeout: 20_000 });
    const folha = await abrirFolha(page);
    await expect(folha.getByTestId("aplicar-filtros")).toHaveAttribute("data-total", "2");
    await page.keyboard.press("Escape");
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.m80}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-testid="card-resultado"][data-id="${ids.info}"]`)).toHaveCount(1);
  });
});
