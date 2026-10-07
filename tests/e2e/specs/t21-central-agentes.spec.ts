import { test, expect, type Page } from "@playwright/test";
import { authFile } from "../fixtures/auth";

/**
 * T21 — CENTRAL DE AGENTES v2 (/admin/agentes no visual do QG). Os dados vêm
 * do banco: o seed grava rondas "[lab]" (Bruno com alerta e P1 há 5 min,
 * Marina com falha, Helena com P2 de parceiros…).
 */
const semRolagemLateral = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

async function abrirAba(page: Page, nome: string) {
  await page.getByRole("tab", { name: nome }).click();
  await expect(page.getByRole("tab", { name: nome })).toHaveAttribute("aria-selected", "true");
}

test.describe("T21 — Central de Agentes v2", () => {
  test.use({ storageState: authFile("admin") });

  test("Equipe: Daniel → Moacir → Otávio, foto, status da última ronda e achados P1 reais", async ({ page }) => {
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    const central = page.getByTestId("central-agentes");
    // Dono no topo: não é agente — sem botões; com foto.
    const dono = central.getByTestId("agente-daniel");
    await expect(dono).toContainText("Daniel Rodovalho");
    await expect(dono).toContainText("Dono");
    await expect(dono.getByRole("button")).toHaveCount(0);
    expect(await dono.locator('img[src="/agentes/daniel.webp"]').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(256);
    // O Renato (engenheiro) aparece em Tecnologia, com foto.
    const renato = central.getByTestId("agente-renato");
    await expect(renato).toContainText("Engenheiro");
    expect(await renato.locator('img[src="/agentes/renato.webp"]').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(256);
    await expect(central.getByTestId("agente-moacir")).toBeVisible();
    await expect(central.getByTestId("agente-otavio")).toBeVisible();
    const bruno = central.getByTestId("agente-bruno");
    await expect(bruno).toContainText("Alerta");
    await expect(bruno.getByTestId("resumo-ronda")).toContainText("Varri site, banco e Vercel");
    await expect(bruno.getByTestId("achados-p1")).toContainText("Função sem search_path no Supabase");
    await expect(central.getByTestId("agente-marina")).toContainText("Falhou");
    // Foto em public/agentes/<slug>.webp carrega de verdade.
    const foto = bruno.locator('img[src="/agentes/bruno.webp"]');
    await expect(foto).toBeVisible();
    expect(await foto.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(256);
    // A Viva atende no chat do site (sem tarefa agendada): "No ar", não "Sem ronda".
    const viva = central.getByTestId("agente-viva");
    await expect(viva).toContainText("No ar");
    await expect(viva.getByTestId("no-ar")).toContainText("Atende no chat da /ajuda e por e-mail; não faz rondas.");
    await expect(viva).not.toContainText("Sem ronda ainda");
    expect(await viva.locator('img[src="/agentes/viva.webp"]').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(256);
    await expect(central.getByTestId("agente-vitoria")).toContainText("Planejado");
    await semRolagemLateral(page);
  });

  test("foto do dono é pública em /agentes/daniel.webp (autorizado pelo Daniel)", async ({ request }) => {
    const r = await request.get("/agentes/daniel.webp");
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toMatch(/image\/webp/);
  });

  test("Rede ao vivo e briefing com o resumo real da última ronda", async ({ page }) => {
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Rede ao vivo");
    await expect(page.getByTestId("rede-ao-vivo").locator("canvas")).toBeVisible();
    await page.getByRole("button", { name: /Assistir ao briefing/ }).click();
    const legenda = page.getByTestId("briefing-legenda");
    await expect(legenda).toContainText("Bruno");
    await expect(legenda).toContainText("Varri site, banco e Vercel", { timeout: 10_000 });
    await page.getByRole("button", { name: "Parar" }).click();
    await expect(legenda).toBeHidden();
    await semRolagemLateral(page);
  });

  test("Raio-X: ponto de atenção sai dos achados reais da camada", async ({ page }) => {
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Raio-X da Viva");
    const info = page.getByTestId("raio-x-info");
    await expect(info).toContainText("Banco e segurança");
    await expect(info.getByTestId("raio-x-atencao")).toContainText("Função sem search_path no Supabase");
    await page.getByRole("button", { name: "Parceiros", exact: true }).click();
    await expect(info).toContainText("Contador ainda não respondeu sobre o CNPJ");
    await semRolagemLateral(page);
  });

  test("Conversar e Sala de reunião: todos com foto, Renato incluído", async ({ page }) => {
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Conversar");
    await expect(page.getByRole("button", { name: /Renato/ }).first()).toBeVisible();
    await abrirAba(page, "Sala de reunião");
    const renato = page.getByRole("button", { name: /Renato/ }).first();
    await expect(renato).toBeVisible();
    await expect(renato.locator('img[src="/agentes/renato.webp"]')).toHaveCount(1);
  });

  test("Diário de bordo: última ronda de cada agente com chips de prioridade", async ({ page }) => {
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Diário de bordo");
    const diario = page.getByTestId("diario");
    await expect(diario).toContainText("Bruno");
    await expect(diario).toContainText("P1");
    await expect(diario).toContainText("Marina");
    await semRolagemLateral(page);
  });
});

test.describe("T21 — Central de Agentes no celular (390 px)", () => {
  test.use({ storageState: authFile("admin"), viewport: { width: 390, height: 844 } });

  test("nenhuma aba rola para o lado", async ({ page }) => {
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    for (const aba of ["Equipe", "Rede ao vivo", "Raio-X da Viva", "Diário de bordo", "Conversar", "Sala de reunião"]) {
      await abrirAba(page, aba);
      await semRolagemLateral(page);
    }
  });
});
