import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, continuarFicaEm, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T423 — E135 (levantamento do Daniel, 25/10; correção na Pista A). Passo 7, Título e descrição:
   1. com título e descrição válidos, o "Continuar" avança para o Preço;
   2. com os dois vazios, o "Continuar" não fica no estado "pronto" e o clique diz o que falta (título e descrição).
  Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t423.${sufixo}@lab.vivanomads.test`, nome: "Tereza Titulo", role: "owner" as const };
const titulo = `Studio do título ${sufixo}`;
const ids: { dono?: string; rascunho?: string } = {};

test.describe("T423 — E135: Passo 7, título e descrição", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, titulo, { description: "Descrição do laboratório." });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. título e descrição válidos: o Continuar avança para o Preço", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "descricao");
    await expect(page.getByTestId("cadastro-titulo")).toHaveValue(titulo, { timeout: 20_000 });
    await page.getByTestId("cadastro-titulo").fill("Studio mobiliado perto do Centro");
    await page.getByTestId("cadastro-descricao").fill("Studio mobiliado com cozinha, internet e mesa de trabalho, pronto para morar por alguns meses.");
    await continuarFicaEm(page, "preco");
    await page.context().close();
  });

  test("2. campos vazios: o Continuar não fica pronto e o clique diz o que falta", async ({ browser }) => {
    // E135 (Pista A): o Continuar do rodapé não tem estado "não pronto" (sem aria-disabled, run 40190394864) e o Passo 7
    // só confere o título (a descrição vazia não aparece no que falta). Quem corrigir tira este test.fail.
    test.fail(true, "E135: com título e descrição vazios o Continuar parece pronto e não diz que falta a descrição");
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "descricao");
    await expect(page.getByTestId("cadastro-titulo")).not.toHaveValue("", { timeout: 20_000 });
    await page.getByTestId("cadastro-titulo").fill("");
    await page.getByTestId("cadastro-descricao").fill("");
    const continuar = page.getByTestId("cadastro-continuar");
    await expect(continuar, "sem título nem descrição o Continuar não pode parecer pronto").toHaveAttribute("aria-disabled", "true");
    await continuar.click();
    await noPasso(page, "descricao");
    const avisos = page.getByTestId("etapa-descricao").getByRole("alert");
    await expect(avisos.filter({ hasText: /título/i })).toBeVisible();
    await expect(avisos.filter({ hasText: /descrição/i })).toBeVisible();
    await page.context().close();
  });
});
