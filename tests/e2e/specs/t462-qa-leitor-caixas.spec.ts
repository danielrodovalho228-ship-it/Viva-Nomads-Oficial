import { test, expect, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adm, apagarContas, CHAVE_ANON, criarConta, entrar, NO_LABORATORIO, novaSenha, novoSufixo, URL_SUPABASE } from "../fixtures/laboratorio";

/**
 * T462 — QA-CAIXA-B: leitor de QA de TODAS as caixas de teste, fora de /admin (sem admin e sem 2FA).
 * - conta comum e conta de teste SEM qa_leitor: /dashboard/qa/emails = 404 e a RLS devolve 0 linhas de emails_teste;
 * - conta de teste COM qa_leitor: lê todas as linhas de emails_teste e NADA a mais de outra tabela (mesmas contagens
 *   com e sem a marca); filtro por conta e por evento; nenhum e-mail completo na tela (só mascarado);
 * - ninguém se marca sozinho: o update do próprio perfil não liga qa_leitor (migração 0246).
 */
const sufixo = novoSufixo();
const senha = novaSenha();
const comum = { email: `qa462-comum-${sufixo}@lab.vivanomads.test`, nome: "Comum T462", role: "tenant" as const };
const semFlag = { email: `qa462-teste-${sufixo}@lab.vivanomads.test`, nome: "Teste T462", role: "tenant" as const };
const leitor = { email: `qa462-leitor-${sufixo}@lab.vivanomads.test`, nome: "Leitor T462", role: "owner" as const };
const alvo = { email: `qa462-alvo-${sufixo}@lab.vivanomads.test`, nome: "Alvo T462", role: "tenant" as const };
const ids: Record<string, string | undefined> = {};
const EVENTO_A = `lab462_a_${sufixo}`;
const EVENTO_B = `lab462_b_${sufixo}`;
const COMPLETO = `alguem.real-${sufixo}@exemplo.com.br`;
const OUTRAS_TABELAS = ["profiles", "properties", "contratos", "leads", "messages", "chamados", "parceiro_pedidos", "notifications"];

async function sessao(email: string) {
  const cli = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
  const { error } = await cli.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return cli;
}

async function contagens(cli: Awaited<ReturnType<typeof sessao>>): Promise<Record<string, number | string>> {
  const r: Record<string, number | string> = {};
  for (const t of OUTRAS_TABELAS) {
    const { count, error } = await cli.from(t).select("*", { count: "exact", head: true });
    r[t] = error ? `erro:${error.code}` : (count ?? 0);
  }
  return r;
}

async function abrir(browser: Browser, email: string, largura = 1280) {
  const p = await entrar(browser, email, senha);
  await p.setViewportSize({ width: largura, height: 900 });
  return p;
}

