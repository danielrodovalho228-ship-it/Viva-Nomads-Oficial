import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";

/**
 * T26 — AGENTES PROATIVOS: encaminhamento entre agentes (0087) e Rede ao vivo REAL.
 * As rondas entram pela mesma porta das rotinas (rpc registrar_ronda com a
 * service role). Disparo de rotina simulado no laboratório (LAB_OUTBOX).
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LAB_OUTBOX = process.env.LAB_OUTBOX;
const adm = () => createClient(URL!, SERVICE!, { auth: { persistSession: false } });

async function ronda(slug: string, resumo: string, achados: unknown[], ordens: string[] = [], link: string | null = null) {
  const agora = new Date().toISOString();
  const { data, error } = await adm().rpc("registrar_ronda", { p_slug: slug, p_inicio: agora, p_fim: agora, p_status: achados.length ? "alerta" : "ok", p_resumo: resumo, p_achados: achados, p_ordens: ordens, p_link: link });
  expect(error).toBeNull();
  return data as string;
}

async function abrirAba(page: Page, nome: string) {
  await page.getByRole("tab", { name: nome }).click();
  await expect(page.getByRole("tab", { name: nome })).toHaveAttribute("aria-selected", "true");
}

test.describe("T26 — Encaminhamento entre agentes e Rede ao vivo real", () => {
  test.use({ storageState: authFile("admin") });
  test.beforeEach(() => test.skip(!URL || !SERVICE, "Precisa da service role do laboratório."));

  test("achado P1 do Bruno com para=otavio vira ordem, dispara o Otávio e o retorno volta para o Bruno", async ({ page }) => {
    const marca = `t26-${Date.now()}`;
    const rondaId = await ronda("bruno", `[lab] ${marca}`, [
      { prioridade: "P1", titulo: `Login cai no Safari ${marca}`, detalhe: "erro 500 no /auth", para: "otavio" },
      { prioridade: "P3", titulo: "nota sem destino" },
    ]);
    const { data: ordens } = await adm().from("agentes_ordens").select("id, agente_slug, origem_slug, prioridade, texto").eq("origem_ronda", rondaId);
    expect(ordens).toHaveLength(1);
    expect(ordens![0]).toMatchObject({ agente_slug: "otavio", origem_slug: "bruno", prioridade: "P1" });
    const ordemId = ordens![0].id as string;

    // Abrir a Central dispara os encaminhamentos P0/P1 pendentes (dentro do limite diário).
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Conversar");
    await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Otávio/ }).click();
    const ordem = page.getByTestId("ordem").filter({ hasText: marca });
    await expect(ordem).toHaveAttribute("data-estado", "enviada");
    await expect(ordem.getByTestId("ordem-origem")).toHaveText("encaminhado por Bruno · P1");
    await expect(ordem).toContainText(`Encaminhado por Bruno (P1): Login cai no Safari ${marca} — erro 500 no /auth`);
    if (LAB_OUTBOX && fs.existsSync(LAB_OUTBOX)) expect(fs.readFileSync(LAB_OUTBOX, "utf8")).toContain(`ordem ${ordemId} encaminhada por Bruno`);

    // Reabrir não dispara de novo.
    await page.reload({ waitUntil: "networkidle" });
    if (LAB_OUTBOX && fs.existsSync(LAB_OUTBOX)) expect(fs.readFileSync(LAB_OUTBOX, "utf8").split(`ordem ${ordemId} encaminhada`).length - 1).toBe(1);

    // O Otávio responde (fecha a ordem na ronda) → a resposta volta para o Bruno.
    await ronda("otavio", `[lab] Conferi ${marca}: é o cookie SameSite; pacote para o Renato.`, [], [ordemId], "https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/998");
    const { data: fechada } = await adm().from("agentes_ordens").select("status, resposta").eq("id", ordemId).single();
    expect(fechada).toMatchObject({ status: "concluida" });
    expect(fechada!.resposta).toContain("cookie SameSite");
    const { data: retorno } = await adm().from("agentes_ordens").select("agente_slug, origem_slug, texto, status").eq("retorno_de", ordemId);
    expect(retorno).toHaveLength(1);
    expect(retorno![0]).toMatchObject({ agente_slug: "bruno", origem_slug: "otavio", status: "pendente" });
    expect(retorno![0].texto).toContain("Retorno de Otávio sobre o que você encaminhou");
    expect(retorno![0].texto).toContain("pull/998");

    await page.reload({ waitUntil: "networkidle" });
    await abrirAba(page, "Conversar");
    await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Bruno/ }).click();
    const volta = page.getByTestId("ordem").filter({ hasText: `Conferi ${marca}` });
    await expect(volta.getByTestId("ordem-origem")).toHaveText("retorno de Otávio");
  });

  test("achado P2 vira ordem mas NÃO dispara (fica para a próxima ronda)", async ({ page }) => {
    const marca = `t26-p2-${Date.now()}`;
    await ronda("helena", `[lab] ${marca}`, [{ prioridade: "P2", titulo: `Seguradora pediu CNPJ ${marca}`, para: "thiago" }]);
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Conversar");
    await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Thiago/ }).click();
    const ordem = page.getByTestId("ordem").filter({ hasText: marca });
    await expect(ordem).toHaveAttribute("data-estado", "aguardando");
    await expect(ordem.getByTestId("ordem-origem")).toHaveText("encaminhado por Helena · P2");
  });

  test("Rede ao vivo: linha do tempo com eventos reais de 24 h e atualização sozinha a cada 30 s", async ({ page }) => {
    test.setTimeout(90_000);
    const marca = `${Date.now()}`.slice(-5);
    await ronda("bruno", `[lab] rede ${marca}`, [{ prioridade: "P1", titulo: `rede ${marca}`, para: "otavio" }]);
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await abrirAba(page, "Rede ao vivo");
    const linha = page.getByTestId("rede-linha-do-tempo");
    await expect(linha).toContainText(/lido \d\d:\d\d · a cada 30 s/);
    await expect(linha.locator('li[data-tipo="encaminhamento"]').filter({ hasText: "Bruno → Otávio: 1 achado (P1)" }).first()).toBeVisible();
    await expect(linha.locator('li[data-tipo="ronda"]').filter({ hasText: "Bruno fez ronda com alerta: 1 achado (P1)" }).first()).toBeVisible();
    // Evento novo aparece SEM recarregar a página (atualização de 30 s).
    const antes = await linha.locator('li[data-tipo="ronda"]').filter({ hasText: "Carla fez ronda" }).count();
    await ronda("carla", `[lab] relatório ${marca}`, []);
    await expect(linha.locator('li[data-tipo="ronda"]').filter({ hasText: "Carla fez ronda" })).toHaveCount(antes + 1, { timeout: 45_000 });
  });
});
