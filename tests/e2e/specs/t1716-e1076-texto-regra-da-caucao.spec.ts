import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1716 — E1076 @E1076: o texto-regra da caução diz a regra decidida no E1061.
  A prova ao vivo de 21/11 fechou o E1061 (os valores) e achou o resíduo: a frase que explica a regra ainda dizia
  "50% do valor de cada bloco". A regra decidida: 50% do aluguel da estadia, no máximo 3 vezes o valor mensal.
   1. Página pública do imóvel, sem datas: por baixo da linha "Caução", a nota diz a regra decidida.
   2. Com 31 dias escolhidos: o valor muda para o da estadia e a nota continua a dizer a mesma regra.
   3. Painel do dono, página "Caução": "Como funciona a caução" diz a mesma regra.
  Em nenhuma das três aparece "de cada bloco" como regra. As procuras são pelo texto que a tela mostra.
  Capturas a 390 e a 1280 px. Laboratório; não é prova ao vivo no site.
*/
const SAIDA = "tests/laboratorio/saida";
const REGRA = "50% do aluguel da estadia, no máximo 3 vezes o valor mensal";
const REGRA_ANTIGA = /% do valor de cada bloco|% de cada bloco/;
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1716.${sufixo}@lab.vivanomads.test`, nome: "Dora Regra Sobrenome", role: "owner" as const };
const ids: { dono?: string; imovel?: string } = {};

const maisDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** A linha "Caução" do cartão de preço: o rótulo, o valor e a nota por baixo. */
const linhaCaucao = (page: Page) => page.locator("#cartao-preco li").filter({ hasText: /^\s*Caução/ }).first();

test.describe("T1716 — E1076: o texto-regra da caução diz '50% do aluguel da estadia' @E1076", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `[TESTE QA] Studio regra ${sufixo}`, { ativo: true, preco: 2500 });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. página do imóvel, sem datas: a nota da caução diz a regra decidida", async ({ page }) => {
    for (const largura of [1280, 390] as const) {
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
      const linha = linhaCaucao(page);
      await expect(linha, `${largura} px: a nota diz a regra decidida`).toContainText(REGRA, { timeout: 20_000 });
      await expect(linha).toContainText("Paga direto ao proprietário e devolvida no fim");
      await expect(linha, "a regra antiga saiu").not.toContainText(REGRA_ANTIGA);
      await linha.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${largura} px: sem rolagem lateral`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `${SAIDA}/t1716-1-pagina-nota-da-caucao-${largura}.png` });
    }
  });

  test("2. com 31 dias escolhidos: o valor é o da estadia e a nota diz a mesma regra", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "networkidle" });
    const livres = page.locator('#disponibilidade button[data-estado-dia="disponivel"]');
    await expect(livres.first()).toBeVisible({ timeout: 20_000 });
    const todos = await livres.evaluateAll((els) => els.map((e) => e.getAttribute("data-dia") ?? ""));
    const entrada = todos.find((d) => todos.includes(maisDias(d, 31)));
    expect(entrada, "precisa haver 31 dias livres no calendário").toBeTruthy();
    await page.locator(`#disponibilidade button[data-dia="${entrada}"]`).click();
    await page.locator(`#disponibilidade button[data-dia="${maisDias(entrada!, 31)}"]`).click();
    const linha = linhaCaucao(page);
    await expect(linha).toContainText("Caução nesta estadia (31 dias)", { timeout: 20_000 });
    // 2.500 × 31 ÷ 30 ÷ 2 = 1.291,67 → R$ 1.292: metade do aluguel da estadia, como a frase diz.
    await expect(linha).toContainText("R$ 1.292");
    await expect(linha).toContainText(REGRA);
    await expect(linha).not.toContainText(REGRA_ANTIGA);
  });

  test("3. painel do dono, página Caução: 'Como funciona a caução' diz a mesma regra", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dashboard/garantias", { waitUntil: "domcontentloaded" });
    const resumo = page.getByText("Como funciona a caução", { exact: true });
    await expect(resumo).toBeVisible({ timeout: 20_000 });
    await resumo.click();
    const explicacao = resumo.locator("xpath=..");
    await expect(explicacao).toContainText(REGRA);
    await expect(explicacao).not.toContainText(REGRA_ANTIGA);
    await resumo.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SAIDA}/t1716-3-painel-como-funciona-390.png` });
    await page.context().close();
  });
});
