import { test, expect, type Browser, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T261 — Busca pelo local de trabalho (Prompt 37), com o provedor de rotas FALSO do laboratório (scripts/lab/rotas-falso.mjs,
 * tempos determinísticos: carro = 1,3 × linha reta a 25 km/h):
 *  1) HC-UFU + carro + até 20 → só imóveis dentro, em ordem, com "~N min de carro até o HC-UFU" no cartão;
 *  2) endereço digitado → cálculo sob demanda e cache (a 2ª busca não chama o provedor); URL com 2 casas e sem número;
 *  3) "Tempo até" na página do imóvel;
 *  4) "Meu local de trabalho" salvo vira o padrão da busca;
 *  5) /imoveis-perto-de/hc-ufu com imóveis (indexável) e um destino sem imóvel (noindex + "Avise-me");
 *  6) provedor fora → "em linha reta", nunca minutos;
 *  + /admin/destinos (ativo, sem ponto não ativa, "Destinos mais buscados" com contagem). 390 e 1280 px, sem rolagem lateral.
 */
const SAIDA = "tests/laboratorio/saida";
const ROTAS = process.env.LAB_ROTAS_URL ?? "http://127.0.0.1:3998";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t261.${sufixo}@lab.vivanomads.test`, nome: "Dora Destino", role: "owner" as const };
const medica = { email: `med.t261.${sufixo}@lab.vivanomads.test`, nome: "Marta Residente", role: "tenant" as const };
// Ponto do destino do laboratório (dado de teste, gravado só no banco do lab — nenhuma coordenada vai para o código do site).
const HC = { lat: -18.7, lng: -48.1 };
const ids: { dono?: string; medica?: string; perto?: string; medio?: string; longe?: string; vazio?: string } = {};
let hcAntes: { lat: number | null; lng: number | null; ativo: boolean } | null = null;

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}
const chamadas = async (): Promise<number> => ((await (await fetch(`${ROTAS}/__chamadas`)).json()) as unknown[]).length;
const limparRotas = () => fetch(`${ROTAS}/__limpar`, { method: "POST" });

/** Espera os tempos chegarem (nenhum cartão em "calculando…") e devolve [id, texto] na ordem da tela. */
async function temposNaTela(page: Page): Promise<[string, string][]> {
  await expect(page.getByTestId("tempo-cartao").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("tempo-cartao").filter({ hasText: "calculando…" })).toHaveCount(0, { timeout: 20_000 });
  // Cartão de imóvel sem ponto não tem linha de tempo (sem dado, sem linha): fica fora da lista.
  return page.getByTestId("card-resultado").evaluateAll((els) =>
    els
      .map((el) => [el.getAttribute("data-id") ?? "", el.querySelector('[data-testid="tempo-cartao"]')?.textContent?.trim() ?? ""] as [string, string])
      .filter(([, texto]) => texto !== ""),
  );
}
const minutos = (t: string) => (/menos de 5 min/.test(t) ? 0 : Number(t.match(/~(\d+) min/)?.[1] ?? NaN));
const faixa = (m: number) => (m <= 10 ? 0 : m <= 20 ? 1 : m <= 30 ? 2 : 3);

test.describe("T261 — Tempo até o trabalho (Prompt 37)", () => {
  test.skip(!NO_LABORATORIO, "só no laboratório (provedor de rotas falso)");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.medica = await criarConta(medica, senha);
    // Três imóveis ao norte do destino: ~2 km (~10 min), ~5,5 km (~20 min) e ~13 km (~45 min) de carro no provedor falso.
    for (const [chave, dLat] of [["perto", 0.02], ["medio", 0.05], ["longe", 0.12]] as const) {
      const id = await criarImovelPronto(ids.dono, `Studio T261 ${chave} ${sufixo}`, { ativo: true, preco: 2500 });
      const { error } = await adm().from("properties").update({ lat: HC.lat + dLat, lng: HC.lng }).eq("id", id);
      if (error) throw error;
      ids[chave] = id;
    }
    const { data: hc } = await adm().from("destinos").select("lat, lng, ativo").eq("slug", "hc-ufu").single();
    hcAntes = hc as typeof hcAntes;
    await adm().from("destinos").update({ lat: HC.lat, lng: HC.lng, ativo: true }).eq("slug", "hc-ufu");
    const { data: vazio, error: eVazio } = await adm()
      .from("destinos")
      .insert({ slug: `lab-t261-${sufixo}`, nome: `Clínica Lab ${sufixo}`, artigo: "a", tipo: "outro", cidade: "Araguari", uf: "MG", lat: -18.64, lng: -48.19, ativo: true })
      .select("id")
      .single();
    if (eVazio) throw eVazio;
    ids.vazio = vazio.id as string;
    await limparRotas();
  });

  test.afterAll(async () => {
    if (hcAntes) await adm().from("destinos").update(hcAntes).eq("slug", "hc-ufu");
    if (ids.vazio) await adm().from("destinos").delete().eq("id", ids.vazio);
    if (ids.medica) await adm().from("profiles").update({ local_trabalho: null }).eq("id", ids.medica);
    await limparRotas();
    await apagarContas([ids.medica, ids.dono]);
  });

  for (const largura of [390, 1280]) {
    test(`1) HC-UFU + carro + até 20: só os de dentro, em ordem, com o tempo no cartão (${largura})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/buscar?destino=hc-ufu&modo=carro&ate=20", { waitUntil: "domcontentloaded" });
      const lista = await temposNaTela(page);
      const ordem = lista.map(([id]) => id);
      expect(ordem, "o de ~10 min aparece").toContain(ids.perto);
      expect(ordem, "o de ~20 min aparece").toContain(ids.medio);
      expect(ordem, "o de ~45 min fica de fora do 'até 20'").not.toContain(ids.longe);
      expect(ordem.indexOf(ids.perto!)).toBeLessThan(ordem.indexOf(ids.medio!));
      for (const [, texto] of lista) {
        expect(texto).toMatch(/^(~\d+|menos de 5) min de carro até o HC-UFU$/);
        expect(minutos(texto)).toBeLessThanOrEqual(20);
      }
      const faixas = lista.map(([, t]) => faixa(minutos(t)));
      expect(faixas, "ordem 'Mais perto do trabalho' pelas faixas de minutos").toEqual([...faixas].sort((a, b) => a - b));
      await expect(page).toHaveURL(/destino=hc-ufu&modo=carro&ate=20/);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t261-busca-destino-${largura}.png` });
      // Print do cartão: recorte da página (o print do elemento espera o cartão "parar", e a foto do cartão não para).
      const cartao = page.locator(`[data-testid="card-resultado"][data-id="${ids.perto}"]`);
      await cartao.scrollIntoViewIfNeeded();
      const caixa = await cartao.boundingBox();
      if (caixa) await page.screenshot({ path: `${SAIDA}/t261-cartao-${largura}.png`, clip: caixa });
      await ctx.close();
    });
  }

  test("2) endereço digitado: calcula sob demanda e a 2ª busca vem do cache; URL com 2 casas e sem número", async ({ page }) => {
    await limparRotas();
    await page.goto(`/buscar?dlat=${HC.lat + 0.01}&dlng=${HC.lng}&drot=${encodeURIComponent("Rua do Lab, 123 - Centro")}&modo=a_pe`, { waitUntil: "domcontentloaded" });
    const lista = await temposNaTela(page);
    expect(lista.find(([id]) => id === ids.perto)?.[1]).toMatch(/min a pé até Rua do Lab, Centro$/);
    const depoisDaPrimeira = await chamadas();
    expect(depoisDaPrimeira, "a 1ª busca chama o provedor").toBeGreaterThan(0);
    await expect(page).toHaveURL(/dlat=-18\.69&dlng=-48\.10&drot=Rua\+do\+Lab%2C\+Centro/);
    expect(new URL(page.url()).search, "nem o número da casa na URL").not.toContain("123");
    await page.reload({ waitUntil: "domcontentloaded" });
    await temposNaTela(page);
    expect(await chamadas(), "a 2ª busca vem do cache (nenhuma chamada nova)").toBe(depoisDaPrimeira);
  });

  for (const largura of [390, 1280]) {
    test(`3) página do imóvel: "Tempo até" com o destino da busca e os cadastrados da cidade (${largura})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto(`/imoveis/${ids.perto}?destino=hc-ufu&modo=carro`, { waitUntil: "domcontentloaded" });
      const bloco = page.getByTestId("tempo-ate");
      await expect(bloco).toBeVisible({ timeout: 20_000 });
      await expect(bloco.locator('[data-busca="1"]')).toContainText(/min de carro até o HC-UFU/);
      await expect(bloco).toContainText(/min a pé até o HC-UFU/);
      await expect(bloco).not.toContainText(/-18\.|-48\./);
      // E31: destino de outra cidade (a clínica do lab, em Araguari) não entra no bloco do anúncio.
      await expect(bloco).not.toContainText(`Clínica Lab ${sufixo}`);
      await bloco.scrollIntoViewIfNeeded();
      await semRolagemLateral(page);
      await bloco.screenshot({ path: `${SAIDA}/t261-imovel-tempo-ate-${largura}.png` });
      await ctx.close();
    });
  }

  test("4) 'Meu local de trabalho' salvo vira o destino padrão da busca", async ({ browser }) => {
    const page = await entrar(browser as Browser, medica.email, senha);
    await page.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    const bloco = page.getByTestId("meu-local-trabalho").last();
    await bloco.getByTestId("destino-hc-ufu").click({ timeout: 20_000 });
    await bloco.getByTestId("salvar-local-trabalho").click();
    await expect(bloco.getByRole("status")).toHaveText("Local de trabalho salvo.");
    await expect(bloco.getByTestId("local-salvo")).toContainText("HC-UFU");
    await bloco.screenshot({ path: `${SAIDA}/t261-perfil-local-trabalho-390.png` });
    const { data } = await adm().from("profiles").select("local_trabalho").eq("id", ids.medica!).single();
    expect((data?.local_trabalho as { rotulo: string } | null)?.rotulo).toBe("HC-UFU");
    await page.goto("/buscar", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/destino=hc-ufu/, { timeout: 15_000 });
    await temposNaTela(page);
    await page.context().close();
  });

  for (const largura of [390, 1280]) {
    test(`5) /imoveis-perto-de: com imóvel é indexável; sem imóvel, noindex e "Avise-me" (${largura})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/imoveis-perto-de/hc-ufu", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Imóveis mobiliados perto do HC-UFU");
      expect(await page.locator('meta[name="robots"]').first().getAttribute("content")).not.toMatch(/noindex/);
      const cartoes = page.getByTestId("perto-de-cartao");
      expect(await cartoes.count()).toBeGreaterThanOrEqual(3);
      await expect(page.getByTestId("perto-de-anuncios")).toContainText(/min de carro até o HC-UFU/);
      // As duas páginas ficam, com papéis distintos e links entre elas (decisão do Muse, 21/10).
      await expect(page.getByTestId("perto-de-polo").getByRole("link")).toHaveAttribute("href", "/cidades/uberlandia/hc-ufu-umuarama");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t261-perto-de-hc-ufu-${largura}.png` });

      await page.goto(`/imoveis-perto-de/lab-t261-${sufixo}`, { waitUntil: "domcontentloaded" });
      expect(await page.locator('meta[name="robots"]').first().getAttribute("content")).toMatch(/noindex/);
      const avise = page.getByTestId("perto-de-avise-me");
      await expect(page.getByTestId("perto-de-avise-me-texto")).toHaveText(`Avise-me quando surgir um imóvel perto da Clínica Lab ${sufixo}.`);
      await expect(avise).toHaveText("Avise-me");
      await expect(avise).toHaveAttribute("href", new RegExp(`destino=lab-t261-${sufixo}`));
      await semRolagemLateral(page);
      await ctx.close();
    });
  }

  test("6) provedor fora: 'em linha reta', nunca minutos", async ({ page }) => {
    await fetch(`${ROTAS}/__falhas`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vezes: 100 }) });
    try {
      await page.goto(`/buscar?dlat=${HC.lat + 0.03}&dlng=${HC.lng + 0.03}&drot=Rua+Sem+Rota&modo=carro&ate=20`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("tempo-indisponivel")).toBeVisible({ timeout: 20_000 });
      const lista = await temposNaTela(page);
      expect(lista.map(([id]) => id)).toEqual(expect.arrayContaining([ids.perto, ids.medio, ids.longe]));
      for (const [, texto] of lista) {
        expect(texto).toMatch(/^≈ [\d,]+ (km|m) em linha reta até Rua Sem Rota$/);
        expect(texto).not.toMatch(/min/);
      }
      // Sem tempo de rota, o "até 20 min" não esconde ninguém (o de ~45 min continua, em linha reta).
      expect(lista.map(([id]) => id)).toContain(ids.longe);
    } finally {
      await limparRotas();
    }
  });

  test("admin: /admin/destinos com o ativo, o sem ponto travado e os mais buscados", async ({ browser }) => {
    test.skip(!hasAccount("admin"), "sem conta admin de teste");
    for (const largura of [390, 1280]) {
      const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
      const page = await ctx.newPage();
      await page.goto("/admin/destinos", { waitUntil: "domcontentloaded" });
      const hc = page.locator('[data-testid="destino-linha"][data-slug="hc-ufu"]');
      await expect(hc).toContainText("Ativo");
      await expect(page.locator('[data-testid="destino-linha"][data-slug="ufu-umuarama"]').getByTestId("alternar-destino")).toBeDisabled();
      await expect(page.getByTestId("destinos-mais-buscados")).toContainText("HC-UFU");
      // E31: com o provedor de rotas (no lab, o falso), o admin vê "ligado" e nenhuma variável faltando.
      await expect(page.getByTestId("destinos-provedor")).toHaveAttribute("data-ok", "1");
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t261-admin-destinos-${largura}.png` });
      await ctx.close();
    }
  });

  test("admin (E32): editar só o nome mantém o ponto e o ativo", async ({ browser }) => {
    test.skip(!hasAccount("admin"), "sem conta admin de teste");
    const ctx = await browser.newContext({ storageState: authFile("admin"), viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    // Abre a lista primeiro e clica em "Editar" (o caminho do defeito: o formulário de cadastro já montado).
    await page.goto("/admin/destinos", { waitUntil: "domcontentloaded" });
    await page.locator(`[data-testid="destino-linha"][data-slug="lab-t261-${sufixo}"]`).getByRole("link", { name: "Editar" }).click();
    const form = page.getByTestId("destino-form");
    await expect(form.locator('input[name="slug"]')).toHaveValue(`lab-t261-${sufixo}`);
    await expect(page.getByTestId("destino-lat")).toHaveValue(/^-18\.64/);
    await expect(page.getByTestId("destino-lng")).toHaveValue(/^-48\.19/);
    await form.getByLabel("Nome").fill(`Clínica Lab — Centro ${sufixo}`);
    await page.getByTestId("salvar-destino").click();
    await expect(form.getByRole("status")).toContainText("salvo.");
    const { data } = await adm().from("destinos").select("nome, lat, lng, ativo").eq("id", ids.vazio!).single();
    expect(data).toMatchObject({ nome: `Clínica Lab — Centro ${sufixo}`, ativo: true });
    expect(Number(data!.lat)).toBeCloseTo(-18.64, 4);
    expect(Number(data!.lng)).toBeCloseTo(-48.19, 4);
    await ctx.close();
  });
});
