import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";

/**
 * T24 — PRIMEIRA RESPOSTA NA HORA (laboratório).
 * Visitante abre chamado (Caução e anúncio): entra o acolhimento da Viva com o
 * número e o prazo, a 1ª resposta fica marcada, a resposta SUGERIDA vira nota
 * interna (no lab, rascunho simulado — sem IA) e o admin aprova com 1 clique:
 * vira resposta da equipe e sai o e-mail para a pessoa (LAB_OUTBOX).
 */
const LAB_OUTBOX = process.env.LAB_OUTBOX;
const noLaboratorio = process.env.INTEGRACOES_SIMULADAS === "on";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function abrirComoVisitante(page: Page, pedido: string, email: string): Promise<string> {
  await page.goto("/ajuda", { waitUntil: "networkidle" });
  const bloco = page.getByTestId("viva-chat-bloco");
  await bloco.getByRole("button", { name: /Falar com uma pessoa/i }).click();
  const form = page.getByTestId("form-pessoa");
  await form.getByLabel("Seu nome").fill("Visitante T24");
  await form.getByLabel("Seu e-mail").fill(email);
  await form.getByLabel("Pedido para a equipe").fill(pedido);
  await form.getByRole("button", { name: "Abrir chamado" }).click();
  const ok = page.getByTestId("chamado-aberto-chat");
  await expect(ok).toBeVisible({ timeout: 20_000 });
  return (await ok.innerText()).match(/VN-\d+/)![0];
}

test.describe("T24 — Acolhimento e resposta sugerida", () => {
  test.skip(!noLaboratorio || !URL || !SERVICE, "Só no laboratório (banco local + service role).");
  test.describe.configure({ mode: "default" });
  const adm = () => createClient(URL!, SERVICE!, { auth: { persistSession: false } });

  async function mensagens(numero: string) {
    const { data: c } = await adm().from("chamados").select("id, categoria, responsavel_tipo, primeira_resposta_em").eq("numero_publico", numero).single();
    const { data: ms } = await adm().from("chamado_mensagens").select("id, autor, interno, simulacao, corpo").eq("chamado_id", c!.id).order("id");
    return { c: c!, ms: ms ?? [] };
  }

  for (const [nome, pedido, categoria] of [
    ["Caução", "Minha caução ainda não foi devolvida depois da saída do imóvel.", "caucao"],
    ["anúncio", "Meu anúncio não publica, aparece um aviso de documento pendente.", null],
  ] as const) {
    test(`${nome}: acolhimento com número e prazo + nota interna com sugestão`, async ({ browser }) => {
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const numero = await abrirComoVisitante(await ctx.newPage(), `${pedido} (${Date.now()})`, `t24.${Date.now()}@lab.vivanomads.test`);
      await ctx.close();
      await expect.poll(async () => (await mensagens(numero)).ms.filter((m) => m.autor === "ia").length, { timeout: 20_000 }).toBe(2);
      const { c, ms } = await mensagens(numero);
      if (categoria) expect(c.categoria).toBe(categoria);
      expect(c.responsavel_tipo).toBe("humano");
      expect(c.primeira_resposta_em, "acolhimento conta como 1ª resposta").toBeTruthy();
      const acolhe = ms.find((m) => m.autor === "ia" && !m.interno)!;
      expect(acolhe.corpo).toContain(numero);
      expect(acolhe.corpo).toMatch(/Um especialista da equipe responde até \d{2}\/\d{2} às \d{2}:\d{2} \(horário de Brasília\)/);
      const nota = ms.find((m) => m.autor === "ia" && m.interno)!;
      expect(nota.corpo).toContain("Resposta sugerida:");
      expect(nota.simulacao).toBe(true);
    });
  }

  test("admin aprova a sugestão com 1 clique: vira resposta da equipe e sai o e-mail", async ({ browser }) => {
    const email = `t24.aprova.${Date.now()}@lab.vivanomads.test`;
    const vis = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const numero = await abrirComoVisitante(await vis.newPage(), `A devolução da caução está atrasada (${Date.now()})`, email);
    await vis.close();
    await expect.poll(async () => (await mensagens(numero)).ms.some((m) => m.interno && m.autor === "ia"), { timeout: 20_000 }).toBe(true);
    const { data: c } = await adm().from("chamados").select("id").eq("numero_publico", numero).single();

    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto(`/admin/atendimento/${c!.id}`, { waitUntil: "networkidle" });
    await expect(page.locator("body")).toContainText("Um especialista da equipe responde até");
    await page.getByTestId("aprovar-sugestao").click();
    await expect(page.getByText("Aprovada e enviada")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("aprovar-sugestao")).toHaveCount(0);
    await ctx.close();

    const { ms } = await mensagens(numero);
    const enviada = ms.find((m) => m.autor === "admin" && !m.interno);
    expect(enviada?.corpo).toContain("Obrigado por falar com a Viva Nomads");
    if (LAB_OUTBOX && fs.existsSync(LAB_OUTBOX)) {
      const linhas = fs.readFileSync(LAB_OUTBOX, "utf8");
      expect(linhas).toContain(`Recebemos seu chamado — ${numero}`);
      expect(linhas).toContain(`Seu chamado foi respondido — ${numero}`);
      expect(linhas, "aviso à equipe").toContain(`— ${numero}: novo chamado`);
    }
  });
});
