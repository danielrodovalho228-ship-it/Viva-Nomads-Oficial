import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T377 — Assistente de cadastro em 10 passos, entrega 01 (mockup cadastro-imovel-01, Entrega 3 do CONTA-A).
 *   1. Topo "Passo 1 de 10" com a barra; um H1 só, "Qual é o tipo do seu imóvel?"; cartões Casa, Apartamento e Quarto
 *      (Apartamento marcado por padrão) com a foto carregando de verdade; "Outros tipos" com os demais do catálogo.
 *      No computador, a "Visualização do anúncio · Ao vivo" ao lado. Sem rolagem lateral, e nada fixo cobrindo o
 *      "Continuar". 390 e 1280, com prints.
 *   2. Escolher o tipo marca o cartão e a prévia muda na hora; "Continuar" leva ao passo 2 (Fotos) e "Voltar" volta
 *      com o tipo escolhido; a escolha fica no rascunho.
 */
const SAIDA = "tests/laboratorio/saida";

async function semRolagemLateral(p: Page) {
  expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
}

/** O centro do botão está livre: nenhum elemento fixo (barra de fotos, "Fale com a Viva") por cima dele. */
async function continuarLivre(p: Page) {
  const botao = p.getByTestId("cadastro-continuar");
  await botao.scrollIntoViewIfNeeded();
  const livre = await botao.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!topo && (topo === el || el.contains(topo));
  });
  expect(livre, "nenhum elemento fixo por cima do Continuar").toBe(true);
}

test.describe("T377 — Cadastro 01: Tipo do imóvel (cadastro-imovel-01)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });
  test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });
  const senha = novaSenha();
  const dono = { email: `dono.t377.${novoSufixo()}@lab.vivanomads.test`, nome: "Rui Teixeira", role: "owner" as const };
  let id = "";
  test.beforeAll(async () => {
    id = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  for (const w of [1280, 390]) {
    test(`1. a ${w} px: o passo 1 do desenho`, async ({ browser }) => {
      const p = await entrar(browser, dono.email, senha);
      await p.setViewportSize({ width: w, height: w === 1280 ? 900 : 844 });
      await p.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "networkidle" });
      await expect(p.getByTestId("passo-texto")).toHaveText("Passo 1 de 10");
      await expect(p.getByRole("progressbar", { name: "Progresso do cadastro" })).toHaveAttribute("aria-valuenow", "10");
      await expect(p.locator("h1")).toHaveCount(1);
      await expect(p.locator("h1")).toHaveText("Qual é o tipo do seu imóvel?");
      for (const t of ["casa", "apartamento", "quarto"]) await expect(p.getByTestId(`tipo-${t}`)).toBeVisible();
      await expect(p.getByTestId("tipo-apartamento")).toHaveAttribute("aria-checked", "true");
      await expect(p.getByTestId("tipo-casa")).toHaveAttribute("aria-checked", "false");
      for (const t of ["studio", "loft", "cobertura", "casa_condominio", "flat"]) await expect(p.getByTestId(`tipo-${t}`)).toBeVisible();
      // As fotos dos cartões carregam de verdade.
      for (const t of ["apartamento", "quarto"]) {
        const img = p.getByTestId(`tipo-${t}-foto`);
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), { timeout: 15_000 }).toBe(true);
      }
      if (w === 1280) {
        await expect(p.getByTestId("previa-anuncio")).toBeVisible();
        await expect(p.getByTestId("previa-titulo")).toHaveText("Apartamento");
        await expect(p.getByTestId("previa-estado")).toContainText("Rascunho");
      } else {
        await expect(p.getByTestId("previa-anuncio")).toBeHidden();
      }
      await expect(p.locator("main")).not.toContainText(/hósped|viajante|reserva|comiss/i);
      await semRolagemLateral(p);
      await continuarLivre(p);
      // O print começa do topo do passo ("Passo 1 de 10"): no computador quem rola é o <main> do painel.
      await p.evaluate(() => {
        document.querySelector("[data-painel-main]")?.scrollTo(0, 0);
        window.scrollTo(0, 0);
      });
      await p.screenshot({ path: `${SAIDA}/t377-tipo-${w}.png`, fullPage: true });
      await p.context().close();
    });
  }

  test("2. escolher o tipo atualiza a prévia; Continuar leva às Fotos e Voltar mantém a escolha", async ({ browser }) => {
    const p = await entrar(browser, dono.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "networkidle" });
    await p.getByTestId("tipo-casa").click();
    await expect(p.getByTestId("tipo-casa")).toHaveAttribute("aria-checked", "true");
    await expect(p.getByTestId("tipo-apartamento")).toHaveAttribute("aria-checked", "false");
    await expect(p.getByTestId("previa-titulo")).toHaveText("Casa");
    await expect(p.getByTestId("previa-chips")).toContainText("Casa");
    await p.getByTestId("tipo-studio").click();
    await expect(p.getByTestId("tipo-studio")).toHaveAttribute("aria-checked", "true");
    await expect(p.getByTestId("tipo-casa")).toHaveAttribute("aria-checked", "false");
    await expect(p.getByTestId("previa-titulo")).toHaveText("Studio / kitnet");

    await p.getByTestId("cadastro-continuar").click();
    await expect(p.getByTestId("passo-texto")).toHaveText("Passo 2 de 10");
    await expect(p.locator("h1")).toHaveText("Adicione as fotos do imóvel");
    await p.screenshot({ path: `${SAIDA}/t377-passo2-1280.png` });
    await p.getByTestId("cadastro-voltar").click();
    await expect(p.getByTestId("passo-texto")).toHaveText("Passo 1 de 10");
    await expect(p.getByTestId("tipo-studio")).toHaveAttribute("aria-checked", "true");
    await p.context().close();
  });
});
