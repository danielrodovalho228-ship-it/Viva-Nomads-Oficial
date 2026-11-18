import { test, expect } from "@playwright/test";
import { ehGravacaoDeLead } from "../fixtures/gravacao-lead";

/**
 * T130 — Página do imóvel: largura total + coluna de reserva (ordem 4f8023d1).
 * Anúncio de exemplo (ube-001): E694 — os botões de ação (Pedir para morar, Enviar mensagem, Agendar visita, Visita por
 * vídeo) NÃO ficam ativos: viram uma explicação clara e a saída para os imóveis reais; nada é gravado.
 * Nenhum telefone de dono antes do aceite.
 */
test.describe("T130 — Reserva no imóvel", () => {
  test("1280 px: coluna de reserva com a explicação do exemplo (sem botões de ação), taxas itemizadas e Caução separada", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const card = page.locator("#cartao-preco");
    await expect(card.getByTestId("exemplo-sem-acoes")).toContainText("não dá para pedir para morar, enviar mensagem, agendar visita ou fazer visita por vídeo");
    await expect(card.getByTestId("exemplo-ver-reais")).toHaveAttribute("href", "/buscar");
    for (const nome of ["Pedir para morar", "Enviar mensagem", "Agendar visita", "Visita por vídeo"]) {
      await expect(card.getByRole("button", { name: nome, exact: true })).toHaveCount(0);
    }
    await expect(card.getByRole("link", { name: /WhatsApp|Falar com a Viva/ })).toBeVisible();
    await expect(card.getByTestId("taxas-itemizadas").locator('[data-taxa="caucao"]')).toContainText("devolvida no fim");
    await expect(card.getByTestId("total-mensal").locator('[data-taxa="viva"]')).toContainText("R$");
    await expect(page.getByText(/fica disponível nos imóveis reais/)).toHaveCount(0);
  });

  test("1920 px: conteúdo contido em 1536 px e centralizado (ordens 4252e0d6 e e8e901b8; detalhes no t136)", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const caixa = await page.getByTestId("imovel-largura-total").boundingBox();
    expect(caixa!.width).toBeLessThanOrEqual(1536);
    const card = await page.locator("#cartao-preco").boundingBox();
    expect(card!.x + card!.width).toBeLessThanOrEqual(caixa!.x + caixa!.width + 1);
  });

  test("demonstração: sem botões de ação, nada a clicar que grave candidatura ou mensagem", async ({ page }) => {
    const gravacoes: string[] = [];
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    // Só conta o que acontece DEPOIS do carregamento e só POST que grava contato (candidatura/dúvida/visita): a página dispara
    // Server Actions de leitura sozinha depois de hidratar (lab 439be2b: 2 POST em /imoveis/ube-001).
    page.on("request", (r) => {
      if (ehGravacaoDeLead(r.method(), r.postData(), ["Posso entrar em dezembro?"])) gravacoes.push(r.url());
    });
    const card = page.locator("#cartao-preco");
    await expect(card.getByTestId("exemplo-sem-acoes")).toBeVisible(); // E713: a explicação + "Ver imóveis reais"; o aviso "esta solicitação não é enviada" saiu da coluna
    await expect(card.getByTestId("aviso-demo")).toHaveCount(0);
    await expect(card.getByTestId("cartao-solicitar")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Enviar mensagem" })).toHaveCount(0);
    await expect(page.getByTestId("mensagem-demo")).toBeVisible(); // o cartão do proprietário explica em vez de oferecer o botão
    await expect(page.getByTestId("sobre-proprietario").getByRole("button", { name: "Enviar mensagem" })).toHaveCount(0);
    expect(gravacoes).toEqual([]);
  });

  test("nenhum telefone de dono antes do aceite: WhatsApp vai para a Viva", async ({ page }) => {
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const href = (await page.locator("#cartao-preco").getByRole("link", { name: /WhatsApp|Falar com a Viva/ }).getAttribute("href")) ?? "";
    expect(href.startsWith("/ajuda") || href.startsWith("https://wa.me/")).toBe(true);
    expect(decodeURIComponent(href)).toContain("VN-UBE001");
    const html = await page.content();
    expect(html).not.toMatch(/wa\.me\/(?!55\d{10,11}\b)/);
    expect(html).not.toMatch(/tel:\+?\d/);
  });

  test("390 px: barra fixa do exemplo explica e leva aos imóveis reais (sem Pedir para morar nem Agendar visita); sem rolagem lateral", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/imoveis/ube-001", { waitUntil: "networkidle" });
    const barra = page.getByTestId("barra-fixa-imovel");
    await expect(barra).toBeVisible();
    await expect(barra.getByTestId("barra-ver-reais")).toHaveAttribute("href", "/buscar");
    await expect(barra.getByRole("button", { name: "Pedir para morar", exact: true })).toHaveCount(0);
    await expect(barra.getByRole("button", { name: "Agendar visita" })).toHaveCount(0);
    const card = page.locator("#cartao-preco");
    await expect(card.getByTestId("exemplo-sem-acoes")).toBeAttached();
    await expect(card.getByRole("link", { name: /WhatsApp da Viva|Falar com a Viva/ })).toBeAttached();
    await expect(barra.getByTestId("barra-demo")).toContainText("Anúncio de exemplo");
    const c = await barra.boundingBox();
    expect(c!.x).toBeGreaterThanOrEqual(0);
    expect(c!.x + c!.width).toBeLessThanOrEqual(391);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
