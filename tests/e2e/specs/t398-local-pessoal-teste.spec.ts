import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, definirPlano, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T398 — E94-B e E93. Só no laboratório (OSM simulado; rotas-falso em LAB_ROTAS_URL).
   1. E94 rótulo e nome: o local guardado sem número da casa e sem pontuação pendurada; com "Como chamar este lugar", o
      nome aparece no lugar do rótulo; o lápis troca o nome depois (grant de rótulo e uso da 0240).
   2. E94 precisão: o ponto do local vai com 3 casas na URL e é o que o tempo (rotas-falso) recebe.
   3. E93: anúncio de teste aberto pelo link — quem não é o dono vê a faixa e o "Solicitar" desativado com o mesmo texto
      (390 e 1280); o dono vê a página normal, com a faixa discreta.
*/
const ROTAS = process.env.LAB_ROTAS_URL ?? "http://127.0.0.1:3998";
const senha = novaSenha();
const sufixo = novoSufixo();
const pessoa = { email: `local.e94.${sufixo}@lab.vivanomads.test`, nome: "Lia Local", role: "tenant" as const };
const dono = { email: `dono.e93.${sufixo}@lab.vivanomads.test`, nome: "Tom Teste", role: "owner" as const };
const ids: { pessoa?: string; dono?: string; teste?: string; perto?: string } = {};
// Destino com 4 casas: na URL e no provedor de rotas, 3 casas.
const DESTINO = { lat: -18.9437, lng: -48.3521 };
const VISITANTE = "Anúncio de teste da equipe Viva — não é um imóvel disponível";

test.describe("T398 — E94-B (local pessoal) e E93 (anúncio de teste pelo link)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.pessoa = await criarConta(pessoa, senha);
    ids.dono = await criarConta(dono, senha);
    await definirPlano(ids.dono, "pro");
    ids.teste = await criarImovelPronto(ids.dono, `[TESTE] Studio E93 ${sufixo}`, { ativo: true });
    ids.perto = await criarImovelPronto(ids.dono, `Studio Perto E94 ${sufixo}`, { ativo: true });
    // ~1,2 km ao norte do destino.
    const { error } = await adm().from("properties").update({ lat: DESTINO.lat + 0.0108, lng: DESTINO.lng }).eq("id", ids.perto);
    if (error) throw error;
  });
  test.afterAll(async () => {
    await apagarContas([ids.pessoa, ids.dono]);
  });

  test("1. rótulo sem número nem pontuação pendurada; nome opcional no lugar do rótulo; o lápis troca o nome", async ({ browser }) => {
    const page = await entrar(browser, pessoa.email, senha);
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const campo = page.getByTestId("campo-destino");
    await expect(campo.getByTestId("outro-local-privacidade")).toHaveText("Guardamos o lugar sem o número da casa, por privacidade.", { timeout: 20_000 });
    // Com nome.
    await campo.getByTestId("outro-local-texto").fill(`Av. João Naves de Ávila, 1331 — Santa Mônica ${sufixo}, Uberlândia`);
    await campo.getByTestId("outro-local-nome").fill("Trabalho");
    await campo.getByTestId("outro-local-buscar").click();
    await expect(campo.getByTestId("destino-digitado")).toHaveText("Trabalho", { timeout: 20_000 });
    // Sem nome: o rótulo limpo.
    await campo.getByRole("button", { name: "Tirar o endereço" }).click();
    await campo.getByTestId("outro-local-texto").fill(`Rua Tito Teixeira nº 45, Santa Mônica ${sufixo}`);
    await campo.getByTestId("outro-local-buscar").click();
    await expect(campo.getByTestId("destino-digitado")).toHaveText(`Rua Tito Teixeira, Santa Mônica ${sufixo}`, { timeout: 20_000 });
    await expect
      .poll(async () => ((await adm().from("destinos_pessoais").select("rotulo").eq("user_id", ids.pessoa!)).data ?? []).map((r) => r.rotulo).sort(), { timeout: 20_000 })
      .toEqual([`Rua Tito Teixeira, Santa Mônica ${sufixo}`, "Trabalho"]);

    // O lápis dá nome ao local guardado.
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    const rua = page.getByTestId("destino-pessoal-item").filter({ hasText: "Rua Tito Teixeira" });
    await rua.getByTestId("destino-pessoal-renomear").click({ timeout: 20_000 });
    await page.getByTestId("destino-pessoal-nome").fill("Cargill");
    await page.getByTestId("destino-pessoal-nome-salvar").click();
    await expect(page.getByTestId("destinos-pessoais").getByTestId("destino-pessoal").filter({ hasText: "Cargill" })).toBeVisible({ timeout: 20_000 });
    const { data } = await adm().from("destinos_pessoais").select("rotulo").eq("user_id", ids.pessoa!);
    expect((data ?? []).map((r) => r.rotulo).sort()).toEqual(["Cargill", "Trabalho"]);
    for (const r of data ?? []) expect(r.rotulo).not.toMatch(/1331|45|—\s*$|,\s*$/);
    await page.screenshot({ path: "tests/laboratorio/saida/t398-1-nome-390.png", fullPage: true });
    await page.context().close();
  });

  test("2. precisão: o ponto vai com 3 casas na URL e no provedor de rotas", async ({ page }) => {
    await page.goto(`/buscar?local=Uberl%C3%A2ndia&dlat=${DESTINO.lat}&dlng=${DESTINO.lng}&drot=${encodeURIComponent("Lugar E94")}&modo=carro`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/dlat=-18\.944&dlng=-48\.352/, { timeout: 20_000 });
    const card = page.locator(`[data-testid="card-resultado"][data-id="${ids.perto}"]`);
    await expect(card.getByTestId("tempo-cartao")).not.toContainText("calculando", { timeout: 30_000 });
    // O destino que chegou ao provedor (rotas-falso) é o de 3 casas — o mesmo do cache de tempos.
    await expect
      .poll(
        async () => {
          const ch = (await (await fetch(`${ROTAS}/__chamadas`)).json()) as { destino?: { lat: number; lng: number } }[];
          return ch.some((c) => c.destino && c.destino.lat === -18.944 && c.destino.lng === -48.352);
        },
        { timeout: 30_000 },
      )
      .toBe(true);
  });

  test("3. E93: faixa e 'Solicitar' desativado para quem não é o dono; o dono vê a página normal", async ({ browser }) => {
    for (const w of [1280, 390]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto(`/imoveis/${ids.teste}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("faixa-anuncio-teste")).toHaveText(VISITANTE, { timeout: 20_000 });
      await expect(page.getByTestId("faixa-anuncio-teste")).toHaveAttribute("data-modo", "visitante");
      const botao = w === 1280 ? page.getByTestId("cartao-solicitar") : page.getByTestId("barra-solicitar");
      await expect(botao).toBeDisabled();
      await expect(botao).toHaveText(VISITANTE);
      await page.screenshot({ path: `tests/laboratorio/saida/t398-3-visitante-${w}.png`, fullPage: false });
      await ctx.close();
    }
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/imoveis/${ids.teste}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("faixa-anuncio-teste")).toHaveAttribute("data-modo", "equipe", { timeout: 20_000 });
    await expect(page.getByTestId("faixa-anuncio-teste")).toHaveText("Anúncio de teste: fora da busca e das listagens");
    await expect(page.getByTestId("cartao-solicitar")).toBeEnabled();
    await expect(page.getByTestId("cartao-solicitar")).toHaveText("Solicitar");
    await page.screenshot({ path: "tests/laboratorio/saida/t398-3-dono-1280.png", fullPage: false });
    await page.context().close();
  });
});
