import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, aceitarTermoIaSePreciso } from "../fixtures/laboratorio";
import { abrirSecoesPasso10 } from "../fixtures/cadastro";

/*
  T653 — E251: Passo 10 (Revisão) em duas colunas (desenho aprovado pelo coordenador em 29/10). 1280 e 390, com prints.
   1. 1280: à esquerda "Antes de publicar" (lista + seções em acordeão, fechadas); à direita a prévia FIXA (sticky) com
      Mensal · Total por mês (com contas) · Total do contrato e UM "Publicar anúncio" (o rodapé fica sem primário),
      travado com o motivo em UMA linha. A seção que falta abre no lugar; tocar no motivo abre o que falta.
   2. 390: coluna única — a lista primeiro, a prévia recolhida ("Ver como fica o anúncio") e "Publicar anúncio" no
      rodapé fixo, com o motivo em uma linha logo acima.
   3. As regras não mudam: sem os 12 itens do essencial o Publicar trava ("padrão mínimo de conforto"); convenção "Não"
      trava ("declarações do imóvel"); "Não sei" publica com pendência (libera com o aceite).
*/
const SAIDA = "tests/laboratorio/saida";
const FOTOS_LOCAIS = ["sala", "quarto", "cozinha", "banheiro", "fachada", "sala", "quarto", "cozinha"];

/** Uma linha só: a altura do motivo não passa de uma linha e meia do próprio texto. */
const umaLinha = (p: Page) =>
  p.getByTestId("publicar-motivo").evaluate((el) => {
    const cs = getComputedStyle(el);
    const linha = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
    return (el as HTMLElement).getBoundingClientRect().height <= linha * 1.5;
  });

