import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T19 — ATENDIMENTO ONLINE (@criticos)
 * Chat da Viva visível (botão "Fale com a Viva" e bloco na /ajuda), "Falar com
 * uma pessoa" vira chamado com a conversa anexada, triagem por fila (Pix por
 * fora = P1 Antifraude) e e-mails em modo de teste (LAB_OUTBOX).
 *
 * Sem chave da IA (laboratório e previews), a Viva responde que está fora do ar
 * e oferece uma pessoa — o caminho do chamado é o mesmo.
 */
const LAB_OUTBOX = process.env.LAB_OUTBOX;
const noLaboratorio = process.env.INTEGRACOES_SIMULADAS === "on";

async function abrirChamadoPeloChat(page: Page, opts: { nome?: string; email?: string; pedido?: string }) {
  await page.getByRole("button", { name: /Falar com uma pessoa/i }).click();
  const form = page.getByTestId("form-pessoa");
  if (opts.nome) await form.getByLabel("Seu nome").fill(opts.nome);
  if (opts.email) await form.getByLabel("Seu e-mail").fill(opts.email);
  if (opts.pedido) await form.getByLabel("Pedido para a equipe").fill(opts.pedido);
  await form.getByRole("button", { name: "Abrir chamado" }).click();
  const ok = page.getByTestId("chamado-aberto-chat");
  await expect(ok).toBeVisible({ timeout: 20_000 });
  const numero = (await ok.innerText()).match(/VN-\d+/)?.[0];
  expect(numero, "número do chamado").toBeTruthy();
  return numero!;
}

test.describe("T19 — Visitante @criticos", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.skip(!noLaboratorio, "Abre chamados de verdade: só no laboratório (banco local).");

  test("conversa com a Viva no botão flutuante e abre chamado com a conversa", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("fale-com-a-viva").click();
    const chat = page.getByRole("dialog", { name: "Chat com a Viva" });
    await expect(chat).toContainText("assistente virtual da Viva Nomads");
    await chat.getByLabel("Sua mensagem para a Viva").fill("Como funciona a Caução?");
    await chat.getByRole("button", { name: "Enviar" }).click();
    // Com ou sem IA, sempre há resposta e o caminho para uma pessoa.
    await expect(chat.locator("div.bg-white.shadow-sm").nth(1)).toBeVisible({ timeout: 30_000 });
    const numero = await abrirChamadoPeloChat(page, { nome: "Visitante Teste", email: "visitante.chat@lab.vivanomads.test" });
    await expect(page.getByTestId("chamado-aberto-chat")).toContainText(/confirmação para o seu e-mail/);
    if (LAB_OUTBOX && fs.existsSync(LAB_OUTBOX)) {
      const linhas = fs.readFileSync(LAB_OUTBOX, "utf8");
      expect(linhas, "confirmação do chamado registrada (modo de teste)").toContain(`Recebemos seu chamado — ${numero}`);
    }
  });

  test("'pediram Pix por fora' = resposta fixa e chamado P1 na fila Antifraude", async ({ page, browser }) => {
    await page.goto("/ajuda", { waitUntil: "networkidle" });
    const bloco = page.getByTestId("viva-chat-bloco");
    await bloco.getByLabel("Sua mensagem para a Viva").fill("O dono pediu pra eu pagar o Pix por fora, direto pra ele");
    await bloco.getByRole("button", { name: "Enviar" }).click();
    await expect(bloco).toContainText(/nunca pede Pix/, { timeout: 15_000 });
    const numero = await abrirChamadoPeloChat(page, { nome: "Visitante Pix", email: "visitante.pix@lab.vivanomads.test" });

    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const adm = await ctx.newPage();
    await adm.goto("/admin/atendimento?aba=fila&fila=antifraude", { waitUntil: "networkidle" });
    const linha = adm.locator("body");
    await expect(linha).toContainText(numero);
    await expect(linha).toContainText("Antifraude (Fernanda)");
    await adm.goto(`/admin/atendimento?aba=fila&fila=antifraude&prioridade=p1`, { waitUntil: "networkidle" });
    await expect(adm.locator("body")).toContainText(numero);
    await ctx.close();
  });
});

test.describe("T19 — Logado @criticos", () => {
  test.use({ storageState: authFile("inquilino") });
  test.skip(!noLaboratorio, "Abre chamados de verdade: só no laboratório (banco local).");

  test("abre chamado pelo bloco da /ajuda e acompanha pelo link", async ({ page }) => {
    await page.goto("/ajuda", { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("Assistente Viva 24 h · resposta de uma pessoa em até 24 h");
    await expect(page.locator("body")).not.toContainText(/7h às 22h|Atendimento humano/);
    await expect(page.getByRole("link", { name: /^(contato|suporte)@vivanomads\.com\.br$/ }).first()).toBeVisible();
    const bloco = page.getByTestId("viva-chat-bloco");
    await bloco.getByRole("button", { name: /Falar com uma pessoa/i }).click();
    await bloco.getByLabel("Pedido para a equipe").fill("Quero ajuda para entender a devolução da caução.");
    await bloco.getByRole("button", { name: "Abrir chamado" }).click();
    const ok = page.getByTestId("chamado-aberto-chat");
    await expect(ok).toBeVisible({ timeout: 20_000 });
    await ok.getByRole("link", { name: "Abrir o chamado" }).click();
    await expect(page).toHaveURL(/\/ajuda\?chamado=VN-/);
    await expect(page.locator("body")).toContainText("Quero ajuda para entender a devolução da caução.");
  });
});