test.describe("T462 — QA-CAIXA-B: leitor de QA das caixas de teste", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    if (!NO_LABORATORIO) return;
    ids.comum = await criarConta(comum, senha);
    ids.semFlag = await criarConta(semFlag, senha);
    ids.leitor = await criarConta(leitor, senha);
    ids.alvo = await criarConta(alvo, senha);
    // Contas do domínio do laboratório já nascem is_teste? Garante pela chave de serviço (o que a migração faria).
    await adm().from("profiles").update({ is_teste: false, qa_leitor: false }).eq("id", ids.comum!);
    await adm().from("profiles").update({ is_teste: true, qa_leitor: false }).eq("id", ids.semFlag!);
    await adm().from("profiles").update({ is_teste: true, qa_leitor: true }).eq("id", ids.leitor!);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.alvo!);
    const { error } = await adm().from("emails_teste").insert([
      { evento: EVENTO_A, assunto: `T462 A ${sufixo}`, corpo: `Fale com ${COMPLETO} sobre o pedido.`, destinatario_mascarado: "q•••@lab.vivanomads.test", usuario_id: ids.alvo },
      { evento: EVENTO_B, assunto: `T462 B ${sufixo}`, corpo: "Seu código é 123456.", destinatario_mascarado: "q•••@lab.vivanomads.test", usuario_id: ids.semFlag },
    ]);
    if (error) throw error;
  });

  test.afterAll(async () => {
    if (!NO_LABORATORIO) return;
    await adm().from("emails_teste").delete().in("evento", [EVENTO_A, EVENTO_B]);
    await apagarContas([ids.comum, ids.semFlag, ids.leitor, ids.alvo]);
  });

  test("1. conta comum e conta de teste sem a marca: 404 e RLS vazio", async ({ browser }) => {
    test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");
    for (const c of [comum, semFlag]) {
      const p = await abrir(browser, c.email);
      const r = await p.goto("/dashboard/qa/emails", { waitUntil: "domcontentloaded" });
      expect(r?.status(), c.email).toBe(404);
      await expect(p.getByTestId("qa-emails")).toHaveCount(0);
      await p.context().close();
      const cli = await sessao(c.email);
      const { data, error } = await cli.from("emails_teste").select("id");
      expect(error, c.email).toBeNull();
      expect(data ?? [], c.email).toHaveLength(0);
    }
  });

  test("2. ninguém se marca sozinho: o update do próprio perfil não liga qa_leitor", async () => {
    test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");
    const cli = await sessao(semFlag.email);
    await cli.from("profiles").update({ qa_leitor: true }).eq("id", ids.semFlag!);
    const { data } = await adm().from("profiles").select("qa_leitor").eq("id", ids.semFlag!).single();
    expect(data?.qa_leitor).toBe(false);
    const { data: linhas } = await cli.from("emails_teste").select("id");
    expect(linhas ?? []).toHaveLength(0);
  });

  test("3. qa_leitor lê TODAS as linhas de emails_teste e nada a mais de outra tabela", async () => {
    test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");
    const cli = await sessao(leitor.email);
    const { count: total } = await adm().from("emails_teste").select("*", { count: "exact", head: true });
    const { count: lidas, error } = await cli.from("emails_teste").select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(lidas).toBe(total);
    // Só select: inserir, alterar e apagar seguem barrados.
    const ins = await cli.from("emails_teste").insert({ evento: EVENTO_A, assunto: "não", corpo: "não", destinatario_mascarado: "•••" });
    expect(ins.error).not.toBeNull();
    await cli.from("emails_teste").delete().eq("evento", EVENTO_B);
    const { count: depois } = await adm().from("emails_teste").select("*", { count: "exact", head: true }).eq("evento", EVENTO_B);
    expect(depois).toBe(1);
    // Mesmas contagens nas outras tabelas com e sem a marca: a marca só abre emails_teste.
    const com = await contagens(cli);
    await adm().from("profiles").update({ qa_leitor: false }).eq("id", ids.leitor!);
    const sem = await contagens(await sessao(leitor.email));
    await adm().from("profiles").update({ qa_leitor: true }).eq("id", ids.leitor!);
    expect(com).toEqual(sem);
  });

  for (const largura of [390, 1280]) {
    test(`4. a tela lista, filtra por conta e evento e nunca mostra e-mail completo (${largura}px)`, async ({ browser }) => {
      test.skip(!NO_LABORATORIO, "Precisa do banco do laboratório.");
      const p = await abrir(browser, leitor.email, largura);
      const r = await p.goto("/dashboard/qa/emails", { waitUntil: "domcontentloaded" });
      expect(r?.status()).toBe(200);
      await expect(p.getByTestId("qa-emails")).toBeVisible({ timeout: 20_000 });
      const lista = p.getByTestId(largura < 768 ? "emails-teste-cartoes" : "emails-teste-tabela");
      await expect(lista).toContainText(`T462 A ${sufixo}`);
      await expect(lista).toContainText(`T462 B ${sufixo}`);
      // Filtro por evento.
      await p.goto(`/dashboard/qa/emails?evento=${EVENTO_A}`, { waitUntil: "domcontentloaded" });
      await expect(lista).toContainText(`T462 A ${sufixo}`);
      await expect(lista).not.toContainText(`T462 B ${sufixo}`);
      // Filtro por conta (pelo seletor da tela).
      await p.goto("/dashboard/qa/emails", { waitUntil: "domcontentloaded" });
      await p.getByTestId("qa-emails-conta").selectOption(ids.semFlag!);
      await p.getByTestId("qa-emails-filtros").getByRole("button", { name: "Filtrar" }).click();
      await expect(p).toHaveURL(new RegExp(`conta=${ids.semFlag}`));
      await expect(lista).toContainText(`T462 B ${sufixo}`);
      await expect(lista).not.toContainText(`T462 A ${sufixo}`);
      // Nenhum e-mail completo no HTML: só a forma mascarada.
      await p.goto(`/dashboard/qa/emails?evento=${EVENTO_A}`, { waitUntil: "domcontentloaded" });
      const html = await p.content();
      expect(html).not.toContain(COMPLETO);
      expect(html).not.toContain(alvo.email);
      expect(html).toContain("a•••@exemplo.com.br");
      const sobra = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sobra).toBeLessThanOrEqual(0);
      await p.context().close();
    });
  }
});
