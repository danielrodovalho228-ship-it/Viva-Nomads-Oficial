import { test, expect, type Browser, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T924 — E391 (1) (#2007, Pista B): o "Sair" comum encerra a sessão SÓ neste aparelho (escopo local); "Sair de todos os
  aparelhos" mora em Conta → Segurança, com confirmação na página, e encerra em todos (escopo global). Antes, o "Sair"
  de um celular derrubava o computador. Prova com três aparelhos (contextos) da mesma conta nova do laboratório:
   1. A sai pelo menu da Conta (390 px) → A perde a sessão; B continua logado no painel;
   2. B abre Conta → Segurança, vê "Sair de todos os aparelhos", cancela (nada muda), depois confirma "Sair de todos" →
      B sai; C (que estava logado) perde a sessão no próximo carregamento.
*/
const SAIDA = "tests/laboratorio/saida";
const senha = novaSenha();
const sufixo = novoSufixo();
const email = `sair.t924.${sufixo}@lab.vivanomads.test`;
let id = "";

async function logado(page: Page, rota = "/dashboard/conta/seguranca"): Promise<boolean> {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  return !/\/auth|\/app\/boas-vindas/.test(new URL(page.url()).pathname);
}

async function aparelho(browser: Browser, largura: 390 | 1280): Promise<Page> {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 });
  return p;
}

test.describe("T924 — E391 (#2007): Sair só deste aparelho; Sair de todos em Conta → Segurança", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 150_000 });

  test.beforeAll(async () => {
    id = await criarConta({ email, nome: "Saulo Sessoes", role: "tenant" }, senha);
  });
  test.afterAll(async () => {
    await apagarContas([id]);
  });

  test("Sair do menu encerra só o aparelho A; Sair de todos encerra B e C", async ({ browser }) => {
    const a = await aparelho(browser, 390);
    const b = await aparelho(browser, 1280);
    expect(await logado(a), "A logado no começo").toBe(true);
    expect(await logado(b), "B logado no começo").toBe(true);

    // 1. A sai pelo menu da Conta (o avatar do topo do celular).
    await a.goto("/dashboard/conta/ajuda", { waitUntil: "domcontentloaded" });
    const avatar = a.getByTestId("topo-celular").locator('[data-testid^="conta-"][data-testid$="-celular"]').first();
    await expect(avatar).toBeVisible({ timeout: 30_000 });
    await avatar.click();
    const item = a.getByRole("menuitem", { name: "Sair" });
    await expect(item).toContainText("Encerrar a sessão neste aparelho.");
    await item.click();
    await a.waitForURL((u) => !u.pathname.startsWith("/dashboard"), { timeout: 30_000 });
    expect(await logado(a), "A sem sessão depois do Sair").toBe(false);
    // B NÃO caiu (escopo local).
    expect(await logado(b), "B continua logado depois do Sair de A").toBe(true);
    await expect(b.locator("h1:visible").first()).toBeVisible();

    // 2. C entra; B usa "Sair de todos os aparelhos".
    const c = await aparelho(browser, 1280);
    expect(await logado(c), "C logado").toBe(true);
    await b.goto("/dashboard/conta/seguranca", { waitUntil: "domcontentloaded" });
    const botao = b.getByTestId("sair-de-todos");
    await expect(botao).toBeVisible({ timeout: 30_000 });
    await expect(botao).toContainText("Sair de todos os aparelhos");
    // Cancelar não sai.
    await botao.click();
    await expect(b.getByTestId("sair-de-todos-confirmacao")).toContainText("Sair da conta em todos os aparelhos, inclusive neste?");
    await b.getByTestId("sair-de-todos-cancelar").click();
    await expect(b.getByTestId("sair-de-todos-confirmacao")).toHaveCount(0);
    expect(await logado(c), "C segue logado depois do Cancelar").toBe(true);
    // Confirmar sai de todos.
    await b.goto("/dashboard/conta/seguranca", { waitUntil: "domcontentloaded" });
    await b.getByTestId("sair-de-todos").click();
    await b.getByTestId("sair-de-todos-confirmar").click();
    await b.waitForURL((u) => !u.pathname.startsWith("/dashboard"), { timeout: 30_000 });
    expect(await logado(b), "B sem sessão depois do Sair de todos").toBe(false);
    await expect.poll(() => logado(c), { timeout: 30_000, message: "C perde a sessão (escopo global)" }).toBe(false);
    await c.screenshot({ path: `${SAIDA}/t924-c-depois-1280.png` });
    for (const p of [a, b, c]) await p.context().close();
  });
});
