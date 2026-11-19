import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T370 — CONTA-A A3 (mockup perfil-03): Conta › Como você usa a Viva.
 *   1. Cartão "Quero morar" (Ativo + interruptor, "Procurando imóvel de 1 a 6 meses em <cidade>", resumo com o pino);
 *      cartão "Quero anunciar" com "Começar um anúncio"; pílulas "Preferências salvas" e "Ajuda com o cadastro";
 *      sem "viajantes"/"curto prazo". 1280 e 390, com prints.
 *   1b. (perfil-03-papeis-com-fotos, 24/10) Três cartões num padrão só: "Quero ser parceiro" com "Cadastrar meu serviço";
 *      cada cartão com a foto do acervo à esquerda, carregando de verdade, do MESMO tamanho e na mesma coluna nos três.
 *   2. (E537) Com o morador em uso, "Quero morar" fica ligado e travado com a frase de "em uso"; numa conta em que o
 *      morador não está em uso, desligar grava na hora (sem botão de salvar) e volta depois de recarregar; ligar grava.
 */
const SAIDA = "tests/laboratorio/saida";
const ROTA = "/dashboard/conta/papeis";

test.describe("T370 — CONTA-A A3: Como você usa a Viva (perfil-03)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const conta = { email: `inq.t370.${novoSufixo()}@lab.vivanomads.test`, nome: "Ana Ribeiro", role: "tenant" as const };
  let id = "";
  const intencao = async () => (await adm().from("profiles").select("intencao").eq("id", id).single()).data?.intencao as string[];
  async function como(browser: Browser, w: number): Promise<Page> {
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
    return p;
  }
  test.beforeAll(async () => {
    id = await criarConta(conta, senha);
    await adm().from("profiles").update({ intencao: ["morar"], cidade: "Uberlândia" }).eq("id", id);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const w of [1280, 390]) {
    test(`1. a ${w} px: os três cartões com foto e as pílulas do desenho`, async ({ browser }) => {
      const p = await como(browser, w);
      await p.goto(ROTA, { waitUntil: "domcontentloaded" });
      await p.getByTestId("tela-papeis").waitFor({ timeout: 20_000 });
      await expect(p.locator("h1:visible")).toHaveText("Como você usa a Viva");
      const morar = p.getByTestId("papel-cartao-morar");
      await expect(morar.getByTestId("papel-morar-ativo")).toBeVisible();
      await expect(p.getByTestId("papel-morar-toggle")).toHaveAttribute("aria-checked", "true");
      await expect(morar).toContainText("Procurando imóvel de 1 a 6 meses em Uberlândia");
      await expect(p.getByTestId("papel-morar-resumo")).toHaveText("Uberlândia · 1–6 meses · Mobiliado");
      await expect(p.getByTestId("papel-comecar-anuncio")).toHaveAttribute("href", "/dashboard/imoveis/novo");
      const parceiro = p.getByTestId("papel-cartao-parceiro");
      await expect(parceiro).toContainText("Quero ser parceiro");
      await expect(parceiro).toContainText("Ofereça serviços para moradores e proprietários");
      await expect(p.getByTestId("papel-parceiro-botao")).toHaveText("Cadastrar meu serviço");
      await expect(p.getByTestId("papel-parceiro-botao")).toHaveAttribute("href", "/dashboard/parceiro");
      const caixas = [];
      for (const c of ["morar", "anunciar", "parceiro"]) {
        const cartao = p.getByTestId(`papel-cartao-${c}`);
        const foto = cartao.getByTestId("papel-foto");
        const img = foto.locator("img");
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), { timeout: 15_000 }).toBe(true);
        const f = (await foto.boundingBox())!;
        const k = (await cartao.boundingBox())!;
        caixas.push({ w: Math.round(f.width), h: Math.round(f.height), dx: Math.round(f.x - k.x) });
      }
      // Mesma medida e mesmo recuo à esquerda nos três cartões.
      expect(new Set(caixas.map((c) => `${c.w}x${c.h}@${c.dx}`)).size, JSON.stringify(caixas)).toBe(1);
      await expect(p.getByTestId("papeis-preferencias")).toContainText("Preferências salvas");
      await expect(p.getByTestId("papeis-ajuda")).toHaveAttribute("href", "/ajuda");
      await expect(p.locator("main")).not.toContainText(/viajante|curto prazo|médio prazo/i);
      expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      // Nada fixo (barra de abas, "Fale com a Viva") cobre o botão de nenhum dos três cartões.
      for (const id of ["papel-morar-toggle", "papel-comecar-anuncio", "papel-parceiro-botao"]) {
        const alvo = p.getByTestId(id);
        await alvo.scrollIntoViewIfNeeded();
        const livre = await alvo.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!topo && (topo === el || el.contains(topo));
        });
        expect(livre, `nada fixo por cima de ${id}`).toBe(true);
      }
      await p.evaluate(() => document.querySelector("[data-painel-main]")?.scrollTo(0, 0));
      await p.evaluate(() => window.scrollTo(0, 0));
      // O print só depois do bloco "papel em uso" carregar (sem o esqueleto no fim da tela).
      await p.getByTestId("seus-papeis").waitFor({ timeout: 20_000 });
      await p.screenshot({ path: `${SAIDA}/t370-papeis-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }

  // E744 (asserção alterada, tabela da Fable #3832): pelo E537 o "Quero morar" fica LIGADO e TRAVADO enquanto o papel
  // de morador está em uso (desligar ali não desligaria o papel). O "grava na hora" passa a ser cobrado numa conta de
  // proprietário com a intenção "morar" (morador fora de uso: `estadoQueroMorar(["morar"], false)` não trava).
  test("2. com o morador em uso o interruptor fica ligado e travado; fora de uso grava na hora e volta depois de recarregar", async ({ browser }) => {
    const p = await como(browser, 1280);
    await p.goto(ROTA, { waitUntil: "domcontentloaded" });
    const travado = p.getByTestId("papel-morar-toggle");
    await expect(travado).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
    await expect(travado).toBeDisabled();
    await expect(p.getByTestId("papel-morar-em-uso")).toBeVisible();
    expect(await intencao(), "travado: nada foi gravado").toEqual(["morar"]);
    await p.context().close();

    const dono = { email: `dono.t370.${novoSufixo()}@lab.vivanomads.test`, nome: "Otávio Dono", role: "owner" as const };
    const idDono = await criarConta(dono, senha);
    try {
      await adm().from("profiles").update({ intencao: ["anunciar", "morar"], cidade: "Uberlândia" }).eq("id", idDono);
      const intencaoDono = async () => (await adm().from("profiles").select("intencao").eq("id", idDono).single()).data?.intencao as string[];
      const q = await entrar(browser, dono.email, senha);
      await q.setViewportSize({ width: 1280, height: 900 });
      await q.goto(ROTA, { waitUntil: "domcontentloaded" });
      const morar = q.getByTestId("papel-morar-toggle");
      await expect(morar).toHaveAttribute("aria-checked", "true", { timeout: 20_000 });
      await expect(morar).toBeEnabled();
      await expect(q.getByTestId("papel-morar-em-uso")).toHaveCount(0);
      await morar.click();
      await expect.poll(async () => (await intencaoDono()).includes("morar"), { timeout: 15_000 }).toBe(false);
      await q.reload({ waitUntil: "domcontentloaded" });
      await expect(q.getByTestId("papel-morar-toggle")).toHaveAttribute("aria-checked", "false", { timeout: 20_000 });
      await expect(q.getByTestId("papel-morar-ativo")).toBeHidden();
      await q.getByTestId("papel-morar-toggle").click();
      await expect.poll(async () => (await intencaoDono()).includes("morar"), { timeout: 15_000 }).toBe(true);
      await q.context().close();
    } finally {
      await apagarContas([idDono]);
    }
  });
});
