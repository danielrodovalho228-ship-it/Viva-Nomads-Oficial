import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T42 — CONTATO E TELEFONE (laboratório, ordem 225d0648).
 * Regra de negócio: a Viva NÃO expõe telefone nem e-mail de ninguém antes do aceite — por isso não existe
 * botão "WhatsApp" ou "ligar" (tel:/wa.me) para o dono nem para o inquilino nas telas do anúncio e do painel.
 * O único link de contato é o do SUPORTE da Viva (mailto). Aqui o teste garante isso com um telefone REAL
 * gravado no perfil do dono (se algum dia vazar para a tela, este teste quebra) e confere o atendimento da Viva.
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const TELEFONE = "34987650001";
const dono = { email: `dono.tel.${sufixo}@lab.vivanomads.test`, nome: "Telma Telefone", role: "owner" as const };
const inq = { email: `inq.tel.${sufixo}@lab.vivanomads.test`, nome: "Tales Telefone", role: "tenant" as const };
const ids: { dono?: string; inq?: string; imovel?: string } = {};

const SEM_CONTATO = [TELEFONE, "98765-0001", "98765 0001", dono.email];

test.describe("T42 — Contato e telefone", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.inq = await criarConta(inq, senha);
    await adm().from("profiles").update({ phone: TELEFONE }).eq("id", ids.dono);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio do contato ${sufixo}`, { ativo: true });
    await fotosReais(ids.imovel, ids.dono);
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono, ids.inq]);
  });

  async function semContato(page: import("@playwright/test").Page, rota: string) {
    await page.goto(rota, { waitUntil: "networkidle" });
    expect(await page.locator('a[href^="tel:"]').count(), `tel: em ${rota}`).toBe(0);
    expect(await page.locator('a[href*="wa.me"], a[href*="api.whatsapp.com"]').count(), `wa.me em ${rota}`).toBe(0);
    const html = await page.content();
    for (const trecho of SEM_CONTATO) expect(html, `"${trecho}" vazou em ${rota}`).not.toContain(trecho);
  }

  test("visitante: anúncio sem telefone, e-mail nem botão de WhatsApp/ligar", async ({ page }) => {
    await semContato(page, `/imoveis/${ids.imovel}`);
  });

  test("inquilino logado, antes do aceite: anúncio e painel sem contato do dono", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, inq.email, senha);
    await semContato(page, `/imoveis/${ids.imovel}`);
    await semContato(page, "/dashboard/candidaturas");
    await page.context().close();
  });

  test("dono: o painel de interessados também não tem botão de ligar nem de WhatsApp", async ({ browser }) => {
    test.setTimeout(90_000);
    const page = await entrar(browser, dono.email, senha);
    await page.goto("/dashboard/leads", { waitUntil: "networkidle" });
    expect(await page.locator('a[href^="tel:"], a[href*="wa.me"]').count()).toBe(0);
    await page.context().close();
  });

  test("atendimento: o contato com a Viva é o e-mail do suporte e o chat responde", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/ajuda/fale-com-a-viva", { waitUntil: "networkidle" });
    await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
    const bloco = page.getByTestId("viva-chat-bloco");
    await expect(bloco).toBeVisible();
    await bloco.getByLabel("Sua mensagem para a Viva").fill("Como falo com o dono do imóvel?");
    await bloco.getByRole("button", { name: "Enviar" }).click();
    // Com ou sem IA há sempre uma resposta (a Viva ou o aviso com o caminho para uma pessoa).
    await expect(bloco.getByTestId("viva-chat-msg-viva").nth(1)).toBeVisible({ timeout: 30_000 });
    await expect(bloco).not.toContainText(TELEFONE);
  });
});
