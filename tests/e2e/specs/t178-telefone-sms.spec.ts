import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";
import { hasAccount } from "../fixtures/accounts";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T178 — Verificação de telefone por SMS, no MODO SIMULADO do laboratório (prompt 7), a 390 e 1280 px.
  1. Número inválido → erro claro; código errado → erro; código certo (simulado) → "Telefone verificado".
  2. "Reenviar" só depois de 60 s.
  3. O selo aparece no cartão do proprietário (anúncio) e na página pública; o número nunca aparece.
  4. Número já verificado em outra conta → recusa neutra.
  5. Trocar o número zera o selo até confirmar de novo.
  6. /admin/usuarios mostra "Telefone verificado" sim/não, sem o número.
  7. Conta sem verificação usa a plataforma normalmente.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
// Números únicos por rodada (DDD 34, celular começando com 9).
const t = String(Date.now());
const NUM_1 = `(34) 98${t.slice(-7, -4)}-${t.slice(-4)}`;
const NUM_2 = `(34) 97${t.slice(-7, -4)}-${t.slice(-4)}`;
const DIGITOS = (n: string) => n.replace(/\D/g, "");
const dono = { email: `dono.fone.${sufixo}@lab.vivanomads.test`, nome: "Telma Fonedona Sobrenome", role: "owner" as const };
const inq = { email: `inq.fone.${sufixo}@lab.vivanomads.test`, nome: "Igor Foneinq Sobrenome", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string } = {};
const SAIDA = "tests/laboratorio/saida";

async function abrirConfianca(page: Page, largura: number) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.goto("/dashboard/conta/dados", { waitUntil: "networkidle" });
  const painel = page.getByTestId("confianca-telefone");
  await expect(painel).toBeVisible({ timeout: 20_000 });
  return painel;
}

