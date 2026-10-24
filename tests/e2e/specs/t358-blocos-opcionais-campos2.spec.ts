import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T358 — CAMPOS-2 no padrão E56 (toggle): os 5 grupos opcionais do anúncio (incluído no preço, áreas do condomínio,
 * andar/elevador, janela de entrada/saída, detalhe da vaga) e a Convivência do CAMPOS-1 — uma regra por toggle, como na
 * tela 06 dos mockups aprovados (23/10 20:48).
 *   1. sem dado salvo, todo bloco nasce FECHADO (toggle desligado, campos escondidos) e o medidor diz "não se aplica";
 *   2. ligar abre o grupo inteiro; o medidor passa a contar o bloco (falta → preenchido);
 *   3. com dado salvo, o bloco nasce ABERTO ao recarregar;
 *   4. desligar com dados pede confirmação ("Manter" não mexe; "Desligar e apagar" fecha e o dado sai ao salvar);
 *      desligar um bloco vazio fecha direto.
 * E o que ficou ligado aparece no anúncio público ("Regras da estadia"); o desligado, não. Prints 1280 e 390.
 */
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t358.${sufixo}@lab.vivanomads.test`, nome: "Telma Toggle", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

async function abrirSecao(d: Page, testid: string) {
  await d.goto(`/dashboard/imoveis/${ids.imovel}/editar`, { waitUntil: "domcontentloaded" });
  const secao = d.getByTestId(testid);
  await expect(async () => {
    if ((await secao.getAttribute("data-aberta")) !== "true") await secao.getByRole("button").first().click({ timeout: 3_000 });
    await expect(secao.locator('[data-testid^="bloco-"]').first()).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  return secao;
}
const bloco = (d: Page, id: string) => d.getByTestId(`bloco-${id}`);
const ligado = async (d: Page, id: string) => (await bloco(d, id).getAttribute("data-ligado")) === "sim";
const linha = async () => (await adm().from("properties").select("detalhes_anuncio, regras_casa").eq("id", ids.imovel!).single()).data;

test.describe("T358 — CAMPOS-2: blocos opcionais no padrão E56", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio dos toggles ${sufixo}`, { ativo: true, preco: 2700 });
    await adm().from("properties").update({ detalhes_anuncio: null, regras_casa: null }).eq("id", ids.imovel);
  });
  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await apagarContas([ids.dono]);
  });

  test("1 e 2: tudo nasce fechado; ligar abre o grupo; medidor trata desligado como 'não se aplica'", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    const secao = await abrirSecao(d, "secao-detalhes-anuncio");
    for (const id of ["incluidoNoPreco", "areasCondominio", "andar", "janela", "vaga"]) {
      expect(await ligado(d, id), id).toBe(false);
      await expect(bloco(d, id).getByRole("switch")).toHaveAttribute("aria-checked", "false");
      await expect(d.getByTestId(`bloco-${id}-conteudo`)).toHaveCount(0);
    }
    await expect(d.getByTestId("completude-opcionais")).toHaveText("Detalhes opcionais: Nenhum detalhe opcional ligado · 9 não se aplicam");

    // Ligar abre o grupo inteiro e o medidor passa a contá-lo (falta → preenchido).
    await d.getByTestId("bloco-andar-toggle").click();
    await expect(d.getByTestId("bloco-andar-conteudo")).toBeVisible();
    await expect(d.getByTestId("detalhe-andar")).toBeVisible();
    await expect(d.getByTestId("detalhe-elevador")).toBeVisible();
    await expect(d.getByTestId("completude-opcionais")).toHaveText("Detalhes opcionais: 0 de 1 preenchido · 8 não se aplicam");
    await d.getByTestId("detalhe-andar").fill("3");
    await d.getByTestId("detalhe-elevador").getByLabel("Sim", { exact: true }).check();
    await expect(d.getByTestId("completude-opcionais")).toHaveText("Detalhes opcionais: 1 de 1 preenchido · 8 não se aplicam");

    await d.getByTestId("bloco-janela-toggle").click();
    await d.getByTestId("detalhe-entrada-de").fill("14:00");
    await d.getByTestId("detalhe-entrada-ate").fill("20:00");
    await d.getByTestId("detalhe-saida-ate").fill("11:00");

    // Bloco ligado e vazio: desligar fecha direto, sem confirmação.
    await d.getByTestId("bloco-vaga-toggle").click();
    await expect(d.getByTestId("bloco-vaga-conteudo")).toBeVisible();
    await d.getByTestId("bloco-vaga-toggle").click();
    await expect(d.getByTestId("bloco-vaga-confirmar")).toHaveCount(0);
    expect(await ligado(d, "vaga")).toBe(false);

    expect(await d.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await secao.screenshot({ path: `${SAIDA}/t358-detalhes-ligados-1280.png` });
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect.poll(async () => (await linha())?.detalhes_anuncio, { timeout: 20_000 }).toEqual({
      andar: { andar: 3, elevador: true },
      janela: { entradaDe: "14:00", entradaAte: "20:00", saidaAte: "11:00" },
    });
    await d.context().close();
  });

  test("3 e 4: com dado salvo nasce aberto; desligar com dados pede confirmação e o dado sai ao salvar", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 390, height: 844 });
    const secao = await abrirSecao(d, "secao-detalhes-anuncio");
    expect(await ligado(d, "andar")).toBe(true);
    expect(await ligado(d, "janela")).toBe(true);
    expect(await ligado(d, "vaga")).toBe(false);
    await expect(d.getByTestId("detalhe-andar")).toHaveValue("3");
    await expect(d.getByTestId("completude-opcionais")).toHaveText("Detalhes opcionais: 2 de 2 preenchidos · 7 não se aplicam");

    // Desligar com dados: confirmação na tela. "Manter" não mexe em nada.
    await d.getByTestId("bloco-andar-toggle").click();
    await expect(d.getByTestId("bloco-andar-confirmar")).toBeVisible();
    await secao.screenshot({ path: `${SAIDA}/t358-confirmar-desligar-390.png` });
    await d.getByTestId("bloco-andar-confirmar-manter").click();
    await expect(d.getByTestId("bloco-andar-confirmar")).toHaveCount(0);
    expect(await ligado(d, "andar")).toBe(true);
    await expect(d.getByTestId("detalhe-andar")).toHaveValue("3");
    // "Desligar e apagar": fecha, o medidor volta a "não se aplica" e o dado sai ao salvar.
    await d.getByTestId("bloco-andar-toggle").click();
    await d.getByTestId("bloco-andar-confirmar-desligar").click();
    expect(await ligado(d, "andar")).toBe(false);
    await expect(d.getByTestId("bloco-andar-conteudo")).toHaveCount(0);
    await expect(d.getByTestId("completude-opcionais")).toHaveText("Detalhes opcionais: 1 de 1 preenchido · 8 não se aplicam");
    expect(await d.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect.poll(async () => (await linha())?.detalhes_anuncio, { timeout: 20_000 }).toEqual({
      janela: { entradaDe: "14:00", entradaAte: "20:00", saidaAte: "11:00" },
    });
    await d.context().close();

    // Anúncio público: a janela ligada aparece; o andar desligado, não.
    const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await expect(async () => {
      await p.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      const regras = p.locator("#regras-da-estadia");
      await expect(regras).toContainText("Entrada das 14h às 20h · saída até às 11h", { timeout: 5_000 });
      await expect(regras).not.toContainText("andar");
    }).toPass({ timeout: 60_000 });
    await p.close();
  });

  test("Convivência (CAMPOS-1): uma regra por toggle — fechada sem regra, aberta com regra, desligar pede confirmação", async ({ browser }) => {
    test.setTimeout(150_000);
    const d = await entrar(browser, dono.email, senha);
    await d.setViewportSize({ width: 1280, height: 900 });
    let secao = await abrirSecao(d, "secao-regras");
    for (const id of ["silencio", "fumo", "festas", "visitas"]) {
      expect(await ligado(d, id), id).toBe(false);
      await expect(d.getByTestId(`bloco-${id}-conteudo`)).toHaveCount(0);
    }
    // Ligar uma regra abre só ela (como na tela 06: visitas aberta, fumo e festas fechados).
    await d.getByTestId("bloco-visitas-toggle").click();
    await expect(d.getByTestId("regras-casa-visitas")).toBeVisible();
    await d.getByTestId("regras-casa-visitas").getByLabel("Sim", { exact: true }).check();
    await d.getByTestId("bloco-festas-toggle").click();
    await d.getByTestId("regras-casa-festas").getByLabel("Proibidas", { exact: true }).check();
    expect(await ligado(d, "fumo")).toBe(false);
    await d.getByTestId("regras-casa").screenshot({ path: `${SAIDA}/t358-convivencia-1280.png` });
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect.poll(async () => (await linha())?.regras_casa, { timeout: 20_000 }).toEqual({ festas: "proibido", visitas: { permitidas: true } });

    // Recarregar: as regras salvas nascem abertas; as outras, fechadas.
    secao = await abrirSecao(d, "secao-regras");
    expect(await ligado(d, "festas")).toBe(true);
    expect(await ligado(d, "visitas")).toBe(true);
    expect(await ligado(d, "fumo")).toBe(false);
    expect(await ligado(d, "silencio")).toBe(false);
    // Desligar com escolha pede confirmação; "Manter" não mexe; "Desligar e apagar" tira a regra ao salvar.
    await d.getByTestId("bloco-festas-toggle").click();
    await expect(d.getByTestId("bloco-festas-confirmar")).toBeVisible();
    await d.getByTestId("bloco-festas-confirmar-manter").click();
    expect(await ligado(d, "festas")).toBe(true);
    await d.getByTestId("bloco-festas-toggle").click();
    await d.getByTestId("bloco-festas-confirmar-desligar").click();
    expect(await ligado(d, "festas")).toBe(false);
    await secao.getByRole("button", { name: "Salvar seção" }).click();
    await expect.poll(async () => (await linha())?.regras_casa, { timeout: 20_000 }).toEqual({ visitas: { permitidas: true } });
    await d.context().close();
  });
});