test.describe("T653 — E251: Passo 10 em duas colunas", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t653.${sufixo}@lab.vivanomads.test`, nome: "Rui Colunas", role: "owner" as const };
  const ids: { dono?: string; imovel?: string } = {};

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio no Centro ${sufixo}`);
    // Fotos do acervo local (carregam de verdade no laboratório) no lugar do armazenamento.
    const fotos = FOTOS_LOCAIS.map((n, i) => ({ id: `lab-${i}`, url: `/images/imoveis/placeholder-imovel-${n}.webp`, name: "", path: `${ids.dono}/${ids.imovel}-${i}.webp`, demo: false }));
    const { error } = await adm()
      .from("properties")
      .update({
        draft_data: {
          title: `Studio no Centro ${sufixo}`,
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
          garantias: { caucao: true },
          privacidade: { semCamerasInterior: true, camerasExternas: false, tipoAcesso: "chave", senhaTrocadaEstadia: false },
          ownershipType: "own",
          subleaseAuthorized: false,
          photos: fotos,
          iaAnalisadas: fotos.map((f) => f.url),
          step: 9,
          ordemEtapas: 5,
          etapaMax: 9,
        },
      })
      .eq("id", ids.imovel!);
    if (error) throw error;
    const { error: eQual } = await adm()
      .from("qualification_checklists")
      .update({ document_path: `${ids.dono}/${ids.imovel}-documento.png`, formulario: { versao: 1, elig: { furnished: true, accepts30days: true, iptuOk: true, habitable: true, isOwnerOrAgent: true, condoAllows: "yes" } } })
      .eq("property_id", ids.imovel!);
    if (eQual) throw eQual;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono!]);
  });

  async function abrir(w: number, browser: Parameters<typeof entrar>[0]): Promise<Page> {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    await p.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("etapa-revisar").waitFor({ timeout: 30_000 });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return p;
  }

  test("1. 1280 px: lista e acordeão à esquerda; prévia fixa com os três preços e um Publicar travado com o motivo", async ({ browser }) => {
    const p = await abrir(1280, browser);
    const lista = p.getByTestId("passo10-coluna-lista");
    const previa = p.getByTestId("passo10-coluna-previa");
    await expect(lista).toContainText("Antes de publicar");
    expect((await lista.boundingBox())!.x, "lista à esquerda").toBeLessThan((await previa.boundingBox())!.x);
    expect(await previa.evaluate((el) => getComputedStyle(el).position), "prévia fixa").toBe("sticky");
    await expect(p.getByTestId("previa-recolhida")).toBeHidden();
    // Os três nomes fixos do preço.
    await expect(p.getByTestId("previa-preco-mensal")).toContainText(/Mensal\s*R\$\s?3\.200/);
    await expect(p.getByTestId("previa-preco-total-mes")).toContainText("Total por mês (com contas)");
    await expect(p.getByTestId("previa-preco-total-contrato")).toContainText("Total do contrato");
    // Um Publicar só, na coluna da prévia; o rodapé fica sem primário.
    await expect(p.getByTestId("publicar-anuncio")).toHaveCount(1);
    await expect(previa.getByTestId("publicar-anuncio")).toBeDisabled();
    await expect(p.getByTestId("assistente-rodape").getByTestId("publicar-anuncio")).toHaveCount(0);
    // Travado (falta o aceite do termo da IA): o motivo em UMA linha.
    await expect(previa.getByTestId("publicar-motivo")).toHaveText("Falta: aceite do termo da IA");
    expect(await umaLinha(p), "motivo em uma linha").toBe(true);
    // Acordeão: as seções chegam fechadas, com estado; a que falta abre no lugar.
    for (const s of ["operacao", "identidade", "documento", "declaracoes"]) await expect(p.getByTestId(`antes-secao-${s}`)).toHaveAttribute("data-aberta", "0");
    await expect(p.getByTestId("antes-secao-documento")).toHaveAttribute("data-estado", "ok");
    await expect(p.getByTestId("antes-conteudo-declaracoes")).toBeHidden();
    await p.getByTestId("antes-secao-declaracoes-abrir").click();
    await expect(p.getByTestId("antes-conteudo-declaracoes")).toBeVisible();
    await expect(p.getByTestId("declaracao-iptu")).toBeVisible();
    await p.screenshot({ path: `${SAIDA}/t653-revisao-1280.png` });
    // Com o aceite, o Publicar libera e o motivo some.
    await aceitarTermoIaSePreciso(p);
    await expect(previa.getByTestId("publicar-anuncio")).toBeEnabled({ timeout: 10_000 });
    await expect(p.getByTestId("publicar-motivo")).toHaveCount(0);
    await p.context().close();
  });

  test("2. 390 px: a lista primeiro, a prévia recolhida e o Publicar no rodapé fixo, com o motivo em uma linha", async ({ browser }) => {
    const p = await abrir(390, browser);
    const lista = p.getByTestId("passo10-coluna-lista");
    const recolhida = p.getByTestId("previa-recolhida");
    await expect(recolhida).toBeVisible();
    await expect(recolhida).toHaveText(/Ver como fica o anúncio/);
    await expect(p.getByTestId("revisao-cartao")).toBeHidden();
    expect((await lista.boundingBox())!.y, "a lista vem antes da prévia").toBeLessThan((await recolhida.boundingBox())!.y);
    // O Publicar mora no rodapé fixo (no lugar do "Continuar"), e é o único.
    const rodape = p.getByTestId("assistente-rodape");
    await expect(rodape.getByTestId("publicar-anuncio")).toBeVisible();
    await expect(p.getByTestId("publicar-anuncio")).toHaveCount(1);
    await expect(rodape.getByTestId("cadastro-continuar")).toHaveCount(0);
    expect(await rodape.evaluate((el) => getComputedStyle(el).position)).toBe("fixed");
    await expect(rodape.getByTestId("publicar-anuncio")).toBeDisabled();
    await expect(p.getByTestId("publicar-motivo")).toHaveText("Falta: aceite do termo da IA");
    expect(await umaLinha(p), "motivo em uma linha").toBe(true);
    await p.screenshot({ path: `${SAIDA}/t653-revisao-390.png`, fullPage: true });
    // A prévia abre com os três preços.
    await recolhida.click();
    await expect(p.getByTestId("revisao-cartao")).toBeVisible();
    await expect(p.getByTestId("previa-preco-total-contrato")).toContainText("Total do contrato");
    await p.getByTestId("revisao-cartao").screenshot({ path: `${SAIDA}/t653-previa-aberta-390.png` });
    expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await p.context().close();
  });

  test("3. as regras não mudam: sem os 12 itens trava; convenção 'Não' trava; 'Não sei' publica com pendência", async ({ browser }) => {
    const p = await abrir(1280, browser);
    await aceitarTermoIaSePreciso(p);
    const publicar = p.getByTestId("passo10-coluna-previa").getByTestId("publicar-anuncio");
    await abrirSecoesPasso10(p, ["declaracoes"]);
    // Convenção "Não": trava, com o motivo das declarações.
    await p.getByTestId("convencao-no").click();
    await expect(publicar).toBeDisabled();
    await expect(p.getByTestId("publicar-motivo")).toHaveText(/^Falta: declarações do imóvel/);
    await expect(p.getByTestId("antes-secao-declaracoes")).toHaveAttribute("data-estado", "falta");
    await p.screenshot({ path: `${SAIDA}/t653-convencao-nao-1280.png` });
    // "Não sei": publica com pendência.
    await p.getByTestId("convencao-unknown").click();
    await expect(publicar).toBeEnabled({ timeout: 10_000 });
    await expect(p.getByTestId("antes-secao-declaracoes")).toHaveAttribute("data-estado", "ok");
    // Sem os 12 itens do essencial: trava, e o motivo leva ao padrão mínimo.
    const { error } = await adm().from("conforto_declaracoes").delete().eq("property_id", ids.imovel!);
    expect(error).toBeNull();
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.getByTestId("etapa-revisar").waitFor({ timeout: 30_000 });
    await expect(publicar).toBeDisabled({ timeout: 20_000 });
    await expect(p.getByTestId("publicar-motivo")).toHaveText(/^Falta: padrão mínimo de conforto/);
    await p.screenshot({ path: `${SAIDA}/t653-sem-essencial-1280.png` });
    await p.context().close();
  });
});
