import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, aceitarTermoIaSePreciso, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";

/*
  T400 — E102-B: "Não tem internet" na chácara/sítio. Só no laboratório.
   1. Salvar rascunho com "Não tem internet": a opção existe, o rascunho guarda (cadastro e editor) e o tipo de internet
      conta como respondido.
   2. Publicar barrado com o motivo do padrão mínimo, na revisão e no "Falta resolver" (e em Meus imóveis, pelo
      servidor); o Passo 5 mostra "Sem internet no imóvel" no lugar do campo de velocidade, e os Mbps vazios não viram
      um segundo motivo.
   3. Trocar para "Fibra": o campo de velocidade volta a ser pedido; com a velocidade informada, publica.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.e102.${sufixo}@lab.vivanomads.test`, nome: "Nina Sítio", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};
const TITULO = `Chácara Sem Internet ${sufixo}`;
const PONTO = { lat: -18.95, lng: -48.4 };
const MOTIVO = 'Internet: o padrão mínimo da Viva exige internet no imóvel (item "Internet informada" do Essencial).';

const lerRascunho = async () => {
  const { data } = await adm().from("properties").select("status, internet_mbps, draft_data, detalhes_anuncio").eq("id", ids.imovel!).single();
  return data as { status: string; internet_mbps: number | null; draft_data: { chacara?: { internet?: string }; internetMbps?: string } | null; detalhes_anuncio: { chacara?: { internet?: string } } | null };
};

async function abrirCadastro(page: Page, etapa: "detalhes" | "comodidades" | "revisao") {
  await page.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=${etapa}`, { waitUntil: "domcontentloaded" });
  await noPasso(page, etapa, 30_000);
}

test.describe("T400 — E102-B: chácara/sítio sem internet", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, TITULO, { semInternet: true });
    // As 8 fotos que criarImovelPronto subiu (o Publicar sincroniza as fotos do rascunho com o armazenamento).
    const fotos = Array.from({ length: 8 }, (_, i) => {
      const caminho = `${ids.dono}/${ids.imovel}-${i}.png`;
      return { id: `lab-${i}`, url: `https://lab.vivanomads.test/storage/v1/object/public/property-photos/${caminho}`, name: "", path: caminho, demo: false };
    });
    const { error } = await adm()
      .from("properties")
      .update({
        property_type: "chacara",
        detalhes_anuncio: { chacara: { acesso: "terra", internet: "radio", pontoMarcado: true } },
        draft_data: {
          title: TITULO,
          description: "Casa de chácara mobiliada, com home office, cozinha completa e varanda. Pronta para morar por temporada.",
          propertyType: "chacara",
          chacara: { acesso: "terra", internet: "radio", ponto: PONTO },
          amenityKeys: { internet_fibra: true },
          tipoEntrada: "porteiro",
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
      .eq("id", ids.imovel);
    if (error) throw error;
    const { error: eQual } = await adm()
      .from("qualification_checklists")
      .update({ document_path: `${ids.dono}/${ids.imovel}-documento.png`, formulario: { versao: 1, elig: { furnished: true, accepts30days: true, iptuOk: true, habitable: true, isOwnerOrAgent: true, condoAllows: "yes" } } })
      .eq("property_id", ids.imovel!);
    if (eQual) throw eQual;
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. salvar rascunho com 'Não tem internet' (cadastro e editor)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    // Cadastro: a opção existe e o rascunho guarda sozinho.
    await abrirCadastro(page, "detalhes");
    const campos = page.getByTestId("campos-chacara");
    await expect(campos.getByTestId("chacara-internet-nao_tem")).toBeVisible({ timeout: 20_000 });
    await expect(campos.getByTestId("chacara-internet-nao_tem")).toHaveText("Não tem internet");
    await campos.getByTestId("chacara-internet-nao_tem").check();
    // Resposta válida: o tipo de internet conta como respondido.
    await expect(campos).toHaveAttribute("data-falta", "");
    await expect.poll(async () => (await lerRascunho()).draft_data?.chacara?.internet, { timeout: 30_000 }).toBe("nao_tem");

    // Editor: a mesma resposta vai para o anúncio (o servidor aceita "nao_tem").
    await page.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
    const secao = page.getByTestId("secao-detalhes-anuncio");
    await expect(secao).toBeVisible({ timeout: 30_000 });
    if ((await secao.getAttribute("data-aberta")) !== "true") await secao.locator("button").first().click();
    await secao.getByTestId("campos-chacara").getByTestId("chacara-internet-nao_tem").check({ timeout: 20_000 });
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect.poll(async () => (await lerRascunho()).detalhes_anuncio?.chacara?.internet, { timeout: 30_000 }).toBe("nao_tem");
    expect((await lerRascunho()).status).toBe("draft");
    await page.context().close();
  });

  test("2. publicar barrado pelo padrão mínimo, com o motivo certo; o Passo 5 não pede a velocidade", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    // Passo 5: "Sem internet no imóvel" no lugar do campo de velocidade (mesmo com "Internet fibra" marcada).
    await abrirCadastro(page, "comodidades");
    const bloco = page.getByTestId("pronto-trabalhar");
    await expect(bloco.getByTestId("sem-internet-imovel")).toHaveText("Sem internet no imóvel", { timeout: 20_000 });
    await expect(bloco.getByLabel("Velocidade da internet em Mbps")).toHaveCount(0);
    await page.screenshot({ path: "tests/laboratorio/saida/t400-2-passo5-sem-internet.png", fullPage: true });

    // Revisão: o motivo na lista e no "Falta resolver"; nada de "Velocidade da internet"; Publicar travado.
    await abrirCadastro(page, "revisao");
    await aceitarTermoIaSePreciso(page);
    // A lista de conferência: o motivo segura o passo Detalhes (onde se troca a resposta), não as Comodidades.
    const detalhes = page.getByTestId("conferencia-detalhes");
    await expect(detalhes).toHaveAttribute("data-ok", "0", { timeout: 20_000 });
    await expect(detalhes).toHaveAttribute("data-itens", /\bsem_internet\b/);
    await expect(detalhes).toContainText(MOTIVO);
    await expect(page.getByTestId("lista-conferencia")).not.toContainText("Velocidade da internet");
    const falta = page.getByTestId("publicar-falta-outros");
    await expect(falta).toContainText(MOTIVO, { timeout: 20_000 });
    await expect(falta).not.toContainText("Velocidade da internet");
    await expect(page.locator('[data-testid="publicar-anuncio"]:visible')).toBeDisabled();
    await page.screenshot({ path: "tests/laboratorio/saida/t400-2-revisao-barrado.png", fullPage: true });

    // O servidor (o mesmo portão do Publicar) dá o mesmo motivo em Meus imóveis.
    await page.goto("/dashboard/imoveis", { waitUntil: "domcontentloaded" });
    const cartao = page.getByTestId("prontidao").filter({ hasText: MOTIVO });
    await expect(cartao).toHaveCount(1, { timeout: 30_000 });
    await expect(cartao).not.toContainText("Velocidade da internet");
    await page.context().close();
  });

  test("3. trocar para 'Fibra': a velocidade volta a ser pedida; informada, publica", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 1280, height: 900 });
    await abrirCadastro(page, "detalhes");
    await page.getByTestId("campos-chacara").getByTestId("chacara-internet-fibra").check({ timeout: 20_000 });
    await expect.poll(async () => (await lerRascunho()).draft_data?.chacara?.internet, { timeout: 30_000 }).toBe("fibra");
    // Sem a velocidade, o campo volta a ser obrigatório; o motivo da falta de internet sai.
    await abrirCadastro(page, "revisao");
    await expect(page.getByTestId("conferencia-comodidades")).toHaveAttribute("data-itens", /\binternet\b/, { timeout: 20_000 });
    await expect(page.getByTestId("lista-conferencia")).not.toContainText(MOTIVO);
    await expect(page.getByTestId("publicar-falta-outros")).toContainText("Velocidade da internet");

    await abrirCadastro(page, "comodidades");
    const bloco = page.getByTestId("pronto-trabalhar");
    await expect(bloco.getByTestId("sem-internet-imovel")).toHaveCount(0);
    await bloco.getByLabel("Velocidade da internet em Mbps").fill("250");
    await expect.poll(async () => (await lerRascunho()).draft_data?.internetMbps, { timeout: 30_000 }).toBe("250");

    await abrirCadastro(page, "revisao");
    await aceitarTermoIaSePreciso(page);
    const publicar = page.locator('[data-testid="publicar-anuncio"]:visible');
    await expect(publicar).toBeEnabled({ timeout: 20_000 });
    const faltaOutros = page.getByTestId("publicar-falta-outros");
    expect(await faltaOutros.isVisible() ? await faltaOutros.innerText() : "", "nada mais falta para publicar").toBe("");
    await publicar.click();
    await page.waitForURL(/\/dashboard\/imoveis$/, { timeout: 30_000 });
    await expect
      .poll(async () => {
        const r = await lerRascunho();
        return { status: r.status, mbps: r.internet_mbps, internet: r.detalhes_anuncio?.chacara?.internet };
      }, { timeout: 60_000 })
      .toEqual({ status: "active", mbps: 250, internet: "fibra" });
    await page.context().close();
  });
});
