import { test, expect, type Browser, type Page, type Route } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T431 — PERTO-A: a tela do "O que tem por perto". 390 e 1280, com prints.
 *   1. Cadastro, os três estados (a busca é simulada pela rota, para cada estado aparecer de propósito):
 *      carregando ("Procurando…"); achou (as 5 categorias, até 3 em cada, "Mostrar" ligado e "Está errado");
 *      não achou ("Não achamos…" e "Adicionar um lugar", que abre o formulário do lugar).
 *   2. Desligar "Mostrar" marca o lugar como fora do anúncio.
 *   3. Página do imóvel: "O que tem por perto" agrupado por categoria, na ordem fixa, só com a distância calculada.
 */
const SAIDA = "tests/laboratorio/saida";
const L = (tipo: string, categoria: string, nome: string, distanciaM: number) => ({ tipo, categoria, nome, distanciaM, lat: -18.91, lng: -48.27 });
const ACHADOS = [
  L("hospital", "saude", "Hospital Santa Clara (lab)", 900),
  L("farmacia", "saude", "Farmácia do Centro (lab)", 220),
  L("academia", "saude", "Academia Movimento (lab)", 450),
  L("universidade", "educacao", "Universidade Federal (lab)", 1400),
  L("escola", "educacao", "Escola Estadual (lab)", 600),
  L("coworking", "trabalho", "Coworking Praça (lab)", 750),
  L("mercado", "mercado", "Supermercado Bom Preço (lab)", 300),
  L("onibus", "transporte", "Parada de ônibus", 90),
];

