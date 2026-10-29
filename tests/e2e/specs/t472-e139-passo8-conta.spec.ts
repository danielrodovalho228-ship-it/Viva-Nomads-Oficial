// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TITULO_PASSO } from "../fixtures/cadastro";

/*
  T472 — E139/E140/E151: o Passo 8 (preço) fecha a conta. Só no laboratório (conta nova de proprietário, 1ª faixa = 12%).
  Reprodução do E139: valor mensal R$ 3.600 + condomínio R$ 350 + contas R$ 150, 4 meses.
   1. A prévia mostra R$ 4.100/mês tudo incluído com a conta aberta (valor mensal + condomínio + contas).
   2. O simulador diz que o morador paga R$ 16.400 (4.100 × 4) e que a taxa é R$ 1.728 = 12% sobre o valor mensal × meses
      (R$ 3.600 × 4 = R$ 14.400) — a base escrita, igual à conta.
   3. A taxa é explicada uma vez: sem a linha "Num contrato de…", sem a regra pública repetida, "só com contrato fechado" 1×.
   4. Comparador do Airbnb no MESMO período do simulador; trocar os meses troca o comparador; conta aberta dos dois lados;
      o sugerido é rotulado como equivalência e o botão diz o valor que vai entrar.
   0. Sem valor mensal, a Revisão diz "Valor mensal ainda não definido." (não "R$ 150/mês no total").
  A 390 e 1280 px, com prints.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t472.${sufixo}@lab.vivanomads.test`, nome: "Iara Conta", role: "owner" as const };
const ids: { dono?: string } = {};
const SAIDA = "tests/laboratorio/saida";

async function abrirPreco(page: Page) {
  await page.goto("/dashboard/imoveis/novo?etapa=preco", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("passo-titulo")).toHaveText(TITULO_PASSO.preco, { timeout: 30_000 });
}

const semNbsp = (s: string) => s.replace(/ /g, " ");

test.describe("T472 — E139/E140/E151: o Passo 8 fecha a conta", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: prévia, simulador e comparador com a mesma conta e o mesmo período`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrirPreco(page);

      // 0. Sem valor mensal, a Revisão não chama as contas de "total".
      await page.getByTestId("consumo-fixed").click(); // E193: cartão de escolha única (role=radio), não botão
      await page.getByTestId("cadastro-consumo").fill("150");
      await page.goto("/dashboard/imoveis/novo?etapa=revisao", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("revisao-sem-valor").first()).toHaveText("Valor mensal ainda não definido.", { timeout: 30_000 });
      await expect(page.getByTestId("revisao-total")).toHaveCount(0);
      await abrirPreco(page);

      await page.getByTestId("cadastro-preco").fill("3600");
      await page.getByTestId("cadastro-condominio").fill("350");
      await page.getByTestId("consumo-fixed").click(); // E193: cartão de escolha única (role=radio), não botão
      await page.getByTestId("cadastro-consumo").fill("150");

      // 1. Prévia com a conta aberta.
      await expect(page.getByTestId("cadastro-tudo-incluido")).toHaveText(/R\$\s?4\.100\/mês tudo incluído/);
      expect(semNbsp(await page.getByTestId("previa-conta").innerText())).toBe("valor mensal R$ 3.600 + condomínio R$ 350 + contas R$ 150");

      // 2. Simulador: mesmo total × meses; taxa sobre a base escrita.
      const simulador = page.getByTestId("simulador-bolso");
      await simulador.getByTestId("bolso-meses").fill("4");
      await expect(simulador.getByTestId("bolso-recebe")).toHaveText("R$ 16.400");
      await expect(simulador.getByTestId("bolso-recebe-detalhe")).toHaveText(/R\$\s?4\.100\/mês \(valor mensal R\$\s?3\.600 \+ condomínio R\$\s?350 \+ contas R\$\s?150\) × 4, direto a você/);
      await expect(simulador.getByTestId("bolso-taxa")).toHaveText("R$ 1.728");
      await expect(simulador.getByTestId("bolso-taxa-detalhe")).toHaveText(
        "12% sobre o valor mensal × meses (R$ 3.600 × 4 = R$ 14.400). Condomínio e contas não entram na taxa",
      );
      await expect(simulador.getByTestId("bolso-imoveis")).toHaveCount(0);

      // 3. A taxa explicada uma vez.
      const etapa = page.getByTestId("etapa-preco");
      await expect(page.getByTestId("linha-comparativo")).toHaveCount(0);
      const texto = await etapa.innerText();
      expect(texto).not.toContain("Anunciar é grátis. A Viva cobra 12% sobre o valor total do contrato fechado");
      expect(texto.match(/só (é cobrada )?com contrato fechado/g)?.length ?? 0).toBe(1);
      await simulador.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t472-simulador-${w}.png`, fullPage: true });

      // 4. Comparador no mesmo período; conta aberta; equivalência rotulada.
      const comp = page.getByTestId("preco-sugerido");
      await comp.getByRole("button", { name: /Comparar com o Airbnb/ }).click();
      await expect(comp).toContainText("pelos mesmos 4 meses");
      await comp.getByPlaceholder("10300").fill("9000");
      // Airbnb: 9.000 × (1 − 16%) = 7.560; equivalente na Viva em 4 meses: 7.560 / (4 × 0,88) → R$ 2.148/mês.
      await expect(page.getByTestId("conta-airbnb")).toContainText("R$ 9.000 cobrados");
      await expect(page.getByTestId("recebe-airbnb")).toHaveText("R$ 7.560");
      await expect(page.getByTestId("conta-viva")).toContainText("R$ 2.148 × 4 = R$ 8.592 do morador");
      await expect(page.getByTestId("conta-viva")).toContainText("12% sobre o valor mensal × meses");
      await expect(page.getByTestId("sugerido-equivalencia")).toContainText("R$ 2.148/mês é uma equivalência");
      await comp.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t472-comparador-${w}.png`, fullPage: true });

      // Trocar os meses no simulador troca o comparador (um período só na tela).
      await simulador.getByTestId("bolso-meses").fill("2");
      await expect(comp).toContainText("pelos mesmos 2 meses");
      await expect(page.getByTestId("conta-viva")).toContainText("× 2 =");

      // O botão diz o valor que entra e só troca o valor mensal quando a pessoa clica.
      await expect(page.getByTestId("cadastro-preco")).toHaveValue("3.600");
      const usar = comp.getByRole("button", { name: /^Usar R\$\s?[\d.]+\/mês como valor mensal$/ });
      const rotulo = (await usar.innerText()).match(/R\$\s?([\d.]+)/)![1];
      await usar.click();
      await expect(page.getByTestId("cadastro-preco")).toHaveValue(rotulo);

      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.context().close();
    });
  }
});
