import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T442 — Cadastro 01-b (E87) + E102-A. Só no laboratório.
   1. Passo 1, a 390 e 1280 px: os 9 tipos em cartões-foto, todos com foto e o selo "Imagem ilustrativa", numa linha só;
      nenhum chip nem "Outros tipos". Computador: setas (a da esquerda desativada no início, a da direita no fim), também
      pelo teclado. Celular: a linha desliza com encaixe. O cartão marcado leva o selo verde.
   2. E102-A: na Revisão, o bloco "Dados da chácara/sítio" mostra os valores preenchidos; o subtítulo do Passo 9 sem
      "aluguel".
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.tipos.${sufixo}@lab.vivanomads.test`, nome: "Tina Tipos", role: "owner" as const };
const ids: { dono?: string; chacara?: string } = {};
const SAIDA = "tests/laboratorio/saida";
const ROTULOS = ["Casa", "Apartamento", "Quarto", "Studio", "Loft", "Cobertura", "Casa de condomínio", "Flat/apart-hotel", "Chácara/Sítio"];

test.describe("T442 — Cadastro 01-b: 9 tipos em cartões-foto; E102-A", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.chacara = await criarImovelPronto(ids.dono, `Chácara Revisão ${sufixo}`);
    const { error } = await adm()
      .from("properties")
      // O rascunho retomado (?draft=) lê o que a tela gravou em draft_data: tipo e os dados da chácara com o ponto.
      .update({
        property_type: "chacara",
        draft_data: { propertyType: "chacara", chacara: { acesso: "asfalto", internet: "fibra", ponto: { lat: -18.95, lng: -48.4 } } },
      })
      .eq("id", ids.chacara);
    expect(error).toBeNull();
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`1. a ${w} px: 9 cartões-foto numa linha, sem chips; setas no computador, deslizar no celular`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await page.goto("/dashboard/imoveis/novo?etapa=tipo", { waitUntil: "domcontentloaded" });
      const linha = page.getByTestId("tipos-linha");
      await expect(linha).toBeVisible({ timeout: 30_000 });
      const cartoes = linha.getByRole("radio");
      await expect(cartoes).toHaveCount(9);
      expect((await cartoes.allTextContents()).map((t) => t.replace("Imagem ilustrativa", "").trim())).toEqual(ROTULOS);
      // Todos com foto (e alt que descreve o tipo) e o selo; nenhum chip nem "Outros tipos".
      await expect(linha.locator("img")).toHaveCount(9);
      for (const alt of await linha.locator("img").evaluateAll((els) => els.map((e) => e.getAttribute("alt") ?? ""))) expect(alt).toMatch(/^Foto ilustrativa de /);
      await expect(linha.getByTestId("selo-ilustrativa")).toHaveCount(9);
      await expect(page.getByText("Outros tipos")).toHaveCount(0);
      // Uma linha só: todos os cartões no mesmo alto.
      const ys = await cartoes.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
      expect(new Set(ys).size).toBe(1);
      // A linha rola (o conteúdo é mais largo que a tela) e a página não rola de lado.
      expect(await linha.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.screenshot({ path: `${SAIDA}/t442-tipos-${w}.png` });

      const esq = page.getByTestId("tipos-seta-esquerda");
      const dir = page.getByTestId("tipos-seta-direita");
      if (w === 1280) {
        await expect(esq).toBeDisabled();
        await expect(dir).toBeEnabled();
        // Pelo teclado: foco na seta da direita e Enter até o fim.
        await dir.focus();
        for (let i = 0; i < 6 && (await dir.isEnabled()); i++) {
          await page.keyboard.press("Enter");
          await page.waitForTimeout(400);
        }
        await expect(dir).toBeDisabled();
        await expect(esq).toBeEnabled();
        await expect(cartoes.last()).toBeInViewport();
        await page.screenshot({ path: `${SAIDA}/t442-tipos-fim-${w}.png` });
      } else {
        await expect(esq).toBeHidden();
        await expect(dir).toBeHidden();
        expect(await linha.evaluate((el) => getComputedStyle(el).scrollSnapType)).toContain("x");
        // Deslizar até o fim mostra o último cartão.
        await linha.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
        await expect(cartoes.last()).toBeInViewport();
      }
      // Marcar um tipo: selo verde no cartão marcado.
      await linha.getByTestId("tipo-chacara").click();
      await expect(linha.getByTestId("tipo-chacara")).toHaveAttribute("aria-checked", "true");
      await expect(linha.getByTestId("tipo-chacara").getByTestId("tipo-marcado")).toBeVisible();
      await page.screenshot({ path: `${SAIDA}/t442-tipos-chacara-${w}.png` });
      await page.context().close();
    });
  }

  test("2. E102-A: a Revisão mostra os dados da chácara/sítio preenchidos; Passo 9 sem 'aluguel'", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.goto(`/dashboard/imoveis/novo?draft=${ids.chacara}&etapa=revisao`, { waitUntil: "domcontentloaded" });
    const bloco = page.getByTestId("revisao-chacara");
    await expect(bloco).toBeVisible({ timeout: 30_000 });
    await expect(bloco).toContainText("Dados da chácara/sítio");
    await expect(bloco.getByTestId("revisao-chacara-acesso")).toHaveText("Acesso: Asfalto");
    await expect(bloco.getByTestId("revisao-chacara-internet")).toHaveText("Internet: Fibra");
    await expect(bloco.getByTestId("revisao-chacara-ponto")).toHaveText("Ponto marcado no mapa");
    await expect(bloco.getByTestId("revisao-chacara-ponto").getByLabel("feito")).toBeVisible();
    await bloco.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t442-revisao-chacara.png` });

    await page.goto(`/dashboard/imoveis/novo?draft=${ids.chacara}&etapa=disponibilidade`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Escolha a partir de quando o imóvel está disponível e as datas que ficam fechadas.")).toBeVisible({ timeout: 30_000 });
    expect(await page.locator("main").innerText()).not.toMatch(/alugu/i);
    await page.context().close();
  });
});
