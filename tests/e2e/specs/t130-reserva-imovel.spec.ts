import { test, expect } from "@playwright/test";

/**
 * T130 — Página do imóvel: largura total + coluna de reserva (ordem 4f8023d1).
 * Anúncio de exemplo (ube-001): os 3 botões aparecem e são clicáveis em DEMONSTRAÇÃO
 * (aviso claro, nada é gravado); nenhum telefone de dono antes do aceite.
 */
const AVISO = /Anúncio de exemplo: esta solicitação não é enviada/;

test.describe("T130 — Reserva no imóvel", () => {
  test("1280 px: coluna de reserva com 3 botões, taxas itemizadas e Caução separada", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const card = page.locator("#cartao-preco");
    await expect(card.getByRole("button", { name: "Solicitar reserva" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Enviar mensagem" })).toBeVisible();
    await expect(card.getByRole("link", { name: /WhatsApp/ })).toBeVisible();
    await expect(card.getByTestId("taxas-itemizadas").locator('[data-taxa="caucao"]')).toContainText("devolvida no fim");
    await expect(card.getByTestId("taxas-itemizadas").locator('[data-taxa="viva"]')).toContainText("R$");
    await expect(page.getByText(/fica disponível nos imóveis reais/)).toHaveCount(0);
  });

  test("1920 px: conteúdo ocupa a tela (sem a faixa vazia de 350 px de cada lado)", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const caixa = await page.getByTestId("imovel-largura-total").boundingBox();
    expect(caixa!.width).toBeGreaterThan(1800);
    const card = await page.locator("#cartao-preco").boundingBox();
    expect(card!.x + card!.width).toBeGreaterThan(1700);
  });

  test("demonstração: clicar nos botões mostra o aviso e NÃO grava candidatura nem mensagem", async ({ page }) => {
    const gravacoes: string[] = [];
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    // Só conta o que acontece DEPOIS dos cliques (a leitura inicial da página também usa POST).
    page.on("request", (r) => {
      if (r.method() === "POST") gravacoes.push(r.url());
    });
    const card = page.locator("#cartao-preco");
    await card.getByRole("button", { name: "Solicitar reserva" }).click();
    await expect(card.getByText(AVISO).last()).toBeVisible();
    await card.getByRole("button", { name: "Enviar mensagem" }).click();
    await page.getByRole("dialog").locator("textarea").fill("Posso entrar em dezembro?");
    await page.getByRole("dialog").getByRole("button", { name: "Enviar" }).click();
    await expect(page.getByRole("dialog").getByText(AVISO)).toBeVisible();
    expect(gravacoes).toEqual([]);
  });

  test("nenhum telefone de dono antes do aceite: WhatsApp vai para a Viva", async ({ page }) => {
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const href = (await page.locator("#cartao-preco").getByRole("link", { name: /WhatsApp/ }).getAttribute("href")) ?? "";
    expect(href.startsWith("/ajuda") || href.startsWith("https://wa.me/")).toBe(true);
    expect(decodeURIComponent(href)).toContain("VN-UBE001");
    const html = await page.content();
    expect(html).not.toMatch(/wa\.me\/(?!55\d{10,11}\b)/);
    expect(html).not.toMatch(/tel:\+?\d/);
  });

  test("390 px: barra fixa com Solicitar reserva / Mensagem / WhatsApp, sem rolagem lateral", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const barra = page.getByTestId("barra-fixa-imovel");
    await expect(barra).toBeVisible();
    await expect(barra.getByRole("button", { name: "Solicitar reserva" })).toBeVisible();
    await expect(barra.getByRole("button", { name: "Enviar mensagem" })).toBeVisible();
    await expect(barra.getByRole("link", { name: "WhatsApp da Viva" })).toBeVisible();
    await expect(barra.getByTestId("barra-demo")).toHaveText(AVISO);
    const c = await barra.boundingBox();
    expect(c!.x).toBeGreaterThanOrEqual(0);
    expect(c!.x + c!.width).toBeLessThanOrEqual(391);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await barra.getByRole("button", { name: "Solicitar reserva" }).click();
    await expect(page.getByText(AVISO).first()).toBeVisible();
  });
});
