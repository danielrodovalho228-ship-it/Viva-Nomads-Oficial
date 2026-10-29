// Portão pós-#1500 (Pista C, 29/10): o E193 (#1496) trocou listas e caixas por pílulas e cartões no assistente e no editor; roda no lab-crítico deste PR.
import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, emDiasBR, isoParaBR, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T424 — E136 (levantamento do Daniel, 25/10; correção na Pista A). Passo 9, Disponibilidade: as datas aparecem em
  pt-BR, nada de "Oct"/"Nov", mesmo com o navegador em inglês (locale en-US, o padrão do laboratório).
   1. 1280 px (campo de texto dd/mm/aaaa): a data digitada fica dd/mm/aaaa e o passo não mostra mês em inglês;
   2. 390 px no toque (o campo vira o seletor nativo, t204): a data escolhida aparece em dd/mm/aaaa na tela — o
      seletor nativo desenha no idioma do aparelho ("Oct 25, 2026" num celular em inglês).
  Só no laboratório.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t424.${sufixo}@lab.vivanomads.test`, nome: "Dora Datas", role: "owner" as const };
const ids: { dono?: string; rascunho?: string } = {};
// Abreviação ou nome em inglês, palavra inteira ("Nov", "October"); "Novembro" e "Dezembro" do calendário em pt-BR não contam.
const MES_EM_INGLES = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\b/;
const DATA = emDiasBR(40);

test.describe("T424 — E136: datas do Passo 9 em pt-BR", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio das datas ${sufixo}`);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  test("1. 1280 px: a data digitada fica dd/mm/aaaa e nenhum mês aparece em inglês", async ({ browser }) => {
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "disponibilidade", 1280, { locale: "en-US" });
    const campo = page.getByTestId("disponivel-de");
    await campo.fill(isoParaBR(DATA));
    await expect(campo).toHaveValue(isoParaBR(DATA));
    await expect(page.getByTestId("calendario-dono-grade")).toBeVisible({ timeout: 30_000 });
    expect(await page.getByTestId("etapa-disponibilidade").innerText()).not.toMatch(MES_EM_INGLES);
    await page.context().close();
  });

  test("2. 390 px no toque: a data escolhida aparece em dd/mm/aaaa na tela", async ({ browser }) => {
    // E136 (corrigido na Pista A): no toque o seletor nativo continua abrindo, e a data aparece por cima em dd/mm/aaaa.
    const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "disponibilidade", 390, { locale: "en-US", hasTouch: true, isMobile: true });
    const campo = page.getByTestId("disponivel-de");
    await expect(campo).toHaveAttribute("type", "date", { timeout: 30_000 });
    await campo.fill(DATA);
    const bloco = page.getByTestId("disponibilidade");
    expect(await bloco.innerText()).not.toMatch(MES_EM_INGLES);
    await expect(bloco.getByText(isoParaBR(DATA)), "a data escolhida, em dd/mm/aaaa, ao lado do seletor nativo").toBeVisible();
    await page.context().close();
  });
});
