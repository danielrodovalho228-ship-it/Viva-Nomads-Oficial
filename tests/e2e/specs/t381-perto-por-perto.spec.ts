import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T381 — PERTO-B: "O que tem por perto" automático (laboratório: OSM simulado, PROXIMIDADES_LAB, sem provedor de rotas).
 *   1. A EDIÇÃO chama a busca pelo endereço guardado do anúncio (CEP privado da 0238): 8 lugares, fonte "lab", sem minuto.
 *   2. Lugar à mão: o endereço do lugar dá a distância calculada; endereço não encontrado → nada.
 *   3. Página pública: distância arredondada ("a 200 m"), nenhum minuto; "não mostrar" e o manual antigo sem endereço
 *      não aparecem; os chips vêm da mesma lista.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t381.${sufixo}@lab.vivanomads.test`, nome: "Paulo Perto Lima", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

test.describe("T381 — PERTO-B: O que tem por perto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Apto Perto ${sufixo}`, { ativo: true, preco: 2600 });
    await adm().from("properties").update({ cep_proximidades: "38400100", city: "Uberlândia" }).eq("id", ids.imovel);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("property_proximities").delete().eq("property_id", ids.imovel ?? "");
    await apagarContas([ids.dono]);
  });

  test("1 e 2. a edição busca pelo endereço guardado; lugar à mão tem a distância calculada", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    const r = await p.request.post("/api/proximidades", { data: { propertyId: ids.imovel } });
    expect(r.ok()).toBeTruthy();
    const j = (await r.json()) as { itens: { nome: string; distanciaM: number; tempo?: string }[]; fonte: string };
    expect(j.fonte).toBe("lab");
    expect(j.itens).toHaveLength(8);
    expect(j.itens.some((i) => "tempo" in i)).toBe(false);
    const lugar = await p.request.post("/api/proximidades", { data: { acao: "lugar", propertyId: ids.imovel, endereco: "Rua das Clínicas, 100" } });
    expect(((await lugar.json()) as { distanciaM: number | null }).distanciaM).toBe(700);
    const nada = await p.request.post("/api/proximidades", { data: { acao: "lugar", propertyId: ids.imovel, endereco: "Rua inexistente, 1" } });
    expect(((await nada.json()) as { distanciaM: number | null }).distanciaM).toBeNull();
    await p.context().close();
  });

  test("3. página pública: distância sem minuto; oculto e manual sem endereço fora; chips da mesma lista", async ({ page }) => {
    await adm().from("property_proximities").delete().eq("property_id", ids.imovel!);
    const { error } = await adm().from("property_proximities").insert([
      { property_id: ids.imovel, category: "saude", name: "Farmácia Central (lab)", tipo: "farmacia", origem: "osm", distancia_m: 220, sort_order: 0 },
      { property_id: ids.imovel, category: "saude", name: "Academia Oculta (lab)", tipo: "academia", origem: "osm", distancia_m: 640, oculto: true, sort_order: 1 },
      { property_id: ids.imovel, category: "transporte", name: "Parada de ônibus", tipo: "onibus", origem: "osm", distancia_m: 90, sort_order: 2 },
      { property_id: ids.imovel, category: "educacao", name: "Escola Antiga (lab)", origem: "manual", note: "5 min a pé", sort_order: 3 },
    ]);
    expect(error).toBeNull();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    const secao = page.locator('section[aria-labelledby="localizacao-title"]');
    await expect(secao.getByText("Farmácia Central (lab)")).toBeVisible({ timeout: 30_000 });
    await expect(secao.getByText("Saúde · a 200 m")).toBeVisible();
    await expect(secao.getByText("Academia Oculta (lab)")).toHaveCount(0);
    await expect(secao.getByText("Escola Antiga (lab)")).toHaveCount(0);
    await expect(secao.getByTestId("proximidade-texto").filter({ hasText: /min/ })).toHaveCount(0);
    await page.getByTestId("servico-farmacia").click();
    await expect(page.getByTestId("servico-resultado")).toHaveText("Farmácia mais perto: a 200 m");
    await expect(page.getByTestId("servico-mercado")).toHaveCount(0);
  });
});
