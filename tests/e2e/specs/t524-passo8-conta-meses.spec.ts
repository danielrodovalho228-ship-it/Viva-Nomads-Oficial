// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { TITULO_PASSO } from "../fixtures/cadastro";

/*
  T524 — Passo 8 (#1372), guarda permanente da Pista C: a mesma conta da t472 (aluguel R$ 3.600 + condomínio R$ 350 +
  contas R$ 150) em OUTROS períodos (a t472 fixa 4 meses). Conta nova de proprietário: 1ª faixa = 12%.
   - prévia: R$ 4.100/mês tudo incluído;
   - "Você recebe do morador" = R$ 4.100 × meses;
   - taxa da Viva = 12% × R$ 3.600 × meses — nunca 12% do total (R$ 4.100 × meses).
  1, 6 e 12 meses a 1280; 6 meses a 390.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t524.${sufixo}@lab.vivanomads.test`, nome: "Ana Meses", role: "owner" as const };
const ids: { dono?: string } = {};
const brl = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

async function abrirPrecoPreenchido(page: Page) {
  await page.goto("/dashboard/imoveis/novo?etapa=preco", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("passo-titulo")).toHaveText(TITULO_PASSO.preco, { timeout: 30_000 });
  await page.getByTestId("cadastro-preco").fill("3600");
  await page.getByTestId("cadastro-condominio").fill("350");
  await page.getByRole("button", { name: "Valor fixo estimado" }).click();
  await page.getByTestId("cadastro-consumo").fill("150");
  await expect(page.getByTestId("cadastro-tudo-incluido")).toHaveText(/R\$\s?4\.100\/mês tudo incluído/);
}

test.describe("T524 — Passo 8: recebe = total × meses; taxa = 12% × aluguel × meses", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const [w, lista] of [[1280, [1, 6, 12]], [390, [6]]] as const) {
    test(`a ${w} px: ${lista.join(", ")} mes(es)`, async ({ browser }) => {
      const page = await entrar(browser, dono.email, senha);
      await page.setViewportSize({ width: w, height: w === 390 ? 844 : 900 });
      await abrirPrecoPreenchido(page);
      const simulador = page.getByTestId("simulador-bolso");
      for (const m of lista) {
        await simulador.getByTestId("bolso-meses").fill(String(m));
        await expect(simulador.getByTestId("bolso-recebe"), `${m} meses: recebe`).toHaveText(brl(4100 * m));
        const taxa = simulador.getByTestId("bolso-taxa");
        await expect(taxa, `${m} meses: taxa sobre o aluguel`).toHaveText(brl(0.12 * 3600 * m));
        await expect(taxa, `${m} meses: a taxa não é sobre o total`).not.toHaveText(brl(0.12 * 4100 * m));
        await expect(simulador.getByTestId("bolso-taxa-detalhe")).toContainText(`(R$ 3.600 × ${m} = ${brl(3600 * m)})`);
        await expect(simulador.getByTestId("bolso-taxa-detalhe")).toContainText("Condomínio e contas não entram na taxa");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await simulador.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `tests/laboratorio/saida/t524-simulador-${w}.png`, fullPage: true });
      await page.context().close();
    });
  }
});
