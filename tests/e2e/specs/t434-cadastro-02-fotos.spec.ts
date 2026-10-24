import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T434 — Cadastro 02: Fotos (mockup cadastro-imovel-02). 390 e 1280, com prints.
 *   1. "Passo 2 de 10", um H1 ("Adicione as fotos do imóvel"). A galeria logo abaixo do título: a foto principal larga
 *      com o selo "Foto principal" (carregando de verdade), as outras em 3 colunas e o "+ Adicionar foto" tracejado com
 *      câmera — no computador, ao lado da principal; no celular, depois das miniaturas. Embaixo, a dica de luz; sob o
 *      "Continuar", "Você pode reorganizar as fotos depois de enviar.". Sem "hóspede"/"reserva"/"temporada"; sem rolagem
 *      lateral; nada fixo por cima do "Continuar".
 *   2. Sem foto: o "+ Adicionar foto" ocupa a largura toda e abre a escolha de arquivos.
 */
const SAIDA = "tests/laboratorio/saida";
const FOTOS_LOCAIS = ["sala", "quarto", "cozinha", "banheiro", "fachada", "sala", "quarto", "cozinha"];

test.describe("T434 — Cadastro 02: Fotos (cadastro-imovel-02)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t434.${sufixo}@lab.vivanomads.test`, nome: "Rui Teixeira", role: "owner" as const };
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
          step: 1,
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
    await p.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=fotos`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("etapa-fotos").waitFor({ timeout: 30_000 });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return p;
  }

  for (const w of [390, 1280]) {
    test(`1. a ${w} px: a galeria do desenho`, async ({ browser }) => {
      const p = await abrir(w, browser);
      await expect(p.getByTestId("passo-texto")).toHaveText("Passo 2 de 10");
      await expect(p.locator("h1")).toHaveCount(1);
      await expect(p.locator("h1")).toHaveText("Adicione as fotos do imóvel");
      const galeria = p.getByTestId("fotos-galeria");
      await expect(galeria).toHaveAttribute("data-variante", "cadastro");
      const principal = p.getByTestId("foto-principal");
      await expect(principal.getByTestId("selo-foto-principal")).toHaveText("Foto principal");
      await expect.poll(() => principal.locator("img").evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      const miniaturas = p.getByTestId("foto-miniatura");
      await expect(miniaturas).toHaveCount(FOTOS_LOCAIS.length - 1);
      const adicionar = p.getByTestId("fotos-adicionar");
      await expect(adicionar).toContainText("+ Adicionar foto");
      // A galeria vem antes da contagem e da dica (logo abaixo do título).
      const yTitulo = (await p.getByTestId("passo-subtitulo").boundingBox())!.y;
      const g = (await galeria.boundingBox())!;
      const yDica = (await p.getByTestId("fotos-dica").boundingBox())!.y;
      const yContagem = (await p.getByTestId("fotos-contagem").boundingBox())!.y;
      expect(g.y).toBeGreaterThan(yTitulo);
      expect(yDica).toBeGreaterThan(g.y + g.height - 1);
      expect(yContagem).toBeGreaterThan(yDica);
      await expect(p.getByTestId("fotos-dica")).toHaveText("Dica: use fotos com boa iluminação e ambiente organizado.");
      const pr = (await principal.boundingBox())!;
      const ad = (await adicionar.boundingBox())!;
      const m0 = (await miniaturas.nth(0).boundingBox())!;
      const m2 = (await miniaturas.nth(2).boundingBox())!;
      expect(Math.abs(m0.y - m2.y), "3 miniaturas na mesma linha").toBeLessThanOrEqual(1);
      if (w === 1280) {
        expect(ad.x, "o + Adicionar foto fica ao lado da principal").toBeGreaterThanOrEqual(pr.x + pr.width - 1);
        expect(ad.y).toBeGreaterThanOrEqual(pr.y - 1);
        expect(ad.y + ad.height).toBeLessThanOrEqual(pr.y + pr.height + 1);
      } else {
        expect(pr.width, "a principal ocupa a largura da galeria").toBeGreaterThan(g.width - 2);
        expect(ad.y, "o + Adicionar foto vem depois das miniaturas").toBeGreaterThan(m0.y);
      }
      await expect(p.getByTestId("fotos-reorganizar")).toHaveText("Você pode reorganizar as fotos depois de enviar.");
      const yCont = (await p.getByTestId("cadastro-continuar").boundingBox())!.y;
      expect((await p.getByTestId("fotos-reorganizar").boundingBox())!.y).toBeGreaterThan(yCont);
      await expect(p.locator("main")).not.toContainText(/h[oó]spede|reserva|temporada/i);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const continuar = p.getByTestId("cadastro-continuar");
      await continuar.scrollIntoViewIfNeeded();
      const livre = await continuar.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return !!topo && (topo === el || el.contains(topo));
      });
      expect(livre, "nada fixo por cima do Continuar").toBe(true);
      await p.evaluate(() => document.querySelector("[data-painel-main]")?.scrollTo(0, 0));
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.screenshot({ path: `${SAIDA}/t434-fotos-${w}.png`, fullPage: w === 390 });
      await p.context().close();
    });
  }

  test("2. a 390 px, sem foto: o + Adicionar foto ocupa a largura e abre a escolha de arquivos", async ({ browser }) => {
    const { data } = await adm().from("properties").select("draft_data").eq("id", ids.imovel!).single();
    const { error } = await adm()
      .from("properties")
      .update({ draft_data: { ...(data!.draft_data as Record<string, unknown>), photos: [], iaAnalisadas: [] } })
      .eq("id", ids.imovel!);
    if (error) throw error;
    const p = await abrir(390, browser);
    await expect(p.getByTestId("foto-principal")).toHaveCount(0);
    const adicionar = p.getByTestId("fotos-adicionar");
    await expect(adicionar).toContainText("+ Adicionar foto");
    const g = (await p.getByTestId("fotos-galeria").boundingBox())!;
    expect((await adicionar.boundingBox())!.width).toBeGreaterThan(g.width - 2);
    expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await p.screenshot({ path: `${SAIDA}/t434-fotos-vazio-390.png` });
    const [escolha] = await Promise.all([p.waitForEvent("filechooser", { timeout: 5_000 }), adicionar.click()]);
    expect(escolha.isMultiple()).toBe(true);
    await p.context().close();
  });
});
