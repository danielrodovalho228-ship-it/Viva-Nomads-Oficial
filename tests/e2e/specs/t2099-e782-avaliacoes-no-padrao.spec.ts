import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2099 — E782 (Pista 3; varredura "sem spec" das 142, lote C) @E782 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E782, com o E898): a tela de Avaliações segue o padrão das telas da Conta — UM título só (o H1 da casca
  da Conta, "Avaliações", em tinta), sem título duplicado, e sem o "← Voltar" em texto do painel (a seta é a da casca).
  O unitário e782-avaliacoes-padrao.test.ts fixa por leitura; esta spec prova na tela, a 390 e 1280 px.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `inq.t2099.${sufixo}@lab.vivanomads.test`, nome: "Ivo Avalia", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T2099 — E782: Avaliações com um título só e sem o Voltar em texto do painel @E782", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.conta]);
  });

  for (const largura of [390, 1280]) {
    test(`${largura} px — /dashboard/avaliacoes: um H1 "Avaliações" (o da casca) e nenhum voltar-painel`, async ({ browser }) => {
      const p = await entrar(browser, conta.email, senha);
      await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
      await p.goto("/dashboard/avaliacoes", { waitUntil: "domcontentloaded" });
      const h1 = p.getByTestId("conta-h1");
      await expect(h1).toBeVisible({ timeout: 30_000 });
      await expect(h1).toHaveText(/Avaliações/);
      await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await expect(p.locator("main h1"), "um título só na tela").toHaveCount(1);
      await expect(p.getByTestId("voltar-painel"), "sem o ← Voltar em texto do painel").toHaveCount(0);
      // Título em tinta, não verde: a cor do H1 não é a verde da marca (forest).
      const cor = await h1.evaluate((e) => getComputedStyle(e).color);
      expect(cor, "o título da casca é em tinta, não no verde da marca (--color-forest #1c6b3a)").not.toBe("rgb(28, 107, 58)");
      await p.context().close();
    });
  }
});
