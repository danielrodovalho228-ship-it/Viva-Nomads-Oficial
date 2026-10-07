import { test, expect } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";

/**
 * T2 — PERSISTÊNCIA DE MODO (@criticos) — regressão do B1, a mais importante.
 * O modo (Proprietário ⇄ Inquilino) é PREFERÊNCIA DE PERFIL: alternar grava no
 * servidor; refresh, deep-link e nova aba mantêm. Deep-link a rota exclusiva de
 * proprietário abre no modo certo (nunca cai na visão de inquilino).
 */
// Conta própria quando existir (laboratório): trocar o modo do proprietário
// compartilhado mudava o menu dos specs que rodam em paralelo (T3).
const CONTA_T2 = hasAccount("proprietario_pro") ? "proprietario_pro" : "proprietario";

test.describe("T2 — Persistência de modo @criticos", () => {
  // Em ordem, num worker só: os testes deste arquivo mexem no MESMO estado da
  // conta (modo preferido / rascunhos) e se atrapalhavam com fullyParallel.
  test.describe.configure({ mode: "default" });
  test.use({ storageState: authFile(CONTA_T2) });

  async function trocarPara(page: import("@playwright/test").Page, alvo: RegExp) {
    await page.getByRole("tab", { name: alvo }).click();
    await expect(page.locator("aside")).toContainText(/Modo:/);
  }

  test("UM clique logo após carregar troca o modo e sobrevive ao F5", async ({ page }) => {
    // Regressão do "só funciona no 2º clique": a leitura do perfil que termina
    // DEPOIS do clique desfazia a troca. Clica assim que a página abre.
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const aside = page.locator("aside");
    await expect(aside).toContainText(/Modo:/);
    const atualEhDono = /Modo:\s*Propriet/i.test(await aside.innerText());
    const alvo = atualEhDono ? /Inquilino/i : /Propriet/i;
    await page.getByRole("tab", { name: alvo }).click(); // um clique só
    await expect(aside).toContainText(atualEhDono ? /Modo:\s*Inquilino/i : /Modo:\s*Propriet/i);
    // Espera as leituras de perfil em voo terminarem: o modo não pode voltar.
    await page.waitForLoadState("networkidle");
    await expect(aside).toContainText(atualEhDono ? /Modo:\s*Inquilino/i : /Modo:\s*Propriet/i);
    await page.reload({ waitUntil: "networkidle" });
    await expect(aside).toContainText(atualEhDono ? /Modo:\s*Inquilino/i : /Modo:\s*Propriet/i);
    // Volta ao modo original (a conta é compartilhada com outros specs).
    await page.getByRole("tab", { name: atualEhDono ? /Propriet/i : /Inquilino/i }).click();
    await expect(aside).toContainText(atualEhDono ? /Modo:\s*Propriet/i : /Modo:\s*Inquilino/i);
    await page.waitForLoadState("networkidle");
  });

  test("alternar modo + F5 mantém a escolha", async ({ page }) => {
    await page.goto("/dashboard");
    // Alterna para Inquilino, recarrega, confirma que MANTÉM.
    await trocarPara(page, /Inquilino/i);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("aside")).toContainText(/Modo:\s*Inquilino/i);
    // Volta para Proprietário, recarrega, confirma que MANTÉM.
    await trocarPara(page, /Propriet/i);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("aside")).toContainText(/Modo:\s*Propriet/i);
  });

  test("deep-link /dashboard/ferramentas abre no modo Proprietário, dentro da casca, sem redirect", async ({
    page,
  }) => {
    // Garante que a última preferência é Proprietário e vai direto pela URL.
    await page.goto("/dashboard");
    await trocarPara(page, /Propriet/i);
    await page.goto("/dashboard/ferramentas", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/dashboard\/ferramentas/); // não foi expulso
    await expect(page.locator("aside nav")).toBeVisible(); // dentro da casca
    await expect(page.locator("aside")).toContainText(/Modo:\s*Propriet/i);
  });

  test("nova aba (mesma sessão) mantém o modo", async ({ page, context }) => {
    await page.goto("/dashboard");
    await trocarPara(page, /Inquilino/i);
    const aba2 = await context.newPage();
    await aba2.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(aba2.locator("aside")).toContainText(/Modo:\s*Inquilino/i);
    await aba2.close();
  });

  test("bug 6 — F5 e nova aba logo após trocar, com a gravação ainda não feita, mantêm a troca", async ({ page, context }) => {
    await page.goto("/dashboard", { waitUntil: "networkidle" });
    await trocarPara(page, /Propriet/i);
    await expect(page.locator("aside")).toContainText(/Modo:\s*Propriet/i);
    await page.waitForLoadState("networkidle");
    // Segura a gravação do modo (server action = POST com cabeçalho next-action):
    // simula recarregar antes de o servidor gravar.
    const segurar = (route: import("@playwright/test").Route) =>
      route.request().method() === "POST" && route.request().headers()["next-action"] ? route.abort() : route.fallback();
    await page.route("**/*", segurar);
    await page.getByRole("tab", { name: /Inquilino/i }).click();
    await expect(page.locator("aside")).toContainText(/Modo:\s*Inquilino/i);
    await page.unroute("**/*", segurar);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("aside")).toContainText(/Modo:\s*Inquilino/i);
    // Ao abrir, a troca pendente foi regravada: outra aba também vê Inquilino.
    const aba2 = await context.newPage();
    await aba2.goto("/dashboard", { waitUntil: "networkidle" });
    await expect(aba2.locator("aside")).toContainText(/Modo:\s*Inquilino/i);
    await aba2.close();
    // Volta ao Proprietário (estado esperado pelos outros testes desta conta).
    await trocarPara(page, /Propriet/i);
    await page.waitForLoadState("networkidle");
  });

  test("B3 — página pública com sessão não mostra 'Entrar'", async ({ page }) => {
    await page.goto("/home", { waitUntil: "networkidle" });
    await expect(page.getByRole("link", { name: /Meu painel/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Entrar$/ })).toHaveCount(0);
  });
});
