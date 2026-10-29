// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo, aceitarTermoIaSePreciso } from "../fixtures/laboratorio";

/**
 * T401 — Cadastro 10: Revise e publique (mockup cadastro-imovel-10). 1280 e 390, com prints.
 *   1. "Passo 10 de 10", um H1 ("Revise e publique"); a "Lista de conferência" com um item por passo (Fotos, Endereço,
 *      Detalhes, Comodidades, Regras, Preço, Disponibilidade), todos feitos; o cartão do anúncio com a foto carregando de
 *      verdade, "1 quarto · 1 banheiro · 40 m²" e "R$ 3.200/mês no total". No computador: lista à esquerda, cartão à
 *      direita, sem a prévia lateral dos outros passos. No celular: cartão antes da lista, "Tudo certo para publicar".
 *      Sem "hóspede", "comissão" nem "reserva"; sem rolagem lateral; nada fixo cobrindo o "Publicar anúncio".
 *   2. "Publicar anúncio" fica travado até o aceite do termo da IA e libera ao marcar.
 */
const SAIDA = "tests/laboratorio/saida";
const FOTOS_LOCAIS = ["sala", "quarto", "cozinha", "banheiro", "fachada", "sala", "quarto", "cozinha"];

test.describe("T401 — Cadastro 10: Revise e publique (cadastro-imovel-10)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const sufixo = novoSufixo();
  const dono = { email: `dono.t401.${sufixo}@lab.vivanomads.test`, nome: "Rui Teixeira", role: "owner" as const };
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

  for (const w of [1280, 390]) {
    test(`1. a ${w} px: a revisão do desenho`, async ({ browser }) => {
      const p = await abrir(w, browser);
      await expect(p.getByTestId("passo-texto")).toHaveText("Passo 10 de 10");
      await expect(p.locator("h1")).toHaveCount(1);
      await expect(p.locator("h1")).toHaveText("Revise e publique");
      const lista = p.getByTestId("lista-conferencia");
      for (const id of ["fotos", "endereco", "detalhes", "comodidades", "regras", "preco", "disponibilidade"]) {
        await expect(lista.getByTestId(`conferencia-${id}`), id).toHaveAttribute("data-ok", "1");
      }
      await expect(lista).toHaveAttribute("data-faltam", "0");
      const cartao = p.getByTestId("revisao-cartao");
      // E251: no celular a prévia vem recolhida ("Ver como fica o anúncio"), depois da lista.
      if (w === 390) {
        await expect(cartao).toBeHidden();
        await p.getByTestId("previa-recolhida").click();
      }
      await expect(p.getByTestId("revisao-linha")).toHaveText("1 quarto · 1 banheiro · 40 m²");
      // E251: os três nomes fixos do preço (PROP-2).
      await expect(p.getByTestId("previa-preco-mensal")).toContainText(/Mensal\s*R\$\s?3\.200/);
      await expect(p.getByTestId("previa-preco-total-mes")).toContainText("Total por mês (com contas)");
      await expect(p.getByTestId("previa-preco-total-contrato")).toContainText("Total do contrato");
      const foto = p.getByTestId("revisao-foto");
      await expect.poll(() => foto.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      await expect(p.getByTestId("novo-resumo")).toHaveCount(0);
      const l = (await lista.boundingBox())!;
      const c = (await cartao.boundingBox())!;
      if (w === 1280) {
        expect(l.x, "lista à esquerda do cartão").toBeLessThan(c.x);
      } else {
        expect(l.y, "no celular a lista vem antes da prévia (E251)").toBeLessThan(c.y);
      }
      await expect.poll(() => lista.locator("h3").evaluate((h) => (h as HTMLElement).innerText.trim())).toBe("Tudo certo para publicar");
      await expect(p.locator("main")).not.toContainText(/h[oó]spede|comiss|reserva/i);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      // O "Publicar anúncio" visível não fica sob nenhum elemento fixo (barra de fotos, "Fale com a Viva").
      const publicar = p.locator('[data-testid="publicar-anuncio"]:visible');
      await publicar.scrollIntoViewIfNeeded();
      // Travado (falta o aceite), o botão tem pointer-events: none e o elementFromPoint passaria por ele: liga só para medir.
      const livre = await publicar.evaluate((el) => {
        const b = el as HTMLElement;
        const antes = b.style.pointerEvents;
        b.style.pointerEvents = "auto";
        const r = b.getBoundingClientRect();
        const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        b.style.pointerEvents = antes;
        return !!topo && (topo === b || b.contains(topo));
      });
      expect(livre, "nada fixo por cima do Publicar").toBe(true);
      await p.evaluate(() => document.querySelector("[data-painel-main]")?.scrollTo(0, 0));
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.screenshot({ path: `${SAIDA}/t401-revisao-${w}.png`, fullPage: w === 390 });
      await p.context().close();
    });
  }

  test("2. 'Publicar anúncio' trava até o aceite do termo da IA e libera ao marcar", async ({ browser }) => {
    const p = await abrir(1280, browser);
    const publicar = p.locator('[data-testid="publicar-anuncio"]:visible');
    await expect(publicar).toBeDisabled();
    await expect(p.getByTestId("publicar-falta")).toContainText("aceite do termo da IA");
    await aceitarTermoIaSePreciso(p);
    await expect(publicar).toBeEnabled({ timeout: 10_000 });
    await expect(publicar).toHaveText("Publicar anúncio");
    await p.context().close();
  });
});
