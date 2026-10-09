import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";

/**
 * T27 — TODOS OS AGENTES COM DADOS AO VIVO no chat da Central. O Otávio tem uma
 * ronda que lista "OK da 0083" (já aplicada), "OK da 0099" (não aplicada) e um
 * chamado aberto. Perguntamos "alguma pendência?" antes e depois de resolver o
 * chamado: o que já foi resolvido NÃO pode aparecer como pendente.
 * Laboratório: resposta montada pelas regras (sem IA), com a mesma conferência.
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adm = () => createClient(URL!, SERVICE!, { auth: { persistSession: false } });

async function perguntarAoOtavio(page: Page, texto: string) {
  await page.goto("/admin/agentes", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Conversar" }).click();
  await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Otávio/ }).click();
  const antes = await page.getByText(/^Da minha ronda de /).count();
  await page.getByPlaceholder("Escreva para Otávio…").fill(texto);
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(/^Da minha ronda de /)).toHaveCount(antes + 1, { timeout: 20_000 });
  return page.getByText(/^Da minha ronda de /).last();
}

test.describe("T27 — Agentes com dados ao vivo", () => {
  test.use({ storageState: authFile("admin") });

  test("Otávio: 'alguma pendência?' — migração aplicada e chamado resolvido não aparecem como pendentes", async ({ page }) => {
    test.skip(process.env.INTEGRACOES_SIMULADAS !== "on" || !URL || !SERVICE, "Só no laboratório.");
    const db = adm();
    const prazo = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const { data: ch, error: e1 } = await db
      .from("chamados")
      .insert({ visitante_email: "t27@lab.vivanomads.test", tipo: "suporte", categoria: "contrato", prioridade: "p2", canal: "site", assunto: "teste T27", responsavel_tipo: "humano", prazo_primeira_resposta: prazo, prazo_resolucao: prazo })
      .select("id, numero_publico")
      .single();
    expect(e1).toBeNull();
    const numero = ch!.numero_publico as string;
    const agora = new Date().toISOString();
    const { error } = await db.rpc("registrar_ronda", {
      p_slug: "otavio", p_inicio: agora, p_fim: agora, p_status: "alerta", p_resumo: "[lab] T27: fila conferida.",
      p_achados: [
        { prioridade: "P1", titulo: "Precisa de você: OK da 0083" },
        { prioridade: "P1", titulo: `${numero} aguardando resposta` },
        { prioridade: "P2", titulo: "Precisa de você: OK da 0099" },
      ],
      p_ordens: [], p_link: null,
    });
    expect(error).toBeNull();

    // 1) Chamado ainda aberto: ele continua pendente; a 0083 (aplicada) já não.
    const r1 = await perguntarAoOtavio(page, "alguma pendência?");
    const t1 = await r1.innerText();
    const [res1, pen1] = [t1.split("\n")[1], t1.split("\n")[2]];
    expect(res1).toContain("0083");
    expect(res1).toContain("já aplicada");
    expect(pen1).toContain(numero);
    expect(pen1).toContain("0099");
    expect(pen1).not.toContain("0083");
    expect(t1).toMatch(/dados de \d{2}\/\d{2} \d{2}:\d{2}/);

    // 2) Resolve o chamado e pergunta de novo: agora ele sai das pendências.
    await db.from("chamados").update({ status: "resolvido", resolvido_em: new Date().toISOString(), nota_satisfacao: 5 }).eq("id", ch!.id);
    const r2 = await perguntarAoOtavio(page, "alguma pendência?");
    const t2 = await r2.innerText();
    const [res2, pen2] = [t2.split("\n")[1], t2.split("\n")[2]];
    expect(res2).toContain(`${numero}: resolvido`);
    expect(res2).toContain("nota 5");
    expect(pen2).not.toContain(numero);
    expect(pen2).not.toContain("0083");
    expect(pen2).toContain("0099");
    await db.from("chamados").update({ status: "encerrado" }).eq("id", ch!.id);
  });

  test("Moacir lê as migrações aplicadas (0088)", async ({ page }) => {
    test.skip(process.env.INTEGRACOES_SIMULADAS !== "on" || !URL || !SERVICE, "Só no laboratório.");
    const { data, error } = await adm().rpc("migracoes_aplicadas");
    expect(error).toBeNull();
    expect((data as { name: string }[]).some((m) => m.name.startsWith("0083_"))).toBe(true);
    expect(Object.keys((data as object[])[0]).sort()).toEqual(["name", "version"]);
    // Logado (mesmo admin) não chama a função direto: só o servidor.
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    const anon = createClient(URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const r = await anon.rpc("migracoes_aplicadas");
    expect(r.error).not.toBeNull();
  });
});
