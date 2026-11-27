import { test, expect, type Page } from "@playwright/test";
import postgres from "postgres";
import { NO_LABORATORIO, adm, apagarContas, criarConta, entrar, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { MSG_CODIGO_RECUPERACAO_INVALIDO } from "../../../src/lib/auth/recuperar-codigo";

/*
  T1680 — E917 (opção A, decisão do Gerente 16/11) @E917: a recuperação de senha das CONTAS DE TESTE por código.
    A. ciclo completo: pedido em /auth → o código (e só o código, sem link) na caixa de teste E na tela de
       /auth/reset/codigo (prova de 19/11) → /auth/reset/codigo aceita
       → nova senha → login com a senha nova.
    B. uso único (O-50): o mesmo código, de novo, é recusado.
    C. expiração (O-50): um código novo, envelhecido além da validade do Supabase, é recusado.
    D. conta REAL (não-teste): nada muda — a rota responde porCodigo=false e NADA entra na caixa de teste.
*/
const senha = novaSenha();
const senhaNova = novaSenha();
const sufixo = novoSufixo();
const ids: string[] = [];
const DB = process.env.LAB_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function conta(quem: string, teste: boolean) {
  const email = `${quem}.t1680.${sufixo}@lab.vivanomads.test`;
  const id = await criarConta({ email, nome: "Rita Recupera Sobrenome", role: "tenant" }, senha);
  ids.push(id);
  const { error } = await adm().from("profiles").update({ is_teste: teste }).eq("id", id);
  if (error) throw error;
  return { id, email };
}
const recuperacoes = async (id: string) =>
  ((await adm().from("emails_teste").select("corpo, html, criado_em").eq("usuario_id", id).eq("evento", "recuperar_senha").order("criado_em", { ascending: false })).data ?? []) as { corpo: string; html: string | null }[];
const codigoDe = (t: string) => /\b(\d{6})\b/.exec(t)?.[1] ?? "";

async function digitarCodigo(page: Page, email: string, codigo: string) {
  await page.goto(`/auth/reset/codigo?email=${encodeURIComponent(email)}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("reset-codigo-email")).toHaveValue(email);
  await page.getByTestId("reset-codigo-codigo").fill(codigo);
  await page.getByTestId("reset-codigo-enviar").click();
}

test.describe("T1680 — E917: recuperação de senha por código (contas de teste) @E917", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (contas de teste e caixa de teste).");
  test.describe.configure({ mode: "serial", timeout: 180_000 });
  let alvo: { id: string; email: string };
  let primeiro = "";
  test.afterAll(async () => {
    if (ids.length) await adm().from("emails_teste").delete().in("usuario_id", ids);
    await apagarContas(ids);
  });

  test("A. pedido → código na caixa de teste (sem link) → reset aceita → login com a senha nova", async ({ browser }) => {
    alvo = await conta("teste", true);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
    await page.getByRole("button", { name: "Esqueci minha senha" }).first().click();
    await page.getByPlaceholder("E-mail").fill(alvo.email);
    await page.getByRole("button", { name: "Enviar link de recuperação" }).click();
    await expect(page).toHaveURL(/\/auth\/reset\/codigo\?email=/, { timeout: 20_000 });

    await expect.poll(async () => (await recuperacoes(alvo.id)).length, { timeout: 20_000 }).toBe(1);
    const [e] = await recuperacoes(alvo.id);
    primeiro = codigoDe(e.corpo);
    expect(primeiro).toMatch(/^\d{6}$/);
    // E163 intacta: nenhum link de acesso no e-mail capturado (nem no texto nem no HTML).
    expect(`${e.corpo}\n${e.html ?? ""}`).not.toMatch(/token_hash|\/auth\/confirm|type=recovery|link com token removido/);
    // Prova ao vivo de 19/11 (ORDEM-DUET-185): o código APARECE NA TELA — é o mesmo do e-mail. Antes a spec só lia o banco
    // (ponto cego): sem sessão, a caixa de teste não se vê, e a tela não mostrava nada.
    await expect(page.getByTestId("reset-codigo-valor")).toHaveText(primeiro, { timeout: 10_000 });

    await page.getByTestId("reset-codigo-codigo").fill(primeiro);
    await page.getByTestId("reset-codigo-enviar").click();
    await expect(page).toHaveURL(/\/auth\/reset$/, { timeout: 20_000 });
    await page.getByPlaceholder("Nova senha", { exact: true }).fill(senhaNova);
    await page.getByPlaceholder("Confirmar nova senha").fill(senhaNova);
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.getByRole("heading", { name: "Pronto! Senha redefinida" })).toBeVisible({ timeout: 20_000 });
    await ctx.close();

    const logado = await entrar(browser, alvo.email, senhaNova);
    await expect(logado).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    await logado.context().close();
  });

  test("B. uso único: o mesmo código, de novo, é recusado", async ({ browser }) => {
    const page = await (await browser.newContext()).newPage();
    await digitarCodigo(page, alvo.email, primeiro);
    await expect(page.getByTestId("reset-codigo-erro")).toHaveText(MSG_CODIGO_RECUPERACAO_INVALIDO, { timeout: 20_000 });
    await expect(page).toHaveURL(/\/auth\/reset\/codigo/);
  });

  test("C. expiração: código novo envelhecido além da validade é recusado", async ({ browser, request }) => {
    const r = await request.post("/api/auth/recuperar", { data: { email: alvo.email } });
    // Asserção alterada (prova de 19/11): a resposta da conta de teste passa a trazer o código (para a tela); é o mesmo do e-mail.
    const corpo = (await r.json()) as { ok: boolean; porCodigo: boolean; codigo?: string };
    expect(corpo).toMatchObject({ ok: true, porCodigo: true });
    await expect.poll(async () => (await recuperacoes(alvo.id)).length, { timeout: 20_000 }).toBe(2);
    const novo = codigoDe((await recuperacoes(alvo.id))[0].corpo);
    expect(novo).toMatch(/^\d{6}$/);
    expect(corpo.codigo).toBe(novo);
    // Envelhece o pedido além de qualquer validade do Supabase (o lab usa otp_expiry; produção, 600 s).
    // E1043: pelo cliente JS do Postgres, e não pelo cliente de linha de comando: o Playwright corre na imagem oficial
    // (E1037), que só tem o Node e os navegadores.
    const sql = postgres(DB, { max: 1, onnotice: () => undefined });
    try {
      await sql`update auth.users set recovery_sent_at = now() - interval '1 day' where id = ${alvo.id}`;
    } finally {
      await sql.end();
    }
    const page = await (await browser.newContext()).newPage();
    await digitarCodigo(page, alvo.email, novo);
    await expect(page.getByTestId("reset-codigo-erro")).toHaveText(MSG_CODIGO_RECUPERACAO_INVALIDO, { timeout: 20_000 });
  });

  test("D. conta REAL: a rota não envia nada e NADA entra na caixa de teste (comportamento de hoje)", async ({ request }) => {
    const real = await conta("real", false);
    const r = await request.post("/api/auth/recuperar", { data: { email: real.email } });
    expect(await r.json()).toEqual({ ok: true, porCodigo: false });
    await new Promise((res) => setTimeout(res, 3_000));
    const { count } = await adm().from("emails_teste").select("id", { count: "exact", head: true }).eq("usuario_id", real.id);
    expect(count).toBe(0);
  });
});