test.describe("T178 — telefone verificado por SMS (modo simulado)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (modo simulado).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await adm().from("limites_uso").delete().like("chave", "sms:%");
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do telefone ${sufixo}`, { ativo: true });
  });
  test.afterAll(async () => {
    await adm().from("limites_uso").delete().like("chave", "sms:%");
    await apagarContas([ids.inq, ids.dono]);
  });

  test("390px: número inválido, código errado e código certo → Telefone verificado", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    const painel = await abrirConfianca(page, 390);
    await expect(painel).toContainText("+55");

    await painel.getByLabel("Celular").fill("(34) 3333-4444");
    await painel.getByRole("button", { name: "Enviar código" }).click();
    await expect(painel.getByTestId("telefone-erro")).toContainText("Número inválido");

    await painel.getByLabel("Celular").fill(DIGITOS(NUM_1));
    await expect(painel.getByLabel("Celular")).toHaveValue(NUM_1); // máscara (XX) 9XXXX-XXXX
    await painel.getByRole("button", { name: "Enviar código" }).click();
    await expect(painel.getByRole("status")).toContainText("Código enviado");
    await expect(painel.getByTestId("telefone-reenviar")).toBeDisabled();
    await expect(painel.getByTestId("telefone-reenviar")).toHaveText(/Reenviar em \d+ s/);

    await painel.getByLabel("Código de 6 dígitos").fill("000000");
    await painel.getByRole("button", { name: "Confirmar" }).click();
    await expect(painel.getByTestId("telefone-erro")).toContainText("Código errado ou expirado");

    await painel.getByLabel("Código de 6 dígitos").fill("123456");
    await painel.getByRole("button", { name: "Confirmar" }).click();
    await expect(painel.getByTestId("telefone-verificado")).toHaveText("Telefone verificado");
    await page.screenshot({ path: `${SAIDA}/t178-verificado-390.png`, fullPage: false });

    // O número nunca aparece na tela depois de verificado, nem na URL.
    await expect(page.locator("main")).not.toContainText(NUM_1);
    expect(page.url()).not.toContain(DIGITOS(NUM_1));
    await page.context().close();
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px: selo no cartão do proprietário e na página pública, sem o número`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, storageState: { cookies: [], origins: [] } });
      const page = await ctx.newPage();
      await page.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("pagina-proprietario")).toContainText("Telefone verificado");
      await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
      const card = page.getByTestId("sobre-proprietario");
      await expect(card.getByTestId("proprietario-selos")).toContainText("Telefone verificado", { timeout: 20_000 });
      const html = await page.content();
      expect(html).not.toContain(DIGITOS(NUM_1).slice(2));
      await card.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${SAIDA}/t178-selo-cartao-${largura}.png`, fullPage: false });
      await ctx.close();
    });
  }

  test("número já verificado em outra conta → recusa neutra (1280)", async ({ browser }) => {
    const page = await entrar(browser, inq.email, senha);
    const painel = await abrirConfianca(page, 1280);
    await painel.getByLabel("Celular").fill(NUM_1);
    await painel.getByRole("button", { name: "Enviar código" }).click();
    await expect(painel.getByTestId("telefone-erro")).toHaveText("Não foi possível usar este número. Confira o número ou use outro.");
    // Conta sem verificação usa a plataforma normalmente.
    for (const rota of ["/dashboard", "/buscar", `/imoveis/${ids.imovel}`]) {
      const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
      expect(r?.status(), rota).toBeLessThan(400);
    }
    await page.context().close();
  });

  test("trocar o número zera o selo até confirmar de novo (1280)", async ({ browser }) => {
    const page = await entrar(browser, dono.email, senha);
    const painel = await abrirConfianca(page, 1280);
    await expect(painel.getByTestId("telefone-verificado")).toBeVisible();
    await painel.getByRole("button", { name: "Trocar número" }).click();
    await painel.getByLabel("Celular").fill(NUM_2);
    await painel.getByRole("button", { name: "Enviar código" }).click();
    await expect(painel.getByRole("status")).toContainText("Código enviado");
    await page.screenshot({ path: `${SAIDA}/t178-trocando-1280.png`, fullPage: false });

    // Selo some na página pública (dinâmica) enquanto o novo número não é confirmado.
    const pub = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p2 = await pub.newPage();
    await p2.goto(`/proprietario/${ids.dono}`, { waitUntil: "domcontentloaded" });
    await expect(p2.getByTestId("pagina-proprietario")).toBeVisible();
    await expect(p2.getByTestId("pagina-proprietario")).not.toContainText("Telefone verificado");

    await painel.getByLabel("Código de 6 dígitos").fill("123456");
    await painel.getByRole("button", { name: "Confirmar" }).click();
    await expect(painel.getByTestId("telefone-verificado")).toBeVisible();
    await p2.reload({ waitUntil: "domcontentloaded" });
    await expect(p2.getByTestId("pagina-proprietario")).toContainText("Telefone verificado");
    await pub.close();
    await page.context().close();
  });

  test("Complete seu perfil: celular entra como item opcional (390)", async ({ browser }) => {
    const page = await entrar(browser, inq.email, senha);
    // A1: o medidor "Complete seu perfil" fica na tela Perfil.
    await page.goto("/dashboard/conta/perfil", { waitUntil: "networkidle" });
    await expect(page.getByTestId("complete-perfil")).toContainText("Verifique seu celular: perfis verificados passam mais confiança");
    await page.context().close();
  });

  test.describe("admin", () => {
    test.skip(!hasAccount("admin"), "conta admin do laboratório não configurada");
    test.use({ storageState: authFile("admin") });
    test("/admin/usuarios: coluna Telefone verificado (sim/não), sem o número (1280)", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/admin/usuarios?q=${encodeURIComponent("Telma Fonedona")}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("columnheader", { name: "Telefone verificado" })).toBeVisible();
      await expect(page.getByTestId("admin-telefone-verificado").first()).toHaveText("Sim");
      await expect(page.locator("main")).not.toContainText(DIGITOS(NUM_2).slice(2));
      await page.screenshot({ path: `${SAIDA}/t178-admin-1280.png`, fullPage: false });
    });
  });
});
