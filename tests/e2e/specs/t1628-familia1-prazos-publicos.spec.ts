import { test, expect, type Page } from "@playwright/test";

/**
 * T1628 — FAMÍLIA 1 (prazos públicos), guarda a 390 px: cada superfície mostra o prazo do SEU canal, igual à fonte única
 * (src/config/prazos-canais.ts / config/atendimento.ts), inteiro na tela e sem rolagem lateral. Sem login nem banco.
 *  - E770/E876 /empresas: bloco "Fale com a gente" com o prazo do canal empresas (7 dias) e a taxa; passos e FAQ iguais.
 *  - E854 /como-funciona: taxa do proprietário (escada) e a linha de dúvidas com o prazo do atendimento (24 h).
 *  - E860 /ajuda/proprietarios: "Como virar parceiro" com o prazo do canal parceiro (7 dias).
 *  - E861 /ajuda/seguranca: golpe e código de acesso com o prazo do atendimento (24 h).
 *  - E878 /parceiros: o formulário de cadastro mostra o prazo do canal parceiro antes do botão de enviar.
 *  - E835: nenhuma dessas páginas promete outro prazo de resposta (2 dias úteis, 48 h, 3 dias…).
 */
const PRAZO_EMPRESAS = "A equipe responde em até 7 dias, no e-mail informado, com as opções de imóveis.";
const PRAZO_PARCERIA = "A Viva responde por e-mail em até 7 dias.";
const PRAZO_SUPORTE = "em até 24 h";
const OUTROS_PRAZOS = /respond[^.]{0,60}(2 dias úteis|48 ?h|3 dias|1 dia útil|5 dias)/i;

async function abrir(page: Page, rota: string) {
  await page.setViewportSize({ width: 390, height: 844 });
  const r = await page.goto(rota, { waitUntil: "domcontentloaded" });
  expect(r?.status() ?? 0, `${rota} abre`).toBeLessThan(400);
}

async function inteiro(page: Page, testId: string, onde: string) {
  const el = page.getByTestId(testId).first();
  await el.scrollIntoViewIfNeeded();
  await expect(el, `${onde}: ${testId} à vista`).toBeVisible({ timeout: 30_000 });
  const c = (await el.boundingBox())!;
  expect(c.x, `${onde}: ${testId} começa dentro da tela`).toBeGreaterThanOrEqual(0);
  expect(c.x + c.width, `${onde}: ${testId} termina dentro da tela`).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${onde}: sem rolagem lateral`).toBe(true);
}

async function semOutroPrazo(page: Page, onde: string) {
  const texto = await page.locator("main").first().innerText();
  expect(texto.match(OUTROS_PRAZOS)?.[0] ?? null, `${onde}: nenhum outro prazo de resposta`).toBeNull();
}

test.describe("T1628 — Família 1: um prazo por canal, a 390 px", () => {
  test("E770/E876 /empresas: prazo do canal empresas e taxa no bloco do formulário; passos e FAQ iguais", async ({ page }) => {
    await abrir(page, "/empresas");
    await inteiro(page, "empresas-prazo-resposta", "/empresas");
    await expect(page.getByTestId("empresas-prazo-resposta")).toHaveText(PRAZO_EMPRESAS);
    await inteiro(page, "empresas-taxa", "/empresas");
    await expect(page.getByTestId("empresas-taxa")).toContainText("quem vem morar não paga taxa");
    await expect(page.getByText("Respondemos em até 7 dias com opções de imóveis mobiliados.")).toBeVisible();
    await expect(page.getByTestId("empresas-faq").getByText(PRAZO_EMPRESAS)).toBeVisible();
    await semOutroPrazo(page, "/empresas");
  });

  test("E854 /como-funciona: taxa do proprietário e dúvidas com o prazo do atendimento", async ({ page }) => {
    await abrir(page, "/como-funciona");
    await inteiro(page, "cf-taxa-proprietario", "/como-funciona");
    await expect(page.getByTestId("cf-taxa-proprietario")).toContainText("Quanto mais imóveis ativos, menor a taxa");
    await inteiro(page, "cf-prazo-resposta", "/como-funciona");
    await expect(page.getByTestId("cf-prazo-resposta")).toContainText(`resposta de uma pessoa ${PRAZO_SUPORTE}`);
    await expect(page.getByTestId("cf-prazo-resposta").getByRole("link", { name: "Fale com a Viva" })).toHaveAttribute("href", "/ajuda/fale-com-a-viva");
    await semOutroPrazo(page, "/como-funciona");
  });

  test("E860 /ajuda/proprietarios: a análise do parceiro com o prazo do canal parceiro", async ({ page }) => {
    await abrir(page, "/ajuda/proprietarios");
    const main = page.locator("main").first();
    // As respostas abrem ao tocar na pergunta (acordeão da Central).
    await main.getByRole("button", { name: "Como posso virar parceiro da Viva?" }).click({ timeout: 30_000 });
    await expect(main).toContainText(PRAZO_PARCERIA);
    await semOutroPrazo(page, "/ajuda/proprietarios");
  });

  test("E861 /ajuda/seguranca: golpe e código de acesso com o prazo do atendimento", async ({ page }) => {
    await abrir(page, "/ajuda/seguranca");
    const main = page.locator("main").first();
    await main.getByRole("button", { name: "Pediram para eu pagar por fora (Pix direto). É seguro?" }).click({ timeout: 30_000 });
    await expect(main).toContainText(`Seu caso tem prioridade máxima: a equipe já foi avisada e uma pessoa responde ${PRAZO_SUPORTE}.`);
    await main.getByRole("button", { name: "Não recebi o código de acesso" }).click();
    await expect(main).toContainText(`Persistindo, abra um chamado: Uma pessoa da equipe responde ${PRAZO_SUPORTE}.`);
    await semOutroPrazo(page, "/ajuda/seguranca");
  });

  test("E878 /parceiros: o cadastro mostra o prazo do canal parceiro antes do botão de enviar", async ({ page }) => {
    await abrir(page, "/parceiros");
    await inteiro(page, "seja-parceiro-prazo", "/parceiros");
    await expect(page.getByTestId("seja-parceiro-prazo")).toContainText(PRAZO_PARCERIA);
    const prazo = (await page.getByTestId("seja-parceiro-prazo").boundingBox())!;
    const enviar = (await page.getByTestId("seja-parceiro-enviar").boundingBox())!;
    expect(prazo.y, "o prazo vem antes do botão de enviar").toBeLessThan(enviar.y);
    await expect(page.getByTestId("parceiros-prazo-resposta")).toHaveText(PRAZO_PARCERIA);
    await semOutroPrazo(page, "/parceiros");
  });
});
