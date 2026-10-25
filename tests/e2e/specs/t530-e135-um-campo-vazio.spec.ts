import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T530 — E135 (#1379), guarda permanente da Pista C: UM campo vazio de cada vez (a t423 esvazia os dois, a t473 só o
  título). No Passo 7, com só o título, só a descrição, e com os dois:
   - falta a descrição → não avança e o aviso no passo fala da descrição (e não do título);
   - falta o título → não avança e o aviso fala do título (e não da descrição);
   - os dois → avança para o Preço.
  A 390 e 1280 px. Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t530.${sufixo}@lab.vivanomads.test`, nome: "Tita Título", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};
const TITULO = "Studio mobiliado perto do Centro";
const DESCRICAO = "Studio mobiliado com cozinha, internet e mesa de trabalho, pronto para morar por alguns meses.";

test.describe("T530 — E135: Passo 7 com um campo vazio de cada vez", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio t530 ${sufixo}`, { description: DESCRICAO });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [390, 1280] as const) {
    test(`a ${w} px: sem descrição, sem título e com os dois`, async ({ browser }) => {
      const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "descricao", w);
      const titulo = page.getByTestId("cadastro-titulo");
      const descricao = page.getByTestId("cadastro-descricao");
      const continuar = page.getByTestId("cadastro-continuar");
      const avisos = page.getByTestId("etapa-descricao").getByRole("alert");
      await expect(titulo).not.toHaveValue("", { timeout: 20_000 });

      // Só o título: a descrição é o que falta.
      await titulo.fill(TITULO);
      await descricao.fill("");
      await expect(continuar).toHaveAttribute("data-pendente", "1");
      await continuar.click();
      await noPasso(page, "descricao");
      await expect(avisos.filter({ hasText: /descrição/i })).toBeVisible();
      await expect(avisos.filter({ hasText: /título/i })).toHaveCount(0);
      await page.screenshot({ path: `tests/laboratorio/saida/t530-sem-descricao-${w}.png` });

      // Só a descrição: o título é o que falta.
      await titulo.fill("");
      await descricao.fill(DESCRICAO);
      await expect(continuar).toHaveAttribute("data-pendente", "1");
      await continuar.click();
      await noPasso(page, "descricao");
      await expect(avisos.filter({ hasText: /título/i })).toBeVisible();
      await expect(avisos.filter({ hasText: /descrição/i })).toHaveCount(0);

      // Os dois: avança.
      await titulo.fill(TITULO);
      await expect(continuar).not.toHaveAttribute("data-pendente", "1");
      await continuar.click();
      await noPasso(page, "preco");
      await page.context().close();
    });
  }
});
