// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { abrirSecoesPasso10 } from "../fixtures/cadastro";
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

  for (const w of [390, 1280]) {
    test(`E104 a ${w} px: Passo 3 só endereço, em cartão branco sobre o fundo areia; bairro fora do zoom; complemento neutro`, async ({ browser }) => {
      const p = await abrir(w, browser);
      // Só endereço: nada de IA, quem opera, identidade, documento do imóvel nem importar.
      for (const fora of ["cartao-ia", "atalhos-passo1", "documento-vinculo", "documento-operacao", "etapa-identidade", "antes-de-publicar"]) {
        await expect(p.getByTestId(fora), fora).toHaveCount(0);
      }
      for (const texto of ["Deixe a IA preencher o anúncio para você", "Quem opera este imóvel?", "Confirme sua identidade", "Já tem anúncio em outro site?"]) {
        await expect(p.getByText(texto), texto).toHaveCount(0);
      }
      // Cartão branco sobre o fundo clean (#f7f7f7, E166; antes, areia) da moldura.
      const coluna = p.getByTestId("novo-coluna-form");
      expect(await coluna.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 255, 255)");
      expect(await coluna.evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius))).toBeGreaterThan(0);
      expect(await p.getByTestId("moldura-assistente").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(247, 247, 247)");
      // A etiqueta do bairro não cobre o zoom do mapa (o "+" fica à vista).
      await p.getByTestId("mapa-bairro").scrollIntoViewIfNeeded();
      await p.waitForTimeout(500);
      const zoom = p.getByTestId("mapa-bairro").locator(".leaflet-control-zoom");
      await expect(zoom).toBeVisible({ timeout: 20_000 });
      const z = (await zoom.boundingBox())!;
      const nome = (await p.getByTestId("mapa-bairro-nome").boundingBox())!;
      const cruza = nome.x < z.x + z.width && nome.x + nome.width > z.x && nome.y < z.y + z.height && nome.y + nome.height > z.y;
      expect(cruza, "a etiqueta do bairro por cima do zoom").toBe(false);
      const mais = p.getByTestId("mapa-bairro").locator(".leaflet-control-zoom-in");
      const b = (await mais.boundingBox())!;
      expect(await mais.evaluate((el, pt) => document.elementFromPoint(pt.x, pt.y) === el || el.contains(document.elementFromPoint(pt.x, pt.y)), { x: b.x + b.width / 2, y: b.y + b.height / 2 })).toBe(true);
      // Complemento sem supor apartamento.
      await expect(p.getByTestId("cadastro-complemento")).toHaveAttribute("placeholder", "Bloco, apartamento, casa ou referência");
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(800);
      await p.screenshot({ path: `${SAIDA}/t435-e104-passo3-${w}.png`, fullPage: true });
      await p.getByTestId("mapa-bairro").scrollIntoViewIfNeeded();
      await p.waitForTimeout(500);
      await p.getByTestId("mapa-bairro").screenshot({ path: `${SAIDA}/t435-e104-mapa-zoom-${w}.png` });
      // O que saiu do Passo 3 continua no cadastro: "Antes de publicar" na Revisão.
      const url = new URL(p.url());
      url.searchParams.set("etapa", "revisao");
      await p.goto(url.pathname + url.search, { waitUntil: "domcontentloaded" });
      const antes = p.getByTestId("antes-de-publicar");
      await abrirSecoesPasso10(p); // E251: as seções são um acordeão
      await expect(antes).toBeVisible({ timeout: 30_000 });
      await expect(antes).toContainText("Quem opera este imóvel?");
      await expect(antes.getByTestId("etapa-identidade")).toBeVisible();
      await expect(antes.getByTestId("documento-vinculo")).toBeVisible();
      await antes.scrollIntoViewIfNeeded();
      await p.screenshot({ path: `${SAIDA}/t435-e104-antes-de-publicar-${w}.png`, fullPage: false });
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
