import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2229 — E1120 (ORDEM-DUET-519/521, escolha (A) do Gerente): a COBERTURA A 1280 PX do filtro de velocidade da busca.
  O filtro já existe (Prompt 57, fase 2, e E1078) e não muda neste item: fonte única src/lib/busca/filtro-internet.ts
  (passaInternet), a mesma folha "Mais filtros" no desktop e no celular. A t2215 prova-o a 390 px; esta spec corre os
  MESMOS casos a 1280 px, com a mesma massa (num bairro só deste teste). Só no laboratório.
    1. sem o filtro: os quatro aparecem (a busca não muda);
    2. 100 Mbps pela folha: entram o medido 320 e o informado 500 (marcado "não medida"); ficam fora o medido 80 e o
       sem internet (imóvel sem velocidade declarada NÃO passa num filtro de mínimo); a contagem da folha bate com a
       lista; "Velocidade desconhecida: 1 imóvel";
    3. 300 Mbps pela URL: o medido 320 e o informado 500; o medido 80 não volta pelo informado;
    4. "Só com internet medida" + 100 Mbps: só o medido 320.
  Mordida: com passaInternet sempre verdadeiro, os casos 2, 3 e 4 caem (entram os quatro).
  A /buscar guarda cache de 60 s: o primeiro passo espera os imóveis novos entrarem.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t2229.${sufixo}@lab.vivanomads.test`, nome: "Vítor Velocidade", role: "owner" as const };
const BAIRRO = `Bairro T2229 ${sufixo}`;
type Chave = "m320" | "m80" | "info" | "nada";
const ids: Partial<Record<"dono" | Chave, string>> = {};
const TITULOS: Record<Chave, string> = { m320: `Studio medido 320 ${sufixo}`, m80: `Studio medido 80 ${sufixo}`, info: `Studio informado 500 ${sufixo}`, nada: `Studio sem internet ${sufixo}` };

const busca = (q = "") => `/buscar?local=${encodeURIComponent(BAIRRO)}${q}`;
const grade = (page: Page) => page.getByTestId("grade-resultados");
/** Os ids dos imóveis na lista principal da busca. */
const idsNaLista = async (page: Page) => (await grade(page).getByTestId("card-resultado").evaluateAll((els) => els.map((e) => e.getAttribute("data-id")))).filter(Boolean).sort();
const esperado = (...k: Chave[]) => k.map((x) => ids[x]!).sort();
const DESCONHECIDA_1 = /Velocidade desconhecida:\s*1\s+im[oó]vel\b/i;

async function abrirFolha(page: Page) {
  await page.getByTestId("pilula-mais").click();
  return page.getByRole("dialog", { name: "Filtros" });
}

test.describe("T2229 — E1120: o filtro de velocidade a 1280 px — a medida ou, sem medição, a informada; sem velocidade não passa @E1120", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 1280, height: 900 }, storageState: { cookies: [], origins: [] } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    const informado: Record<Chave, number | null> = { m320: null, m80: 500, info: 500, nada: null };
    for (const k of ["m320", "m80", "info", "nada"] as const) {
      ids[k] = await criarImovelPronto(ids.dono, TITULOS[k], { ativo: true, preco: 2500, ...(k === "nada" ? { semInternet: true } : {}) });
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
    await apagarContas([ids.dono].filter(Boolean) as string[]);
  });

  test("1. sem o filtro: os quatro aparecem", async ({ page }) => {
    test.setTimeout(120_000);
    await expect(async () => {
      await page.goto(busca(), { waitUntil: "domcontentloaded" });
      await expect(grade(page).getByTestId("card-resultado")).toHaveCount(4, { timeout: 5_000 });
    }).toPass({ intervals: [2_000, 5_000, 10_000], timeout: 90_000 });
  });

  test("2. 100 Mbps pela folha: o medido 320 e o informado 500 (não medida); a contagem bate; 1 de velocidade desconhecida", async ({ page }) => {
    await page.goto(busca(), { waitUntil: "domcontentloaded" });
    await expect(grade(page).getByTestId("card-resultado")).toHaveCount(4, { timeout: 20_000 });
    const folha = await abrirFolha(page);
    const grupo = folha.getByTestId("painel-internet");
    await expect(grupo, "o grupo da internet está na folha").toBeVisible();
    expect.soft(await grupo.innerText(), "E1078 (a): o grupo fala em velocidade").toMatch(/velocidade/i);
    await grupo.getByRole("button", { name: /^100 Mbps/ }).click();
    const aplicar = folha.getByTestId("aplicar-filtros");
    await expect(aplicar, "E1078 (a): a folha conta o medido 320 e o informado 500").toHaveText("Mostrar 2 imóveis");
    await aplicar.click();
    await expect(page, "as mesmas chaves de URL").toHaveURL(/internet=100/);
    await expect.poll(() => idsNaLista(page), { timeout: 20_000, message: "E1078 (a): na lista, o medido 320 e o informado 500 — sem o medido 80 nem o sem internet" }).toEqual(esperado("m320", "info"));
    const info = grade(page).locator(`[data-testid="card-resultado"][data-id="${ids.info}"]`);
    expect.soft(await info.innerText(), "E1078 (a): o informado vem marcado como não medido").toMatch(/não medid/i);
    expect.soft(await grade(page).locator(`[data-testid="card-resultado"][data-id="${ids.m320}"]`).innerText(), "o medido não leva a marca de não medido").not.toMatch(/não medid/i);
    await expect.soft(page.getByText(DESCONHECIDA_1), "E1078 (a): a linha do fim — Velocidade desconhecida: 1 imóvel").toBeVisible();
  });

  test("3. 300 Mbps pela URL: o medido 320 e o informado 500; o medido 80 não volta pelo informado", async ({ page }) => {
    await page.goto(busca("&internet=300"), { waitUntil: "domcontentloaded" });
    await expect.poll(() => idsNaLista(page), { timeout: 20_000, message: "E1078 (a): a medição válida vale mais que o informado" }).toEqual(esperado("m320", "info"));
    const folha = await abrirFolha(page);
    await expect(folha.getByTestId("aplicar-filtros"), "a contagem da folha é a da lista").toHaveAttribute("data-total", "2");
  });

  test("4. 'Só com internet medida' + 100 Mbps: só o medido 320", async ({ page }) => {
    await page.goto(busca("&internet=100&medida=1"), { waitUntil: "domcontentloaded" });
    await expect.poll(() => idsNaLista(page), { timeout: 20_000, message: "\"Só com internet medida\" continua a exigir a medição" }).toEqual(esperado("m320"));
  });
});
