import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T1594 — Ordem fe7ac2e7.
  F10: /dashboard/imoveis/novo aberto 5 vezes seguidas pelo proprietário nunca cai em 404 nem na tela de erro.
  F12: depois de enviar a mensagem ao proprietário pelo anúncio, o rótulo "Enviando..."
  some da tela. O botão da coluna de preço vira "Mensagem enviada" e a janela da mensagem fecha.
  Guarda de código: src/app/(public)/imoveis/[id]/enviando-volta.test.ts.
*/
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.f12.${sufixo}@lab.vivanomads.test`, nome: "Dono Efedoze", role: "owner" as const };
const inq = { email: `inq.f12.${sufixo}@lab.vivanomads.test`, nome: "Morador Efedoze", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string } = {};

test.describe("T1594 — F10 (5 aberturas do novo anúncio) e F12 ('Enviando...' não fica preso)", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio F12 ${sufixo}`, { ativo: true });
  });

  test.afterAll(async () => {
    await apagarContas([ids.inq, ids.dono]);
  });

  test("1280 px: enviar mensagem → 'Mensagem enviada', sem 'Enviando...'", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: { cookies: [], origins: [] } });
    const page = await entrarNaPagina(await ctx.newPage(), inq.email, senha);
    await page.goto(`/imoveis/${ids.imovel}`, { waitUntil: "domcontentloaded" });
    const card = page.locator("#cartao-preco");
    const botao = card.getByRole("button", { name: "Enviar mensagem" });
    await expect(botao).toBeVisible({ timeout: 20_000 });
    await botao.click();
    const caixa = page.getByPlaceholder("Ex.: O condomínio tem academia? Aceita 2 pessoas?");
    await expect(caixa).toBeVisible();
    await caixa.fill("O prédio tem academia? Pergunta do teste F12.");
    await page.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(card.getByRole("button", { name: /Mensagem enviada/ })).toBeVisible({ timeout: 20_000 });
    await expect(caixa).toHaveCount(0);
    await expect(page.getByText("Enviando...", { exact: true })).toHaveCount(0);
    await ctx.close();
  });

  test("F10: 5 aberturas seguidas de /dashboard/imoveis/novo, nenhuma 404 nem erro", async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    const page = await entrarNaPagina(await ctx.newPage(), dono.email, senha);
    for (let i = 1; i <= 5; i++) {
      const resp = await page.goto("/dashboard/imoveis/novo", { waitUntil: "domcontentloaded" });
      expect(resp?.status(), `abertura ${i}`).toBe(200);
      await expect(page).toHaveURL(/\/dashboard\/imoveis\/novo/);
      await expect(page.getByTestId("painel-nao-encontrado"), `abertura ${i}`).toHaveCount(0);
      await expect(page.getByTestId("painel-erro"), `abertura ${i}`).toHaveCount(0);
      await expect(page).not.toHaveTitle(/Página não encontrada/);
    }
    await ctx.close();
  });
});
