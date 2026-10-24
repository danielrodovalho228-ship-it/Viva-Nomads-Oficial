import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T435 — Cadastro 03: Endereço (mockup cadastro-imovel-03). 390 e 1280, com prints.
 *   1. "Passo 3 de 10", um H1 ("Onde fica o imóvel?"). Com o endereço preenchido: "Endereço completo" numa linha
 *      ("Rua Santos Dumont, 100 – Centro, Uberlândia – MG"), o "Mapa do bairro" com o nome do bairro, o aviso de
 *      privacidade logo embaixo do mapa, "Confira se o endereço está certo antes de continuar." e as etiquetas do
 *      bairro e da cidade. Sem "hóspede"/"reserva"; sem rolagem lateral; nada fixo por cima do "Continuar".
 *   2. Sem o número, o resumo e o mapa somem e fica só o aviso de privacidade.
 */
const SAIDA = "tests/laboratorio/saida";
const FOTOS_LOCAIS = ["sala", "quarto", "cozinha", "banheiro", "fachada", "sala", "quarto", "cozinha"];

test.describe("T435 — Cadastro 03: Endereço (cadastro-imovel-03)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t435.${sufixo}@lab.vivanomads.test`, nome: "Rui Teixeira", role: "owner" as const };
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
          step: 2,
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
    await p.goto(`/dashboard/imoveis/novo?draft=${ids.imovel}&etapa=endereco`, { waitUntil: "domcontentloaded" });
    await p.getByTestId("etapa-onde-fica").waitFor({ timeout: 30_000 });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    return p;
  }

  for (const w of [390, 1280]) {
    test(`1. a ${w} px: endereço completo, mapa do bairro e etiquetas`, async ({ browser }) => {
      const p = await abrir(w, browser);
      await expect(p.getByTestId("passo-texto")).toHaveText("Passo 3 de 10");
      await expect(p.locator("h1")).toHaveCount(1);
      await expect(p.locator("h1")).toHaveText("Onde fica o imóvel?");
      await expect(p.getByTestId("endereco-resumo")).toHaveText("Rua Santos Dumont, 100 – Centro, Uberlândia – MG");
      const mapa = p.getByTestId("mapa-bairro");
      await expect(mapa).toBeVisible();
      await expect(p.getByTestId("mapa-bairro-nome")).toHaveText("Centro");
      const yResumo = (await p.getByTestId("endereco-resumo").boundingBox())!.y;
      const m = (await mapa.boundingBox())!;
      const yAviso = (await p.getByTestId("endereco-privacidade").boundingBox())!.y;
      const yConfira = (await p.getByTestId("endereco-confira").boundingBox())!.y;
      const yEtiquetas = (await p.getByTestId("endereco-etiquetas").boundingBox())!.y;
      expect(m.y).toBeGreaterThan(yResumo);
      expect(yAviso, "o aviso logo embaixo do mapa").toBeGreaterThan(m.y + m.height - 1);
      expect(yConfira).toBeGreaterThan(yAviso);
      expect(yEtiquetas).toBeGreaterThan(yConfira);
      expect(m.height, "o mapa tem altura").toBeGreaterThan(120);
      await expect(p.getByTestId("endereco-confira")).toHaveText("Confira se o endereço está certo antes de continuar.");
      await expect(p.getByTestId("endereco-etiquetas").locator("span")).toHaveText(["Centro", "Uberlândia · MG"]);
      await expect(p.getByTestId("endereco-privacidade")).toContainText("após o aceite");
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
      await p.getByTestId("endereco-resumo").scrollIntoViewIfNeeded();
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${SAIDA}/t435-endereco-${w}.png`, fullPage: w === 390 });
      await p.context().close();
    });
  }

  test("2. a 390 px, sem o número: o resumo e o mapa somem, fica o aviso", async ({ browser }) => {
    const p = await abrir(390, browser);
    await expect(p.getByTestId("endereco-resumo")).toBeVisible();
    await p.getByTestId("cadastro-numero").fill("");
    await expect(p.getByTestId("endereco-resumo")).toHaveCount(0);
    await expect(p.getByTestId("mapa-bairro")).toHaveCount(0);
    await expect(p.getByTestId("endereco-privacidade")).toBeVisible();
    await p.context().close();
  });
});
