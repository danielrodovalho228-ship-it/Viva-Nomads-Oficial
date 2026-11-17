import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2114 — E391 (Pista 3; varredura "sem spec" das 142, lote I) @E391 — sem @ao-vivo-seguro: precisa de sessão e do
  laboratório (VERMELHO PENDENTE DE LABORATÓRIO).
  Regra decidida (E391; unitário escopo-saida.test.ts): "Sair" encerra a sessão SÓ neste aparelho (escopo local); os
  outros aparelhos da mesma conta continuam dentro. "Sair de todos os aparelhos" (Conta → Segurança, com confirmação na
  página) encerra todas as sessões (escopo global): os outros aparelhos ficam fora na próxima página.
  Cada aparelho é um contexto do navegador com a sua própria sessão (entrar), na mesma conta.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const conta = { email: `sair.t2114.${sufixo}@lab.vivanomads.test`, nome: "Silvia Saida", role: "owner" as const };
const ids: Record<string, string> = {};

/** O aparelho ainda está dentro? Abre /dashboard e vê se ficou nele (fora, o site leva ao login). */
async function dentro(p: Page): Promise<boolean> {
  await p.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  return new URL(p.url()).pathname.startsWith("/dashboard");
}

test.describe("T2114 — E391: Sair é só neste aparelho; Sair de todos encerra os outros @E391", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (precisa de sessão e da chave de serviço).");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    ids.conta = await criarConta(conta, senha);
  });
  test.afterAll(async () => {
    await apagarContas([ids.conta]);
  });

  test("Sair (celular, menu da Conta) encerra só este aparelho; o outro continua dentro", async ({ browser }) => {
    const a = await entrar(browser, conta.email, senha);
    const b = await entrar(browser, conta.email, senha);
    await a.setViewportSize({ width: 390, height: 844 });
    await a.goto("/dashboard/conta", { waitUntil: "domcontentloaded" });
    await a.getByRole("button", { name: /^Sair\b/ }).first().click({ timeout: 30_000 });
    await expect.poll(() => new URL(a.url()).pathname.startsWith("/dashboard"), { message: "o aparelho A saiu", timeout: 20_000 }).toBe(false);
    expect(await dentro(a), "A, depois de Sair, está fora").toBe(false);
    expect(await dentro(b), "B, o outro aparelho, continua dentro (Sair é local)").toBe(true);
    await a.context().close();
    await b.context().close();
  });

  test("Sair de todos os aparelhos (computador, Conta › Segurança, com confirmação) encerra também o outro", async ({ browser }) => {
    const b = await entrar(browser, conta.email, senha);
    const c = await entrar(browser, conta.email, senha);
    expect(await dentro(c), "C começa dentro").toBe(true);
    await b.setViewportSize({ width: 1280, height: 900 });
    await b.goto("/dashboard/conta/seguranca", { waitUntil: "domcontentloaded" });
    await b.getByTestId("sair-de-todos").click({ timeout: 30_000 });
    // Confirmação na própria página antes de sair.
    await expect(b.getByTestId("sair-de-todos-confirmacao")).toContainText("Sair da conta em todos os aparelhos, inclusive neste?");
    await b.getByTestId("sair-de-todos-confirmar").click();
    await expect.poll(() => new URL(b.url()).pathname, { message: "B sai para as boas-vindas", timeout: 20_000 }).toBe("/app/boas-vindas");
    expect(await dentro(b), "B está fora").toBe(false);
    expect(await dentro(c), "C, o outro aparelho, também ficou fora (Sair de todos é global)").toBe(false);
    await b.context().close();
    await c.context().close();
  });
});
