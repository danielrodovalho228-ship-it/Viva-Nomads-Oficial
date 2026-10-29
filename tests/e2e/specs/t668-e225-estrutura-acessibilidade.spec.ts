import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { NO_LABORATORIO, URL_SUPABASE, CHAVE_ANON, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T668 — E225-A: estrutura de acessibilidade no cadastro, SEM selo que minta. 1280 e 390, com prints.
   1. Passo 5: no fim, o toggle "O imóvel tem estrutura de acessibilidade?" (padrão E56) nasce desligado e não mostra
      nada; ligado, abre os 8 itens em dois grupos (Acessibilidade e Mobilidade reduzida), com a linha de critério;
      cada toque grava (imovel_estrutura); desligar apaga. Também no editar.
   2. Anúncio público: "Estrutura informada pelo proprietário" lista SÓ os itens "sim", com a nota "Informado pelo
      proprietário. Confirme na visita."; com os 4 itens do Acessível marcados e SEM prova, o selo NÃO aparece.
   3. Nada marcado (ou toggle desligado): a seção não aparece no anúncio.
   4. Leitura pública só de anúncio ativo (RLS da 0228): o anônimo não lê a estrutura de um rascunho.
*/
const SAIDA = "tests/laboratorio/saida";
const ACESSIVEL = ["entradaSemDegrauOuRampa", "elevadorOuTerreo", "portas80cm", "banheiroAdaptado"];
/** Os 4 itens do Acessível + box sem degrau marcados (sem prova nenhuma); piso antiderrapante marcado como "não". */
const CHECKLIST_ATIVO = { ...Object.fromEntries(ACESSIVEL.map((k) => [k, true])), boxSemDegrau: true, pisoAntiderrapante: false };
const FOTOS_LOCAIS = ["sala", "quarto", "cozinha", "banheiro", "fachada", "sala", "quarto", "cozinha"];

test.describe("T668 — E225-A: estrutura de acessibilidade, sem selo que minta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t668.${sufixo}@lab.vivanomads.test`, nome: "Lia Estrutura", role: "owner" as const };
  const ids: { dono?: string; rascunho?: string; ativo?: string; vazio?: string } = {};

  const checklistDe = async (id: string) => (await adm().from("imovel_estrutura").select("checklist").eq("property_id", id).maybeSingle()).data?.checklist ?? null;

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await criarImovelPronto(ids.dono, `Studio Estrutura ${sufixo}`);
    const fotos = FOTOS_LOCAIS.map((n, i) => ({ id: `lab-${i}`, url: `/images/imoveis/placeholder-imovel-${n}.webp`, name: "", path: `${ids.dono}/${ids.rascunho}-${i}.webp`, demo: false }));
    const { error } = await adm()
      .from("properties")
      .update({
        draft_data: {
          title: `Studio Estrutura ${sufixo}`,
          description: "Studio mobiliado no Centro, com home office, internet rápida e cozinha completa. Pronto para morar.",
          propertyType: "studio",
          tipoEntrada: "porteiro",
          internetMbps: "300",
          bedrooms: "1",
          bathrooms: "1",
          areaM2: "40",
          maxGuests: "2",
          minPeriod: "30",
          maxPeriod: "180",
          monthlyPrice: "3200",
          street: "Rua Santos Dumont",
          numero: "100",
          neighborhood: "Centro",
          city: "Uberlândia",
          uf: "MG",
          cep: "38400-060",
          photos: fotos,
          step: 4,
          etapaMax: 9,
        },
      })
      .eq("id", ids.rascunho);
    if (error) throw error;
    ids.ativo = await criarImovelPronto(ids.dono, `Apartamento Rampa ${sufixo}`, { ativo: true });
    ids.vazio = await criarImovelPronto(ids.dono, `Apartamento Sem Estrutura ${sufixo}`, { ativo: true });
    // Gravado ANTES de qualquer visita: a página pública guarda cache (revalidate de 60 s; na tela, salvar revalida).
    const { error: eAtivo } = await adm().from("imovel_estrutura").upsert({ property_id: ids.ativo, checklist: CHECKLIST_ATIVO }, { onConflict: "property_id" });
    if (eAtivo) throw eAtivo;
    const { error: eVazio } = await adm().from("imovel_estrutura").upsert({ property_id: ids.vazio, checklist: { portas80cm: false } }, { onConflict: "property_id" });
    if (eVazio) throw eVazio;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  async function abrirPasso5(w: number, browser: Parameters<typeof entrar>[0]): Promise<Page> {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    await p.goto(`/dashboard/imoveis/novo?draft=${ids.rascunho}&etapa=comodidades`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("estrutura-acessibilidade").waitFor({ timeout: 30_000 });
    return p;
  }

  test("1. Passo 5 (1280 e 390): desligado não mostra nada; ligado abre os 8 itens com critério e grava; desligar apaga", async ({ browser }) => {
    for (const w of [1280, 390]) {
      const p = await abrirPasso5(w, browser);
      const bloco = p.getByTestId("bloco-estrutura");
      await expect(bloco).toHaveAttribute("data-ligado", "nao");
      await expect(bloco).toContainText("O imóvel tem estrutura de acessibilidade?");
      await expect(p.getByTestId("bloco-estrutura-conteudo")).toHaveCount(0);
      await expect(p.locator('[data-testid^="estrutura-item-"]')).toHaveCount(0);
      // Ligado: os dois grupos e os 8 itens, cada um com a linha de critério.
      await p.getByTestId("bloco-estrutura-toggle").click();
      await expect(p.getByTestId("estrutura-grupo-acessibilidade")).toContainText("Acessibilidade");
      await expect(p.getByTestId("estrutura-grupo-mobilidadeReduzida")).toContainText("Mobilidade reduzida");
      await expect(p.locator('[data-testid^="estrutura-item-"]')).toHaveCount(8);
      await expect(p.getByTestId("estrutura-grupo-acessibilidade")).toContainText("Portas com pelo menos 80 cm de vão livre");
      await p.getByTestId("estrutura-item-portas80cm").click();
      await expect(p.getByTestId("estrutura-acessibilidade")).toHaveAttribute("data-estado", "salvo");
      await p.getByTestId("estrutura-item-boxSemDegrau").click();
      await expect(p.getByTestId("estrutura-item-boxSemDegrau")).toHaveAttribute("aria-checked", "true");
      await expect(p.getByTestId("estrutura-acessibilidade")).toHaveAttribute("data-estado", "salvo");
      await expect.poll(() => checklistDe(ids.rascunho!)).toMatchObject({ portas80cm: true, boxSemDegrau: true });
      await bloco.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t668-passo5-${w}.png`, fullPage: w === 390 });
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      // Desligar (com dados) pede confirmação na própria tela e apaga.
      await p.getByTestId("bloco-estrutura-toggle").click();
      await p.getByTestId("bloco-estrutura-confirmar-desligar").click();
      await expect(bloco).toHaveAttribute("data-ligado", "nao");
      await expect.poll(() => checklistDe(ids.rascunho!)).toEqual({});
      await p.context().close();
    }
  });

  test("1b. editar: a mesma estrutura, com o que já foi marcado (nasce ligada)", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto(`/dashboard/imoveis/${ids.ativo}/editar`, { waitUntil: "domcontentloaded" });
    const secao = p.getByTestId("secao-estrutura");
    await secao.getByRole("button", { name: /Estrutura de acessibilidade/ }).click();
    await expect(secao.getByTestId("bloco-estrutura")).toHaveAttribute("data-ligado", "sim", { timeout: 20_000 });
    await expect(secao.getByTestId("estrutura-item-portas80cm")).toHaveAttribute("aria-checked", "true");
    await secao.screenshot({ path: `${SAIDA}/t668-editar-1280.png` });
    await p.context().close();
  });

  test("2. anúncio (1280 e 390): só os itens 'sim', com a nota; os 4 do Acessível SEM prova → nenhum selo", async ({ browser }) => {
    for (const w of [1280, 390]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: w === 1280 ? 900 : 844 } });
      const p = await ctx.newPage();
      await p.goto(`/imoveis/${ids.ativo}`, { waitUntil: "domcontentloaded" });
      const sec = p.getByTestId("estrutura-informada");
      await expect(sec).toBeVisible({ timeout: 30_000 });
      await expect(sec.getByRole("heading", { name: "Estrutura informada pelo proprietário" })).toBeVisible();
      await expect(sec.getByTestId("estrutura-item")).toHaveCount(5);
      await expect(sec).toContainText("Portas largas");
      await expect(sec).toContainText("Box sem degrau");
      await expect(sec).not.toContainText("Piso antiderrapante");
      await expect(sec.getByTestId("estrutura-nota")).toHaveText("Informado pelo proprietário. Confirme na visita.");
      // Sem prova aprovada de cada item, o selo não aparece em lugar nenhum da página.
      await expect(p.getByTestId("estrutura-selos")).toHaveCount(0);
      await expect(p.getByText(/^Acessível$/)).toHaveCount(0);
      await expect(p.getByText(/Perto de (hospital|universidade)/)).toHaveCount(0);
      await sec.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t668-anuncio-${w}.png` });
      await ctx.close();
    }
  });

  test("3. nada marcado: a seção não aparece no anúncio", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`/imoveis/${ids.vazio}`, { waitUntil: "domcontentloaded" });
    await expect(p.locator("#comodidades")).toBeAttached({ timeout: 30_000 });
    await expect(p.getByTestId("estrutura-informada")).toHaveCount(0);
    await ctx.close();
  });

  test("4. leitura pública só de anúncio ativo: o anônimo lê a do ativo e não lê a do rascunho", async () => {
    const { error } = await adm().from("imovel_estrutura").upsert({ property_id: ids.rascunho, checklist: { portas80cm: true } }, { onConflict: "property_id" });
    expect(error).toBeNull();
    const anon = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const rascunho = await anon.from("imovel_estrutura").select("property_id").eq("property_id", ids.rascunho!);
    expect(rascunho.data ?? []).toHaveLength(0);
    const ativo = await anon.from("imovel_estrutura").select("property_id").eq("property_id", ids.ativo!);
    expect(ativo.data ?? []).toHaveLength(1);
    // E o anônimo não grava (só o servidor grava, depois de conferir o dono).
    const grava = await anon.from("imovel_estrutura").upsert({ property_id: ids.ativo, checklist: {} });
    expect(grava.error).not.toBeNull();
  });
});
