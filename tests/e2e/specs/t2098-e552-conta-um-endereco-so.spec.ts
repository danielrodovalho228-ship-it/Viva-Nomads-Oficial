import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2098 — E552 / E492 (Pista 3; varredura "sem spec" das 142, lote C) @E552 @E492 — sem @ao-vivo-seguro: precisa de
  sessão e do laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E492 + E552): a Conta tem UM endereço para o Perfil. No computador, /dashboard/conta leva a
  /dashboard/conta/perfil substituindo a entrada do histórico (o "voltar" não volta ao endereço duplicado); no celular,
  /dashboard/conta continua sendo o MENU da Conta. O unitário e492-conta-perfil.test.ts fixa a regra e a página; esta
  spec prova na tela.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `inq.t2098.${sufixo}@lab.vivanomads.test`, nome: "Iris Conta", role: "tenant" as const };
const ids: Record<string, string> = {};

test.describe("T2098 — E552/E492: um endereço só para o Perfil (computador) e o menu da Conta (celular) @E552 @E492", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 120_000 });
  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.conta]);
  });

  test("1280 px — /dashboard/conta vai para /dashboard/conta/perfil e o voltar não volta à Conta duplicada", async ({ browser }) => {
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: 1280, height: 900 });
    await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await p.waitForURL(/\/dashboard\/conta\/perfil(?:[?#].*)?$/, { timeout: 30_000 });
    await expect(p.getByTestId("conta-menu")).toHaveCount(0);
    // A entrada da Conta foi SUBSTITUÍDA: o voltar leva ao painel, não a /dashboard/conta (que redirecionaria de novo).
    await p.goBack({ waitUntil: "domcontentloaded" });
    await expect.poll(() => new URL(p.url()).pathname, { timeout: 15_000 }).toBe("/dashboard");
    await p.context().close();
  });

  test("390 px — /dashboard/conta continua sendo o menu da Conta", async ({ browser }) => {
    const p = await entrar(browser, conta.email, senha);
    await p.setViewportSize({ width: 390, height: 844 });
    await p.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await expect(p.getByTestId("conta-menu")).toBeVisible({ timeout: 30_000 });
    await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    expect(new URL(p.url()).pathname).toBe("/dashboard/conta");
    await p.context().close();
  });
});
