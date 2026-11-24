import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";
import { NO_LABORATORIO } from "../fixtures/laboratorio";

/**
 * T1695 — E1032: a Central posta o "Retorno" do Moacir uma vez só, mesmo desenhada duas vezes no mesmo instante.
 *
 * O defeito: a página da Central chama postarRetornosDoMoacir a cada desenho; a função conferia "já postei?" e só depois
 * inseria, sem nada que impedisse duas execuções de passarem na conferência ao mesmo tempo. Duas sessões a abrir a
 * Central no mesmo instante (ou dois pedidos da mesma sessão) gravavam a mensagem em dobro. No laboratório, na main:
 * 10 em 10 com dois pedidos diretos e 9 em 20 com duas sessões.
 *
 * Cada caso semeia como o t21 semeia (UMA ordem concluída do Moacir + UMA ronda) e conta as mensagens "(ordem <id>)".
 * Os casos correm em paralelo, em mais de um processo, e cada processo roda o afterAll: por isso cada processo marca o
 * que semeia com um código só dele e apaga só isso. Antes a limpeza apagava tudo o que tivesse "t1695" e levava as
 * ordens de um caso ainda a correr noutro processo (contagem 0 em vez de 1).
 * Só no laboratório: precisa do cliente de serviço para semear e contar.
 */
const BANCO = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICO = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROCESSO = randomUUID().slice(0, 8);
const MARCA = `[teste-lab] t1695 ${PROCESSO}`;
const REPETICOES = 5;

test.describe("T1695 — E1032: o Retorno do Moacir sai uma vez só @E1032", () => {
  test.skip(!NO_LABORATORIO || !BANCO || !SERVICO, "Só no laboratório, com a service role.");
  test.use({ storageState: authFile("admin") });
  const banco = () => createClient(BANCO!, SERVICO!, { auth: { persistSession: false } });

  async function semear(rotulo: string): Promise<string> {
    const db = banco();
    const { data: ordem, error } = await db.from("agentes_ordens").insert({ agente_slug: "renato", texto: `Pedido do Moacir (chat da Central): ${rotulo} ${MARCA}`, status: "concluida" }).select("id").single();
    expect(error, "semear a ordem").toBeNull();
    const ronda = await db.rpc("registrar_ronda", {
      p_slug: "renato", p_inicio: new Date().toISOString(), p_fim: new Date().toISOString(), p_status: "ok",
      p_resumo: `[lab] t1695 ${PROCESSO} ${rotulo}`, p_achados: [], p_ordens: [ordem!.id], p_link: "https://example.invalid/t1695",
    });
    expect(ronda.error, "semear a ronda").toBeNull();
    return ordem!.id as string;
  }
  const mensagens = async (id: string) => (await banco().from("agentes_conversas").select("id", { count: "exact", head: true }).like("texto", `%(ordem ${id})%`)).count;

  test.afterAll(async () => {
    if (!BANCO || !SERVICO) return;
    const db = banco();
    const { data: ordens } = await db.from("agentes_ordens").select("id").like("texto", `%${MARCA}%`);
    for (const o of ordens ?? []) await db.from("agentes_conversas").delete().like("texto", `%(ordem ${o.id})%`);
    await db.from("agentes_ordens").delete().like("texto", `%${MARCA}%`);
    await db.from("agentes_rondas").delete().like("resumo", `[lab] t1695 ${PROCESSO} %`);
  });

  test("uma sessão abre a Central: o Retorno aparece uma vez, com o resultado da ronda, e recarregar não repete", async ({ page }) => {
    const id = await semear("uma sessão");
    expect(await mensagens(id), "a preparação não cria mensagem").toBe(0);
    await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
    await expect.poll(() => mensagens(id), { message: "o Retorno foi postado" }).toBe(1);
    const { data } = await banco().from("agentes_conversas").select("texto, agente_slug, papel").like("texto", `%(ordem ${id})%`);
    expect(data![0].agente_slug).toBe("moacir");
    expect(data![0].texto).toContain("Retorno: Renato terminou o que eu pedi (ok).");
    expect(data![0].texto).toContain(`[lab] t1695 ${PROCESSO} uma sessão`);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    expect(await mensagens(id), "depois de recarregar").toBe(1);
  });

  test("dois pedidos da Central no mesmo instante, a mesma sessão: uma mensagem por ordem", async ({ page }) => {
    for (let i = 1; i <= REPETICOES; i++) {
      const id = await semear(`dois pedidos ${i}`);
      expect(await mensagens(id), "a preparação não cria mensagem").toBe(0);
      const respostas = await Promise.all([page.request.get("/admin/agentes"), page.request.get("/admin/agentes")]);
      for (const r of respostas) expect(r.status(), "a Central respondeu").toBe(200);
      expect(await mensagens(id), `ordem ${i} de ${REPETICOES}: mensagens do Retorno`).toBe(1);
    }
  });

  test("duas sessões abrem a Central no mesmo instante: uma mensagem por ordem", async ({ browser }) => {
    test.setTimeout(120_000);
    const c1 = await browser.newContext({ storageState: authFile("admin") });
    const c2 = await browser.newContext({ storageState: authFile("admin") });
    const p1 = await c1.newPage();
    const p2 = await c2.newPage();
    for (let i = 1; i <= REPETICOES; i++) {
      // As duas saem da Central antes: nenhuma execução antiga a caminho.
      await Promise.all([p1.goto("/dashboard", { waitUntil: "domcontentloaded" }), p2.goto("/dashboard", { waitUntil: "domcontentloaded" })]);
      const id = await semear(`duas sessões ${i}`);
      await Promise.all([p1.goto("/admin/agentes", { waitUntil: "domcontentloaded" }), p2.goto("/admin/agentes", { waitUntil: "domcontentloaded" })]);
      // As ações de servidor que a tela dispara ao montar também redesenham a Central: espera-as passar.
      await p1.waitForTimeout(1_500);
      expect(await mensagens(id), `ordem ${i} de ${REPETICOES}: mensagens do Retorno`).toBe(1);
    }
    await c1.close();
    await c2.close();
  });
});
