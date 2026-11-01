import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T859 — CONFORMIDADE FINA DO CADASTRO (Pista C, 01/11; merge #1847, mockups cadastro-imovel-01 e -02). O merge trouxe
  só teste de fonte; aqui, na tela de verdade, a 390 e 1280 px:
   1) Passo Tipo: o nome de cada tipo de imóvel sai centrado no cartão e um passo maior (text-lg, 18 px);
   2) Passo Fotos com 3 fotos: "Faltam 5 fotos" aparece UMA vez só — a trava embaixo (fotos-trava) já diz, e a contagem
      do topo deixa de repetir; a contagem continua "3 / 8 fotos".
  Rascunhos do laboratório, criados e apagados aqui.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t859.${sufixo}@lab.vivanomads.test`, nome: "Fia Fina", role: "owner" as const };
const ids: { dono?: string; rascunho?: string; com3?: string } = {};

test.describe("T859 — conformidade fina do cadastro (#1847)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 120_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.rascunho = await prepararRascunho(ids.dono, `Studio tipo t859 ${sufixo}`);
    ids.com3 = await prepararRascunho(ids.dono, `Studio 3 fotos t859 ${sufixo}`, {}, 3);
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const largura of [390, 1280] as const) {
    test(`Passo Tipo: nome do tipo centrado e em 18 px (${largura} px)`, async ({ browser }) => {
      const page = await abrirPasso(browser, { email: dono.email, senha }, ids.rascunho!, "tipo");
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const linha = page.getByTestId("tipos-linha");
      await expect(linha).toBeVisible({ timeout: 20_000 });
      const nomes = linha.locator('[data-testid^="tipo-"] > span.font-semibold');
      expect(await nomes.count(), "cartões de tipo com nome").toBeGreaterThan(0);
      const estilos = await nomes.evaluateAll((els) => els.map((e) => ({ texto: e.textContent?.trim(), alinhamento: getComputedStyle(e).textAlign, tamanho: getComputedStyle(e).fontSize })));
      for (const e of estilos) {
        expect(e.alinhamento, `"${e.texto}" centrado`).toBe("center");
        expect(e.tamanho, `"${e.texto}" em 18 px`).toBe("18px");
      }
      await page.context().close();
    });

    test(`Passo Fotos com 3 fotos: "Faltam 5 fotos" uma vez só (${largura} px)`, async ({ browser }) => {
      const page = await abrirPasso(browser, { email: dono.email, senha }, ids.com3!, "fotos");
      await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      const contagem = page.getByTestId("fotos-contagem");
      await expect(contagem).toContainText("3 / 8 fotos", { timeout: 20_000 });
      await expect(page.getByTestId("fotos-trava")).toContainText("Faltam 5 fotos");
      await expect(page.getByTestId("etapa-fotos").getByText(/Faltam 5 fotos/), "a frase aparece uma vez só no passo").toHaveCount(1);
      await page.context().close();
    });
  }
});
