import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
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
    // Foto abaixo da dobra carrega sob demanda: rola até ela e espera carregar.
    const fotoViva = viva.locator('img[src="/agentes/viva.webp"]');
    await fotoViva.scrollIntoViewIfNeeded();
    await expect.poll(() => fotoViva.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(256);
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

  test("Executar agora: correção pedida ao Bruno vai para o Renato, dispara e a ordem aparece como Enviada", async ({ page }) => {
    const marca = `t21-${Date.now()}`;
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Conversar");
    await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Bruno/ }).click();
    await page.getByPlaceholder("Escreva para Bruno…").fill(`corrija o sitemap com URL que dá 404 (${marca})`);
    const botao = page.getByTestId("executar-agora");
    await expect(botao).toHaveText("Executar agora → Renato");
    await botao.click();
    // Laboratório: disparo simulado (nada sai para a rede), link de sessão fictício.
    await expect(page.getByTestId("aviso-ordem")).toContainText("Renato começou agora");
    await expect(page.getByRole("link", { name: "Abrir a sessão" })).toHaveAttribute("href", /^https:\/\/claude\.ai\/code\//);
    const ordem = page.getByTestId("ordem").filter({ hasText: marca });
    await expect(ordem).toHaveAttribute("data-estado", "enviada");
    await expect(ordem).toContainText("Enviada");
    await expect(ordem.getByRole("link", { name: "Ver sessão" })).toBeVisible();
  });

  test("Chat honesto: pedido de ação não promete — oferece Executar agora para quem faz", async ({ page }) => {
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Conversar");
    // Agentes comuns não fazem nada no mundo pelo chat (o Moacir gerente é o único que investiga e dispara).
    await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Bruno/ }).click();
    await page.getByPlaceholder("Escreva para Bruno…").fill("corrige o bug do /conferir e aplica a migração");
    await page.getByRole("button", { name: "Perguntar" }).click();
    await expect(page.getByText(/precisa de uma sessão real — use Executar agora \(vai para Renato\)/).last()).toBeVisible();
    const sug = page.getByTestId("sugestao-executar");
    await expect(sug).toContainText("Renato");
    await expect(sug.getByRole("button", { name: "Executar agora → Renato" })).toBeEnabled();
  });

  test("Moacir gerente: 'chegou chamado novo?' consulta o banco, pergunta à Viva e responde com código e prazo", async ({ page, browser }) => {
    test.skip(process.env.INTEGRACOES_SIMULADAS !== "on", "Abre chamado de verdade: só no laboratório.");
    // Um chamado novo de visitante (como chega de verdade, pelo chat da /ajuda).
    const vis = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const p = await vis.newPage();
    await p.goto("/ajuda", { waitUntil: "networkidle" });
    const bloco = p.getByTestId("viva-chat-bloco");
    await bloco.getByRole("button", { name: /Falar com uma pessoa/i }).click();
    const form = p.getByTestId("form-pessoa");
    await form.getByLabel("Seu nome").fill("Visitante T21");
    await form.getByLabel("Seu e-mail").fill(`t21.${Date.now()}@lab.vivanomads.test`);
    await form.getByLabel("Pedido para a equipe").fill("Quero saber como funciona a Caução antes de anunciar.");
    await form.getByRole("button", { name: "Abrir chamado" }).click();
    const ok = p.getByTestId("chamado-aberto-chat");
    await expect(ok).toBeVisible({ timeout: 20_000 });
    const numero = (await ok.innerText()).match(/VN-\d+/)![0];
    await vis.close();

    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Conversar");
    await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Moacir/ }).click();
    await page.getByPlaceholder("Escreva para Moacir…").fill("Chegou chamado novo?");
    await page.getByRole("button", { name: "Perguntar" }).click();
    const passos = page.getByTestId("passo-gerente");
    await expect(passos.filter({ hasText: "Moacir → Viva:" }).last()).toBeVisible({ timeout: 20_000 });
    await expect(passos.filter({ hasText: /^Viva: Tenho \d+ chamado/ }).last()).toBeVisible();
    const resposta = page.getByText(/^O que encontrei: /).last();
    await expect(resposta).toContainText(numero);
    await expect(resposta).toContainText(/Prazo: \d{2}\/\d{2} \d{2}:\d{2}/);
    await expect(resposta).toContainText(/dados de \d{2}\/\d{2} \d{2}:\d{2}/);
  });

  test("Retorno: execução que o Moacir disparou terminou → o resultado aparece na conversa dele", async ({ page }) => {
    const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    test.skip(!URL || !SERVICE, "Precisa da service role do laboratório.");
    const adm = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const { data: ordem } = await adm.from("agentes_ordens").insert({ agente_slug: "renato", texto: "Pedido do Moacir (chat da Central): corrigir o sitemap [t21]", status: "concluida" }).select("id").single();
    await adm.rpc("registrar_ronda", {
      p_slug: "renato", p_inicio: new Date().toISOString(), p_fim: new Date().toISOString(), p_status: "ok",
      p_resumo: "[lab] PR aberto com a correção do sitemap.", p_achados: [], p_ordens: [ordem!.id], p_link: "https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/999",
    });
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Conversar");
    await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Moacir/ }).click();
    const retorno = page.getByText(`(ordem ${ordem!.id})`);
    await expect(retorno).toContainText("Retorno: Renato terminou o que eu pedi (ok).");
    await expect(retorno).toContainText("pull/999");
    // Uma vez só: recarregar não duplica.
    await page.reload({ waitUntil: "networkidle" });
    const { count } = await adm.from("agentes_conversas").select("id", { count: "exact", head: true }).like("texto", `%(ordem ${ordem!.id})%`);
    expect(count).toBe(1);
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
