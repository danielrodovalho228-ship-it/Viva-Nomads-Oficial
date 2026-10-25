import { readdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";

/**
 * T27 — TODOS OS AGENTES COM DADOS AO VIVO no chat da Central. O Otávio tem uma
 * ronda que lista "OK da 0083" (já aplicada), "OK da 0099" (não aplicada) e um
 * chamado aberto. Perguntamos "alguma pendência?" antes e depois de resolver o
 * chamado: o que já foi resolvido NÃO pode aparecer como pendente.
 * Laboratório: resposta montada pelas regras (sem IA), com a mesma conferência.
 * A conferência vê só as 60 migrações mais recentes (0088): o teste usa a ÚLTIMA migração do repositório como
 * "já aplicada" (a 0083 saiu dessa janela) e um número que não existe como "ainda pendente".
 */
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adm = () => createClient(URL!, SERVICE!, { auth: { persistSession: false } });

const ULTIMA_MIGRACAO = readdirSync("supabase/migrations").filter((n) => /^\d{4}_.*\.sql$/.test(n)).sort().pop()!.slice(0, 4);
const NAO_APLICADA = "0999";

const bolhasDaRonda = (page: Page) => page.getByTestId("bolha-agente").filter({ hasText: /^Da minha ronda de / });
/** Linhas do balão sem as vazias (cada linha da resposta é um parágrafo). */
const linhasDe = (t: string) => t.split("\n").map((l) => l.trim()).filter(Boolean);

async function perguntarAoOtavio(page: Page, texto: string) {
  // L-43 (vigia, 25/10): o /admin mantém conexões abertas; com "networkidle" o caso estourava os 45 s em 4 laboratórios
  // completos seguidos (b5ed0e94, 8cfc180e, 96c0b6e4, de4cc854). Espera curta pela rede e o resto pelos elementos.
  await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.getByRole("tab", { name: "Conversar" }).click();
  await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Otávio/ }).click();
  // ADMIN-5: o chat é lido quando a aba abre; conta só depois de a conversa chegar.
  await expect(page.getByTestId("chat-carregando")).toHaveCount(0, { timeout: 20_000 });
  const antes = await bolhasDaRonda(page).count();
  await page.getByPlaceholder("Escreva para Otávio…").fill(texto);
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(bolhasDaRonda(page)).toHaveCount(antes + 1, { timeout: 20_000 });
  return bolhasDaRonda(page).last();
}

test.describe("T27 — Agentes com dados ao vivo", () => {
  test.use({ storageState: authFile("admin") });

  test("Otávio: 'alguma pendência?' — migração aplicada e chamado resolvido não aparecem como pendentes", async ({ page }) => {
    test.skip(process.env.INTEGRACOES_SIMULADAS !== "on" || !URL || !SERVICE, "Só no laboratório.");
    test.setTimeout(90_000);
    const db = adm();
    const prazo = new Date(Date.now() + 24 * 3_600_000).toISOString();
    const { data: ch, error: e1 } = await db
      .from("chamados")
      .insert({ visitante_nome: "Visitante T27", visitante_email: "t27@lab.vivanomads.test", tipo: "suporte", categoria: "contrato", prioridade: "p2", canal: "site", assunto: "teste T27", responsavel_tipo: "humano", prazo_primeira_resposta: prazo, prazo_resolucao: prazo })
      .select("id, numero_publico")
      .single();
    expect(e1).toBeNull();
    const numero = ch!.numero_publico as string;
    const agora = new Date().toISOString();
    const { error } = await db.rpc("registrar_ronda", {
      p_slug: "otavio", p_inicio: agora, p_fim: agora, p_status: "alerta", p_resumo: "[lab] T27: fila conferida.",
      p_achados: [
        { prioridade: "P1", titulo: `Precisa de você: OK da ${ULTIMA_MIGRACAO}` },
        { prioridade: "P1", titulo: `${numero} aguardando resposta` },
        { prioridade: "P2", titulo: `Precisa de você: OK da ${NAO_APLICADA}` },
      ],
      p_ordens: [], p_link: null,
    });
    expect(error).toBeNull();

    // 1) Chamado ainda aberto: ele continua pendente; a 0083 (aplicada) já não.
    const r1 = await perguntarAoOtavio(page, "alguma pendência?");
    const t1 = await r1.innerText();
    const [res1, pen1] = [linhasDe(t1)[1], linhasDe(t1)[2]];
    expect(res1).toContain(ULTIMA_MIGRACAO);
    expect(res1).toContain("já aplicada");
    expect(pen1).toContain(numero);
    expect(pen1).toContain(NAO_APLICADA);
    expect(pen1).not.toContain(ULTIMA_MIGRACAO);
    expect(t1).toMatch(/dados de \d{2}\/\d{2} \d{2}:\d{2}/);

    // 2) Resolve o chamado e pergunta de novo: agora ele sai das pendências.
    await db.from("chamados").update({ status: "resolvido", resolvido_em: new Date().toISOString(), nota_satisfacao: 5 }).eq("id", ch!.id);
    const r2 = await perguntarAoOtavio(page, "alguma pendência?");
    const t2 = await r2.innerText();
    const [res2, pen2] = [linhasDe(t2)[1], linhasDe(t2)[2]];
    expect(res2).toContain(`${numero}: resolvido`);
    expect(res2).toContain("nota 5");
    expect(pen2).not.toContain(numero);
    expect(pen2).not.toContain(ULTIMA_MIGRACAO);
    expect(pen2).toContain(NAO_APLICADA);
    await db.from("chamados").update({ status: "encerrado" }).eq("id", ch!.id);
  });

  test("Moacir lê as migrações aplicadas (0088)", async ({ page }) => {
    test.skip(process.env.INTEGRACOES_SIMULADAS !== "on" || !URL || !SERVICE, "Só no laboratório.");
    const { data, error } = await adm().rpc("migracoes_aplicadas");
    expect(error).toBeNull();
    expect((data as { name: string; version: string }[]).some((m) => m.name.startsWith(`${ULTIMA_MIGRACAO}_`) || m.version === ULTIMA_MIGRACAO || m.version.endsWith(ULTIMA_MIGRACAO))).toBe(true);
    expect(Object.keys((data as object[])[0]).sort()).toEqual(["name", "version"]);
    // Logado (mesmo admin) não chama a função direto: só o servidor.
    // L-43 (vigia, 25/10): o /admin mantém conexões abertas; com "networkidle" o caso estourava os 45 s em 4 laboratórios
  // completos seguidos (b5ed0e94, 8cfc180e, 96c0b6e4, de4cc854). Espera curta pela rede e o resto pelos elementos.
  await page.goto("/admin/agentes", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    const anon = createClient(URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const r = await anon.rpc("migracoes_aplicadas");
    expect(r.error).not.toBeNull();
  });
});
