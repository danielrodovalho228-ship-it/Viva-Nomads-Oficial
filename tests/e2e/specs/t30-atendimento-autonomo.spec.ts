import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { authFile } from "../fixtures/auth";

/**
 * T30 — ATENDIMENTO AUTÔNOMO (laboratório: sugestões por regra, sem IA).
 *  1. "Como funciona a Caução?" pelo formulário → a Viva responde sozinha em < 30 s,
 *     com o rodapé "Responda 'pessoa'"; nova pergunta no chamado → responde de novo.
 *  2. "pessoa" no chamado → nada da IA; prioridade sobe; e-mail ao Daniel na hora.
 *  3. "a página X deu erro" → ordem para o Renato (e o Otávio) visível na Central.
 *  4. Rede ao vivo mostra os eventos do atendimento e relê a cada 15 s.
 */
const LAB_OUTBOX = process.env.LAB_OUTBOX;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RODAPE = 'Resposta automática da Viva. Quer falar com uma pessoa? Responda "pessoa".';
const adm = () => createClient(URL!, SERVICE!, { auth: { persistSession: false } });
const letras = () => Array.from({ length: 6 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");

async function abrirLogado(page: Page, assunto: string, pedido: string): Promise<{ numero: string; id: string }> {
  await page.goto("/ajuda?novo=1", { waitUntil: "networkidle" });
  await page.getByLabel("Assunto").selectOption({ label: assunto });
  await page.getByLabel("O que aconteceu?").fill(pedido);
  await page.getByRole("button", { name: "Enviar chamado" }).click();
  await page.waitForURL(/chamado=VN-\d+/, { timeout: 20_000 });
  const numero = new globalThis.URL(page.url()).searchParams.get("chamado")!;
  const { data } = await adm().from("chamados").select("id").eq("numero_publico", numero).single();
  return { numero, id: data!.id as string };
}

async function mensagens(id: string) {
  const { data } = await adm().from("chamado_mensagens").select("id, autor, interno, corpo").eq("chamado_id", id).order("id");
  return (data ?? []) as { id: number; autor: string; interno: boolean; corpo: string }[];
}
const publicasIA = async (id: string) => (await mensagens(id)).filter((m) => m.autor === "ia" && !m.interno);

async function responder(page: Page, texto: string) {
  const caixa = page.getByPlaceholder(/Escreva sua mensagem|Algo ficou pendente/);
  await caixa.fill(texto);
  // O botão "Enviar" do formulário do chamado (o chat flutuante da Viva também tem um).
  await page.locator("form").filter({ has: caixa }).getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByPlaceholder(/Escreva sua mensagem|Algo ficou pendente/)).toHaveValue("", { timeout: 15_000 });
}

test.describe("T30 — Atendimento autônomo", () => {
  test.skip(process.env.INTEGRACOES_SIMULADAS !== "on" || !URL || !SERVICE, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.beforeAll(async () => {
    await adm().from("limites_uso").delete().like("chave", "chamado:%");
  });

  test("Caução simples: resposta automática em < 30 s; nova pergunta respondida; 'pessoa' passa para a equipe sem IA", async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ storageState: authFile("inquilino") });
    const page = await ctx.newPage();
    const inicio = Date.now();
    const { numero, id } = await abrirLogado(page, "Contrato ou caução", `Como funciona a Caução? (${letras()})`);

    // 1) Resposta automática dentro do chamado, sem esperar o admin.
    await expect.poll(async () => (await publicasIA(id)).some((m) => m.corpo.includes(RODAPE)), { timeout: 30_000 }).toBe(true);
    expect(Date.now() - inicio, "menos de 30 s").toBeLessThan(30_000);
    const r1 = (await publicasIA(id)).find((m) => m.corpo.includes(RODAPE))!;
    expect(r1.corpo).toContain("Caução");
    const { data: c1 } = await adm().from("chamados").select("status, prioridade, primeira_resposta_em").eq("id", id).single();
    expect(c1).toMatchObject({ status: "aguardando_usuario", prioridade: "p2" });
    expect(c1!.primeira_resposta_em).toBeTruthy();
    await expect(page.locator("body")).toContainText(RODAPE, { timeout: 15_000 });

    // 2) Nova mensagem no chamado (com a equipe): a Viva responde de novo, sozinha.
    const antes = (await publicasIA(id)).length;
    await responder(page, "E vocês oferecem seguro também?");
    await expect.poll(async () => (await publicasIA(id)).length, { timeout: 30_000 }).toBe(antes + 1);
    expect((await publicasIA(id)).at(-1)!.corpo).toContain(RODAPE);

    // 3) "pessoa": nada da IA, prioridade fica em P2 (não vira urgência), aviso à equipe na hora.
    const depois = (await publicasIA(id)).length;
    await responder(page, "pessoa");
    await expect
      .poll(async () => ((await adm().from("chamado_eventos").select("acao").eq("chamado_id", id).eq("acao", "pediu_humano")).data ?? []).length, { timeout: 20_000 })
      .toBe(1);
    await expect.poll(async () => (await mensagens(id)).some((m) => m.interno && m.corpo.includes("Resposta sugerida:")), { timeout: 20_000 }).toBe(true);
    expect((await publicasIA(id)).length, "nenhuma resposta da IA depois de 'pessoa'").toBe(depois);
    const { data: c2 } = await adm().from("chamados").select("prioridade").eq("id", id).single();
    expect(c2!.prioridade).toBe("p2");
    expect((await mensagens(id)).some((m) => m.autor === "sistema" && m.corpo.startsWith("Pronto, passei seu chamado para uma pessoa da equipe."))).toBe(true);
    if (LAB_OUTBOX && fs.existsSync(LAB_OUTBOX)) {
      const linhas = fs.readFileSync(LAB_OUTBOX, "utf8").split("\n");
      expect(linhas.some((l) => l.includes(`— ${numero}: a pessoa pediu para falar com alguém`) && l.includes("Aprovar e enviar no admin"))).toBe(true);
      expect(linhas.some((l) => l.includes(`— ${numero}: novo chamado`) && l.includes("A Viva já respondeu (informação oficial)"))).toBe(true);
    }
    await ctx.close();
  });

  test("'a página X deu erro' vira ordem para o Renato (e o Otávio), visível na Central e na Rede ao vivo", async ({ browser }) => {
    test.setTimeout(90_000);
    const ctx = await browser.newContext({ storageState: authFile("inquilino") });
    const { numero, id } = await abrirLogado(await ctx.newPage(), "Dúvida sobre como usar", `A página /dashboard/imoveis/novo deu erro ao salvar o anúncio (${letras()})`);
    await ctx.close();
    await expect
      .poll(async () => ((await adm().from("agentes_ordens").select("agente_slug").like("texto", `%${numero}%`)).data ?? []).map((o) => o.agente_slug).sort(), { timeout: 20_000 })
      .toEqual(["otavio", "renato"]);
    const { data: ordem } = await adm().from("agentes_ordens").select("texto").eq("agente_slug", "renato").like("texto", `%${numero}%`).single();
    expect(ordem!.texto).toContain("/dashboard/imoveis/novo");
    expect(ordem!.texto).toContain("Reproduza, corrija e abra o PR");
    expect(((await adm().from("chamado_eventos").select("acao").eq("chamado_id", id).eq("acao", "erro_tecnico")).data ?? []).length).toBe(1);
    // Relato de erro não recebe a resposta "oficial" genérica: fica com a equipe, com a sugestão.
    await expect.poll(async () => ((await adm().from("chamado_eventos").select("acao").eq("chamado_id", id).in("acao", ["acolhido", "respondido_viva"])).data ?? []).map((e) => e.acao), { timeout: 20_000 }).toEqual(["acolhido"]);

    const adminCtx = await browser.newContext({ storageState: authFile("admin") });
    const page = await adminCtx.newPage();
    await page.goto("/admin/agentes", { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Conversar" }).click();
    await page.locator('aside[aria-label="Agentes"]').getByRole("button", { name: /Renato/ }).click();
    await expect(page.getByTestId("ordem").filter({ hasText: numero }).first()).toBeVisible();

    await page.getByRole("tab", { name: "Rede ao vivo" }).click();
    const linha = page.getByTestId("rede-linha-do-tempo");
    await expect(linha).toContainText(/lido \d\d:\d\d · a cada 15 s/);
    await expect(linha).toContainText(`${numero}: erro técnico encaminhado ao Renato`);
    await expect(linha).toContainText(`Chamado ${numero} aberto`);
    await expect(linha).not.toContainText(`Viva respondeu ${numero} sozinha`);
    await adminCtx.close();
  });
});
