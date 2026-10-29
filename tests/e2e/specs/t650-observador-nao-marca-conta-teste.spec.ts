// Portão pós-#1509/#1512 (Pista C, 29/10): E228 (links da auditoria) e botões do observador da QA; roda no lab-crítico deste PR.
import { test, expect, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import { authFile } from "../fixtures/auth";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarConta, liberarLimiteLogin, liberarLimiteLoginIp, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T650 — prova de segurança da observadora (Pista C, 29/10): o admin observador da QA (profiles.qa_admin) VÊ "Marcar como
  conta de teste" em Admin → Usuários (é admin), mas o SERVIDOR recusa a ação para ele — nem a própria conta, nem a de
  terceiros, reais ou de teste — mesmo com a chamada montada à mão:
    1. pela tela: o clique devolve a mensagem do observador e nada é gravado;
    2. a mesma server action (Next-Action capturado no clique) reenviada à mão com outros alvos e valores: recusada;
    3. direto na API do banco com a sessão dele (update em profiles.is_teste): o gatilho da 0135 mantém o valor;
    4. controle: o admin comum, com a MESMA chamada montada à mão, marca e desmarca (a chamada é válida).
  Só no laboratório. Se o servidor aceitar, é defeito de segurança (o desenho é do coordenador).
*/
const MSG = "Esta é a conta de QA (admin observador)";
const senha = novaSenha();
const sufixo = novoSufixo();
const emailObs = `qa+t650${sufixo}-observador@lab.vivanomads.test`;
const nomeReal = `Rita Real t650 ${sufixo}`;
const nomeTeste = `Tito Teste t650 ${sufixo}`;
const ids: Record<string, string> = {};
let segredo = "";
let sessao: BrowserContextOptions["storageState"];
let chamada: { url: string; headers: Record<string, string>; corpo: string | null } | null = null;

const isTeste = async (id: string) => (await adm().from("profiles").select("is_teste").eq("id", id).single()).data?.is_teste as boolean;

/** Login por senha (aal1) e o código do autenticador (aal2), como a QA entra (o mesmo da t615). */
async function entrarObservador(browser: Browser): Promise<BrowserContextOptions["storageState"]> {
  await liberarLimiteLogin(emailObs);
  await liberarLimiteLoginIp();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/verificar-codigo|\/dashboard|\/admin/.test(page.url())) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== emailObs) await campoEmail.fill(emailObs, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/verificar-codigo|\/dashboard|\/admin/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredo));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin\/usuarios/, { timeout: 30_000 });
  }
  const estado = await ctx.storageState();
  await ctx.close();
  return estado;
}

/** Reenvia a server action capturada com outros argumentos, pela sessão da página (cookies dela). */
async function chamarAMao(page: Page, perfilId: string, marcar: boolean): Promise<{ status: number; texto: string }> {
  expect(chamada, "a chamada da server action não foi capturada no clique").not.toBeNull();
  return page.evaluate(
    async ({ url, headers, corpo }) => {
      const r = await fetch(url, { method: "POST", headers, body: corpo });
      return { status: r.status, texto: await r.text() };
    },
    { url: chamada!.url, headers: chamada!.headers, corpo: JSON.stringify([perfilId, marcar]) },
  );
}

