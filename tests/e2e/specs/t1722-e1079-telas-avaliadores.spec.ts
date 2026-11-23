import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, cnpjAleatorio, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1722 — E1079/E1080 (ORDEM-DUET-385/386): as 4 telas do avaliador, com print a 390 e 1280 px ao lado dos mockups
  aprovados (docs/mockups-avaliadores/). Só contas de teste; cidade própria do spec (Patrocínio, que nenhum outro spec
  do laboratório usa), para não pôr avaliador no rodízio das cidades dos outros specs.
   1. Listagem por cidade (/avaliadores/patrocinio) — aberta só no laboratório — e o perfil público do avaliador.
   2. Tela 4: o cartão "Avaliação do imóvel" na grade de Serviços, só para o dono com a avaliação aberta (piloto).
      A trava morde: fora do piloto, o cartão some.
   3. Tela 3: o dono pede a avaliação e escolhe em cartões — iniciais, selo, nº, termos e "Avaliação: R$ 350" (a tabela
      da cidade para o porte do imóvel).
*/
const LARGURAS = [390, 1280] as const;
const SAIDA = "tests/laboratorio/saida";
const CIDADE = "Patrocínio";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1722.${sufixo}@lab.vivanomads.test`, nome: "Dalva Teste", role: "owner" as const };
const aval = { email: `aval.t1722.${sufixo}@lab.vivanomads.test`, nome: "Artur Teste", role: "tenant" as const };
const ids: Record<string, string> = {};
let numero = "";

async function largura(page: Page, w: number) {
  await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
}
async function semRolagemLateral(page: Page) {
  const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(sobra, "sem rolagem lateral").toBeLessThanOrEqual(1);
}

test.describe("T1722 — E1079/E1080: as telas do avaliador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.aval = await criarConta(aval, senha);
    for (const uid of [ids.dono, ids.aval]) {
      const t = await adm().from("profiles").update({ is_teste: true }).eq("id", uid);
      if (t.error) throw t.error;
    }
    const { data: parc, error: eP } = await adm()
      .from("parceiros")
      .insert({ user_id: ids.aval, tipo_pessoa: "pj", documento: cnpjAleatorio(), nome_publico: aval.nome, slug: `aval-t1722-${sufixo}`, categorias: ["fotografia"], cidades: [CIDADE] })
      .select("id")
      .single();
    if (eP) throw eP;
    ids.parc = parc.id as string;
    const { data: n } = await adm().rpc("proximo_numero_avaliador", { p_sigla: "UDI" });
    numero = n as string;
    const { error: eC } = await adm().from("avaliadores_credenciamento").insert({ parceiro_id: ids.parc, cidade: CIDADE, numero_credenciado: numero, status: "ativo", experiencia_link: "https://portfolio.lab.vivanomads.test/t1722", conduta_versao: "2026-10-23", ativado_em: "2025-01-01T00:00:00Z" });
    if (eC) throw eC;
    // Imóvel de 1 quarto (porte "1 ou 2 quartos") na cidade do spec, publicado; a tabela da cidade com os 3 portes.
    ids.imovel = await criarImovelPronto(ids.dono, `Casa t1722 ${sufixo}`, { ativo: true });
    const c = await adm().from("properties").update({ city: CIDADE }).eq("id", ids.imovel);
    if (c.error) throw c.error;
    const { error: eT } = await adm()
      .from("vistoria_precos")
      .insert(["estudio", "q1_2", "q3_mais"].map((porte) => ({ cidade: CIDADE, porte, valor: porte === "q1_2" ? 350 : 300 })));
    if (eT) throw eT;
    const p = await adm().from("vistoria_piloto").insert({ user_id: ids.dono, nota: "T1722 (laboratório)" });
    if (p.error) throw p.error;
    // E1077: no piloto, o dono só vê avaliadores que também estão na lista do piloto (filaNoAmbito).
    const pa = await adm().from("vistoria_piloto").insert({ user_id: ids.aval, nota: "T1722 (laboratório)" });
    if (pa.error) throw pa.error;
  });

  test.afterAll(async () => {
    if (ids.imovel) await adm().from("vistoria_pedidos").delete().eq("property_id", ids.imovel);
    await adm().from("vistoria_precos").delete().eq("cidade", CIDADE);
    if (ids.dono) await adm().from("vistoria_piloto").delete().eq("user_id", ids.dono);
    if (ids.aval) await adm().from("vistoria_piloto").delete().eq("user_id", ids.aval);
    if (ids.parc) {
      const cred = ((await adm().from("avaliadores_credenciamento").select("id").eq("parceiro_id", ids.parc)).data ?? []).map((x) => x.id as string);
      if (cred.length) await adm().from("vistoria_designacoes").delete().in("avaliador_id", cred);
      await adm().from("avaliadores_credenciamento").delete().eq("parceiro_id", ids.parc);
    }
    if (ids.imovel) await adm().from("properties").delete().eq("id", ids.imovel);
    await apagarContas([ids.aval, ids.dono].filter(Boolean));
  });

  test("1. listagem por cidade e perfil público (telas 1 e 2)", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    for (const w of LARGURAS) {
      await largura(page, w);
      await page.goto("/avaliadores/patrocinio", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("vitrine-titulo")).toHaveText(`Avaliadores em ${CIDADE}`, { timeout: 25_000 });
      const cartao = page.locator(`[data-testid="vitrine-cartao"][data-numero="${numero}"]`);
      // A listagem pública mostra o nome curto (o primeiro nome) e as iniciais dele.
      await expect(cartao.getByTestId("vitrine-nome")).toHaveText("Artur");
      await expect(cartao.getByTestId("vitrine-iniciais")).toHaveText(/^A/);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t1722-1-listagem-${w}.png`, fullPage: true });

      await page.goto(`/avaliadores/${numero}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("avaliador-publico")).toBeVisible({ timeout: 25_000 });
      await expect(page.getByTestId("avaliador-numero")).toHaveText(numero);
      // O perfil do credenciado no desenho do mockup: a faixa da foto (conta de teste sem foto → iniciais), a cidade com
      // a UF, a faixa de teste e o preço da tabela da cidade por porte.
      await expect(page.getByTestId("avaliador-foto")).toBeVisible();
      await expect(page.getByTestId("avaliador-cidade")).toHaveText(CIDADE);
      await expect(page.getByTestId("avaliador-uf")).toHaveText("• MG");
      await expect(page.getByTestId("avaliador-teste")).toBeVisible();
      await expect(page.getByTestId("avaliador-preco-linha")).toHaveCount(3);
      await semRolagemLateral(page);
      await page.screenshot({ path: `${SAIDA}/t1722-2-perfil-${w}.png`, fullPage: true });
    }
    await ctx.close();
  });

  test("2. tela 4: o cartão 'Avaliação do imóvel' na grade de Serviços — de todo dono (E1104); fora do piloto leva ao estado honesto", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
      const card = d.getByTestId("servicos-avaliacao");
      await expect(card).toBeVisible({ timeout: 25_000 });
      await expect(card).toContainText("Avaliação do imóvel");
      await expect(card).toContainText("Laudo com o nível do imóvel");
      // E1104 (ORDEM-DUET-470): sem avaliação em curso, o cartão leva à porta (começar o pedido), não à lista de imóveis.
      await expect(card).toHaveAttribute("href", "/dashboard/servicos/avaliacao");
      await card.scrollIntoViewIfNeeded();
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t1722-4-servicos-${w}.png` });
    }
    // E1104 (ORDEM-DUET-470): fora do piloto (sem chave, sem cookie) o cartão continua lá — é a porta de todo dono — e
    // leva ao estado honesto. O que o piloto fecha é a avaliação em si: a porta não mostra pedido nem avaliador.
    await adm().from("vistoria_piloto").delete().eq("user_id", ids.dono);
    await d.goto("/dashboard/servicos", { waitUntil: "domcontentloaded" });
    await expect(d.getByTestId("servicos-grade")).toBeVisible({ timeout: 25_000 });
    await expect(d.getByTestId("servicos-avaliacao")).toHaveAttribute("href", "/dashboard/servicos/avaliacao");
    await d.getByTestId("servicos-avaliacao").click();
    await expect(d.getByTestId("porta-avaliacao")).toHaveAttribute("data-estado", "a_chegar", { timeout: 25_000 });
    await expect(d.getByTestId("porta-escolher")).toHaveCount(0);
    const p = await adm().from("vistoria_piloto").insert({ user_id: ids.dono, nota: "T1722 (laboratório)" });
    expect(p.error).toBeNull();
    await d.context().close();
  });

  test("3. tela 3: o dono pede e escolhe em cartões — iniciais, selo, nº, termos e o preço da tabela da cidade", async ({ browser }) => {
    const d = await entrar(browser, dono.email, senha);
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    await d.getByTestId("pedir-avaliacao").getByRole("button", { name: "Pedir avaliação do imóvel" }).click({ timeout: 25_000 });
    // Como na t315: o pedido grava no servidor; a escolha aparece ao reabrir a página com o pedido "pedido".
    await expect
      .poll(async () => ((await adm().from("vistoria_pedidos").select("status").eq("property_id", ids.imovel).maybeSingle()).data?.status as string | undefined) ?? "", { timeout: 20_000 })
      .toBe("pedido");
    await d.goto(`/dashboard/imoveis/${ids.imovel}/nivel`, { waitUntil: "domcontentloaded" });
    const escolha = d.getByTestId("avaliacao-escolha");
    await expect(escolha).toBeVisible({ timeout: 30_000 });
    await expect(escolha.getByTestId("avaliacao-escolha-cidade")).toHaveText(`Avaliadores disponíveis em ${CIDADE}`);
    const cartao = escolha.getByTestId("avaliacao-sugerido").filter({ hasText: `nº ${numero}` });
    await expect(cartao.getByTestId("avaliacao-sugerido-rosto")).toHaveText("AT");
    await expect(cartao.getByTestId("avaliacao-sugerido-selo")).toContainText("Avaliador");
    await expect(cartao.getByTestId("avaliacao-sugerido-termos")).toBeVisible();
    await expect(cartao.getByTestId("avaliacao-sugerido-preco")).toHaveText("Avaliação: R$ 350");
    // E1096 (ORDEM-DUET-453, texto travado alterado com o julgamento do Gerente): o título e o botão do mockup.
    await expect(escolha.getByTestId("avaliacao-escolha-titulo")).toHaveText("Escolher avaliador");
    await expect(cartao.getByRole("button", { name: "Escolher" })).toHaveText("Escolher");
    for (const w of LARGURAS) {
      await largura(d, w);
      await d.reload({ waitUntil: "domcontentloaded" });
      await expect(d.getByTestId("avaliacao-escolha")).toBeVisible({ timeout: 30_000 });
      await d.getByTestId("avaliacao-escolha").scrollIntoViewIfNeeded();
      await semRolagemLateral(d);
      await d.screenshot({ path: `${SAIDA}/t1722-3-escolha-${w}.png` });
    }
    await d.context().close();
  });
});