test.describe("T431 — PERTO-A: O que tem por perto", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t431.${sufixo}@lab.vivanomads.test`, nome: "Rui Teixeira", role: "owner" as const };
  const ids: { dono?: string; rascunho?: string; ativo?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await criarImovelPronto(ids.dono, `Studio por perto ${sufixo}`);
    const { data } = await adm().from("properties").select("draft_data").eq("id", ids.rascunho).single();
    const d: Record<string, unknown> = { ...((data?.draft_data as Record<string, unknown>) ?? {}), cep: "38400-100", street: "Avenida Afonso Pena", numero: "100", city: "Uberlândia", uf: "MG" };
    delete d.proxOsm;
    await adm().from("properties").update({ draft_data: d }).eq("id", ids.rascunho);
    ids.ativo = await criarImovelPronto(ids.dono, `Apartamento por perto ${sufixo}`, { ativo: true, preco: 2800 });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  async function abrirCadastro(browser: Browser, w: number, responder: (r: Route) => Promise<void>): Promise<Page> {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    await p.route("**/api/proximidades", responder);
    await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("proximidades-osm").waitFor({ timeout: 30_000 });
    return p;
  }
  const json = (corpo: unknown) => (r: Route) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });
  async function printBloco(p: Page, nome: string, w: number) {
    const bloco = p.getByTestId("proximidades-osm");
    await bloco.scrollIntoViewIfNeeded();
    expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await bloco.screenshot({ path: `${SAIDA}/t431-${nome}-${w}.png` });
  }

  for (const w of [390, 1280]) {
    test(`1. a ${w} px: carregando, achou (5 categorias, até 3) e não achou`, async ({ browser }) => {
      // Carregando: a rota segura a resposta até o print.
      let soltar: () => void = () => {};
      const espera = new Promise<void>((ok) => (soltar = ok));
      const p = await abrirCadastro(browser, w, async (r) => {
        await espera;
        await json({ itens: ACHADOS, fonte: "lab" })(r);
      });
      const bloco = p.getByTestId("proximidades-osm");
      await expect(bloco).toHaveAttribute("data-estado", "carregando", { timeout: 20_000 });
      await expect(p.getByTestId("proximidades-carregando")).toContainText("Procurando o que tem por perto do endereço");
      await printBloco(p, "carregando", w);
      soltar();

      // Achou: as 5 categorias na ordem, até 3 por categoria, "Mostrar" ligado, "Está errado" em cada um (rascunho salvo).
      await expect(bloco).toHaveAttribute("data-estado", "achou", { timeout: 20_000 });
      for (const [c, n] of [["saude", 3], ["educacao", 2], ["trabalho", 1], ["mercado", 1], ["transporte", 1]] as const) {
        await expect(p.getByTestId(`proximidades-cat-${c}`), c).toHaveAttribute("data-qtd", String(n));
      }
      const ordem = await bloco.locator("[data-testid^='proximidades-cat-']").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
      expect(ordem).toEqual(["saude", "educacao", "trabalho", "mercado", "transporte"].map((c) => `proximidades-cat-${c}`));
      const itens = bloco.getByTestId("proximidade-item");
      await expect(itens).toHaveCount(8);
      for (const i of await itens.all()) await expect(i.getByTestId("proximidade-mostrar")).toHaveAttribute("aria-checked", "true");
      await expect(bloco.getByTestId("proximidade-errado")).toHaveCount(8);
      await expect(p.getByTestId("proximidades-cat-saude").getByTestId("proximidade-distancia").first()).toHaveText("a 200 m");
      await expect(bloco).not.toContainText(/min\b|minuto/);
      await printBloco(p, "achou", w);

      // 2. Desligar "Mostrar" tira o lugar do anúncio.
      const academia = itens.filter({ hasText: "Academia Movimento" });
      await academia.getByTestId("proximidade-mostrar").click();
      await expect(academia).toHaveAttribute("data-mostrar", "0");
      await expect(academia.getByTestId("proximidade-distancia")).toContainText("não aparece no anúncio");
      await p.context().close();

      // Não achou: mensagem + "Adicionar um lugar", que abre o formulário.
      const q = await abrirCadastro(browser, w, json({ itens: [], fonte: "sem_lugares" }));
      const vazio = q.getByTestId("proximidades-osm");
      await expect(vazio).toHaveAttribute("data-estado", "vazio", { timeout: 20_000 });
      await expect(q.getByTestId("proximidades-vazio")).toContainText("Não achamos lugares por perto deste endereço");
      await expect(q.getByTestId("proximidades-adicionar")).toHaveText("Adicionar um lugar");
      await printBloco(q, "vazio", w);
      await q.getByTestId("proximidades-adicionar").click();
      await expect(q.getByTestId("proximidades-adicionar")).toHaveCount(0);
      await expect(vazio.locator("input").first()).toBeVisible();
      await q.context().close();
    });

    test(`3. a ${w} px: página do imóvel agrupa por categoria`, async ({ page }) => {
      await adm().from("property_proximities").delete().eq("property_id", ids.ativo!);
      const linha = (category: string, name: string, tipo: string, distancia_m: number, sort_order: number) => ({ property_id: ids.ativo, category, name, tipo, origem: "osm", distancia_m, oculto: false, sort_order });
      const { error } = await adm().from("property_proximities").insert([
        linha("transporte", "Parada de ônibus", "onibus", 90, 0),
        linha("saude", "Farmácia do Centro (lab)", "farmacia", 220, 1),
        linha("mercado", "Supermercado Bom Preço (lab)", "mercado", 300, 2),
        linha("educacao", "Escola Estadual (lab)", "escola", 600, 3),
      ]);
      expect(error).toBeNull();
      await page.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
      await page.goto(`/imoveis/${ids.ativo}`, { waitUntil: "domcontentloaded" });
      const grupos = page.getByTestId("perto-categorias");
      await expect(grupos).toBeVisible({ timeout: 30_000 });
      const ordem = await grupos.locator("[data-testid^='perto-cat-']").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
      expect(ordem).toEqual(["perto-cat-saude", "perto-cat-educacao", "perto-cat-mercado", "perto-cat-transporte"]);
      await expect(page.getByTestId("perto-cat-saude").locator("h4")).toHaveText("Saúde");
      await expect(page.getByTestId("perto-cat-saude").getByTestId("proximidade-texto")).toHaveText("a 200 m");
      await expect(page.getByTestId("perto-cat-transporte").getByTestId("proximidade-texto")).toHaveText("a 100 m");
      await expect(grupos).not.toContainText(/min\b|minuto/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await grupos.scrollIntoViewIfNeeded();
      await page.locator('section[aria-labelledby="localizacao-title"]').screenshot({ path: `${SAIDA}/t431-pagina-${w}.png` });
    });
  }
});