test.describe("T650 — o servidor recusa 'Marcar como conta de teste' para o admin observador da QA", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 180_000 });

  test.beforeAll(async ({ browser }, info) => {
    if (info.project.name !== "chromium") return;
    test.setTimeout(300_000);
    ids.obs = await criarConta({ email: emailObs, nome: "Olívia Observadora t650", role: "tenant" }, senha);
    ids.real = await criarConta({ email: `real.t650.${sufixo}@lab.vivanomads.test`, nome: nomeReal, role: "tenant" }, senha);
    ids.teste = await criarConta({ email: `teste.t650.${sufixo}@lab.vivanomads.test`, nome: nomeTeste, role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).in("id", [ids.obs, ids.teste]);
    await adm().from("profiles").update({ is_teste: false }).eq("id", ids.real);
    // Só cabe um observador por vez (promover_qa_admin): espera outra spec soltar o dela.
    await expect
      .poll(async () => (await adm().rpc("promover_qa_admin", { p_id: ids.obs })).error?.message ?? "ok", { timeout: 180_000, intervals: [5_000] })
      .toBe("ok");
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: emailObs, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "qa-observador-t650" });
    if (eEnroll) throw eEnroll;
    segredo = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredo) });
    if (eVer) throw eVer;
    sessao = await entrarObservador(browser);
  });

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "chromium", "roda só no projeto chromium (uma conta observadora por vez)");
  });

  test.afterAll(async () => {
    if (!ids.obs) return;
    if (ids.obs) await adm().rpc("revogar_qa_admin", { p_id: ids.obs });
    await apagarContas([ids.obs, ids.real, ids.teste].filter(Boolean));
  });

  test("1. pela tela: o observador vê a ação, mas o clique é recusado e nada é gravado", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: sessao, viewport: { width: 1280, height: 900 } })).newPage();
    page.on("request", (r) => {
      const h = r.headers();
      // Só a chamada desta ação (o corpo leva o id do alvo); a página dispara outras server actions ao abrir.
      if (r.method() === "POST" && h["next-action"] && !chamada && (r.postData() ?? "").includes(ids.real)) {
        const headers: Record<string, string> = {};
        for (const k of ["next-action", "next-router-state-tree", "content-type", "accept"]) if (h[k]) headers[k] = h[k];
        chamada = { url: r.url(), headers, corpo: r.postData() };
      }
    });
    await page.goto(`/admin/usuarios?q=${encodeURIComponent(nomeReal)}`, { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname).toBe("/admin/usuarios");
    const bloco = page.locator(`[data-testid="conta-teste"][data-usuario-id="${ids.real}"]`).filter({ visible: true }).first();
    // A ação aparece para o observador (o que a prova ao vivo viu).
    await expect(bloco.getByTestId("marcar-teste")).toBeVisible({ timeout: 30_000 });
    await bloco.getByTestId("marcar-teste").click();
    await bloco.getByTestId("marcar-teste-confirmar").click();
    await expect(bloco.getByTestId("conta-teste-erro")).toContainText(MSG, { timeout: 20_000 });
    expect(await isTeste(ids.real), "a conta real continua real").toBe(false);
    // O corpo da chamada da tela é [id, true]: a mesma forma que a chamada à mão monta.
    expect(chamada?.corpo, "corpo da server action capturada").toBe(JSON.stringify([ids.real, true]));
    await page.screenshot({ path: "tests/laboratorio/saida/t650-1-recusa-na-tela.png" });
    await page.context().close();
  });

  test("2. a chamada montada à mão (mesma server action, outros alvos): recusada para o próprio e para terceiros", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: sessao })).newPage();
    await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
    const casos: { nome: string; id: string; marcar: boolean; antes: boolean }[] = [
      { nome: "terceiro real → marcar", id: ids.real, marcar: true, antes: false },
      { nome: "terceiro de teste → desmarcar", id: ids.teste, marcar: false, antes: true },
      { nome: "a própria conta → desmarcar", id: ids.obs, marcar: false, antes: true },
      { nome: "a própria conta → marcar (já é de teste)", id: ids.obs, marcar: true, antes: true },
    ];
    for (const c of casos) {
      await test.step(c.nome, async () => {
        const r = await chamarAMao(page, c.id, c.marcar);
        console.log(`T650|mao|${c.nome}|HTTP ${r.status}|${r.texto.replace(/\s+/g, " ").slice(-240)}`);
        expect(r.texto, `${c.nome}: a resposta traz a recusa do observador`).toContain(MSG);
        expect(r.texto, `${c.nome}: a resposta não diz ok`).not.toContain('"ok":true');
        expect(await isTeste(c.id), `${c.nome}: is_teste não mudou`).toBe(c.antes);
      });
    }
    await page.context().close();
  });

  test("3. direto na API do banco com a sessão do observador: is_teste não muda", async () => {
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email: emailObs, password: senha });
    if (error) throw error;
    for (const [id, valor, antes] of [
      [ids.real, true, false],
      [ids.teste, false, true],
      [ids.obs, false, true],
    ] as const) {
      const r = await c.from("profiles").update({ is_teste: valor }).eq("id", id).select("id, is_teste");
      console.log(`T650|api|${id === ids.obs ? "própria" : id === ids.real ? "real" : "teste"}|${JSON.stringify(r.error ?? r.data)}`);
      expect(await isTeste(id), `update direto em ${id}: is_teste não mudou`).toBe(antes);
    }
  });

  test("4. controle: o admin comum, com a mesma chamada à mão, marca e desmarca", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: authFile("admin") });
    const page = await ctx.newPage();
    await page.goto("/admin/usuarios", { waitUntil: "domcontentloaded" });
    expect(new URL(page.url()).pathname, "o admin do laboratório abre /admin/usuarios").toBe("/admin/usuarios");
    try {
      const r = await chamarAMao(page, ids.real, true);
      expect(r.texto, "admin comum: marcar passa").not.toContain(MSG);
      await expect.poll(() => isTeste(ids.real), { timeout: 15_000 }).toBe(true);
      const r2 = await chamarAMao(page, ids.real, false);
      expect(r2.texto, "admin comum: desmarcar passa").not.toContain(MSG);
      await expect.poll(() => isTeste(ids.real), { timeout: 15_000 }).toBe(false);
    } finally {
      await adm().from("profiles").update({ is_teste: false }).eq("id", ids.real);
      await ctx.close();
    }
  });
});
