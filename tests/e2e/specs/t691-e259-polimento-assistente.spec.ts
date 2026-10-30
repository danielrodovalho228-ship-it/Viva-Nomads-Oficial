import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { abrirPasso, prepararRascunho } from "../fixtures/rascunho-cadastro";

/*
  T691 — E259 (5)(6)(7)(8) (prova de publicação do QA, 30/10). 1280 e 390, com prints.
   (5) Passo 1: os 9 cartões de tipo com foto carregada, sem rolar a linha.
   (6) Passo 3 → Continuar → Passo 4: "Pessoas" vazio chega com a sugestão (2), marcada "sugerido", e a dica do Continuar
       não lista mais Pessoas.
   (7) Passo 5: o texto do Essencial não diz mais "sem foto nenhuma" (o mínimo de 8 fotos continua).
   (8) Passo 10: "Declarações do imóvel" (E271: só na seção dela, sem linha na Lista de conferência).
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t691.${sufixo}@lab.vivanomads.test`, nome: "Rui Polimento", role: "owner" as const };
const ids: Record<string, string> = {};
const END = { cep: "38400-060", street: "Rua Santos Dumont", numero: "100", neighborhood: "Centro", city: "Uberlândia", uf: "MG" };

test.describe("T691 — E259: polimento dos Passos 1, 4, 5 e 10", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.dono);
    for (const w of [1280, 390]) ids[`r${w}`] = await prepararRascunho(ids.dono, `Studio Polimento ${w} ${sufixo}`, { ...END });
  });
  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const w of [1280, 390] as const) {
    test(`${w} px — (5) fotos dos tipos, (6) Pessoas sugerido, (7) texto do Essencial, (8) Declarações do imóvel`, async ({ browser }) => {
      const conta = { email: dono.email, senha };
      // (5)
      const p1 = await abrirPasso(browser, conta, ids[`r${w}`], "tipo", w);
      await expect(p1.locator('[data-testid^="tipo-"][data-testid$="-foto"]')).toHaveCount(9, { timeout: 30_000 });
      await expect
        .poll(() => p1.locator('[data-testid^="tipo-"][data-testid$="-foto"]').evaluateAll((els) => els.filter((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth > 0).length), { timeout: 20_000 })
        .toBe(9);
      await p1.screenshot({ path: `${SAIDA}/t691-tipos-${w}.png` });
      await p1.context().close();

      // (6)
      const p3 = await abrirPasso(browser, conta, ids[`r${w}`], "endereco", w);
      await p3.getByTestId("cadastro-continuar").click();
      const pessoas = p3.getByTestId("cadastro-capacidade");
      await expect(pessoas).toHaveValue("2", { timeout: 20_000 });
      await expect(p3.getByTestId("linha-cadastro-capacidade")).toContainText("Pessoas");
      const dica = (await p3.getByTestId("cadastro-continuar").getAttribute("title")) ?? "";
      expect(dica).not.toMatch(/pessoas/i);
      await p3.getByTestId("linha-cadastro-capacidade").scrollIntoViewIfNeeded();
      await p3.screenshot({ path: `${SAIDA}/t691-pessoas-${w}.png` });
      await p3.context().close();

      // (7)
      const p5 = await abrirPasso(browser, conta, ids[`r${w}`], "comodidades", w);
      const essencial = p5.getByTestId("nivel-cadastro-declarado");
      await expect(essencial).toContainText("não pede foto de cada item", { timeout: 30_000 });
      await expect(essencial).not.toContainText("sem foto nenhuma");
      await p5.context().close();

      // (8)
      const p10 = await abrirPasso(browser, conta, ids[`r${w}`], "revisao", w);
      // E271: as declarações ficam só na seção delas ("Antes de publicar"); a lista não tem mais a linha do Passo 1.
      const linha = p10.getByTestId("antes-secao-declaracoes");
      await expect(linha).toBeVisible({ timeout: 30_000 });
      await expect(linha).toContainText("Declarações do imóvel");
      await expect(p10.getByTestId("conferencia-tipo")).toHaveCount(0);
      await linha.scrollIntoViewIfNeeded();
      await p10.screenshot({ path: `${SAIDA}/t691-conferencia-${w}.png` });
      await p10.context().close();
    });
  }
});
