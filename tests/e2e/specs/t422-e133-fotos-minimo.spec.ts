import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { noPasso } from "../fixtures/cadastro";
import { abrirPasso, continuarFicaEm, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T422 — E133 (levantamento do Daniel, 25/10; correção na Pista A). Passo 2, Fotos:
   1. E602 (05/11): abaixo de 8 fotos a contagem diz quantas faltam para PUBLICAR, mas o "Continuar" avança (as fotos
      são exigência para publicar, não para navegar); o índice de passos marca "Fotos" com pendência;
   2. com 8 fotos o "Continuar" avança para o Endereço (controle).
  A foto marcada como "não parece imóvel" que não vira a principal é da t468 · 2 (Pista A, #1373, com a marca por
  foto que o produto ganhou ali): este spec não repete.
  Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t422.${sufixo}@lab.vivanomads.test`, nome: "Fabia Fotos", role: "owner" as const };
const ids: { dono?: string; com3?: string; com8?: string } = {};

test.describe("T422 — E133 + E602: mínimo de 8 fotos para publicar, não para navegar", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.com3 = await prepararRascunho(ids.dono, `Studio 3 fotos ${sufixo}`, {}, 3);
    ids.com8 = await prepararRascunho(ids.dono, `Studio 8 fotos ${sufixo}`, {}, 8);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. com 3 fotos, a contagem diz o que falta para publicar e o Continuar avança (E602)", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.com3!, "fotos");
    const contagem = page.getByTestId("fotos-contagem");
    await expect(contagem).toContainText("3 / 8 fotos", { timeout: 20_000 });
    await expect(contagem).toContainText("Faltam 5 fotos");
    await expect(page.getByTestId("indice-passo-2")).toHaveAttribute("data-estado", "atual");
    await expect(page.getByTestId("cadastro-continuar"), "E602: as fotos seguram o publicar, não a navegação").toBeEnabled();
    await continuarFicaEm(page, "endereco");
    await expect(page.getByTestId("indice-passo-2")).toHaveAttribute("data-estado", "falta");
    // O índice leva de volta (e adiante) a qualquer passo.
    await page.getByTestId("indice-passo-8").click();
    await noPasso(page, "preco");
    await page.getByTestId("indice-passo-2").click();
    await noPasso(page, "fotos");
    await page.context().close();
  });

  test("2. com 8 fotos, o Continuar avança para o Endereço", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.com8!, "fotos");
    await expect(page.getByTestId("fotos-contagem")).toContainText("8 / 8 fotos", { timeout: 20_000 });
    await continuarFicaEm(page, "endereco");
    await page.context().close();
  });
});
