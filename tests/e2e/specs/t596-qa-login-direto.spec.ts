import { test, expect, type Browser } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LIMITE_QA_POR_HORA, chaveLimiteConta } from "../../../src/lib/qa/entrar";
import { gerarCodigoTotp } from "../fixtures/totp";
import { CHAVE_ANON, NO_LABORATORIO, URL_SUPABASE, adm, apagarContas, criarAdmin, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T596 — QA-LOGIN-B v2: porta de QA (contas de teste e admin observador da Muse).
    1. sem QA_LOGIN_KEY_HASH (o servidor normal do lab): POST /api/qa/entrar e GET /qa/entrar → 404;
    2. chave errada, conta real, admin comum (o "Daniel"), admin marcado de teste sem qa_admin → 404, sem sessão;
    3. conta de teste → sessão nos cookies, nenhum e-mail sai; registro tipo "teste" sem e-mail nem chave;
    4. e-mail novo no padrão → conta de teste (nunca admin); fora do padrão → 404 e nada criado;
    5. limite: 30/h por IP e por conta → 429;
    6. admin observador: criado pela porta, promovido pela rotina de serviço, 2FA PRÓPRIO (TOTP cadastrado pelo fluxo
       do Supabase); entra pela porta em aal1 → o /admin pede o código; com o código (aal2) o /admin abre; registro
       "admin_qa"; Caixa dos Sócios 404 na tela e invisível na RLS (tabela e arquivos); Sistema sem os botões de chave
       nem o cartão de backup, com a seção "Porta de QA";
    7. desligamento: com NEXT_PUBLIC_PRE_LANCAMENTO=off (3º servidor) o observador leva 404 e a conta de teste entra
       (a data de 31/12/2026 é coberta no teste de unidade, src/lib/qa/entrar.test.ts);
    8. atalho /qa/entrar: ?chave= dá 404; o formulário leva ao destino com a chave só no campo de senha;
    9. nenhum log contém a chave, o segredo do TOTP ou o e-mail completo.
  A chave, o hash, o padrão e o segredo do TOTP são do teste (aleatórios, só na memória). Servidores extras do mesmo
  build: 3127 (porta ligada) e 3129 (porta ligada, pré-lançamento desligado), como a t592.
*/
const SAIDA = "tests/laboratorio/saida";
const LOG = `${SAIDA}/t596-servidor-qa.log`;
const LOG_OFF = `${SAIDA}/t596-servidor-qa-off.log`;
const BASE = "http://localhost:3127";
const BASE_OFF = "http://localhost:3129";
const CHAVE = `t596-${randomBytes(16).toString("hex")}`;
const HASH = createHash("sha256").update(CHAVE, "utf8").digest("hex");
const sufixo = novoSufixo();
const PADRAO = String.raw`qa\+t596${sufixo}-[a-z0-9]+@lab\.vivanomads\.test`;
const senha = novaSenha();
const ids: Record<string, string> = {};
const criadas: string[] = [];
const servidores: ChildProcess[] = [];
let segredoTotp = "";
let clienteObservador: SupabaseClient | null = null;
let ipSeq = 0;
/** Cada caso usa um IP próprio (x-forwarded-for), para o limite por IP de um não pesar no outro. */
const novoIp = () => `10.59.6.${++ipSeq}`;
const emailObs = `qa+t596${sufixo}-observador@lab.vivanomads.test`;

async function subir(porta: number, log: string, extra: Record<string, string>) {
  const saida = createWriteStream(log);
  const s = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(porta)], {
    env: { ...process.env, QA_LOGIN_KEY_HASH: HASH, QA_EMAIL_PADRAO: PADRAO, PORT: String(porta), ...extra },
    stdio: ["ignore", "pipe", "pipe"],
  });
  s.stdout?.pipe(saida);
  s.stderr?.pipe(saida);
  servidores.push(s);
  await expect.poll(async () => (await fetch(`http://localhost:${porta}/api/qa/entrar`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(404);
}

async function entrar(corpo: Record<string, unknown>, ip = novoIp(), base = BASE) {
  const r = await fetch(`${base}/api/qa/entrar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(corpo),
    redirect: "manual",
  });
  const texto = await r.text();
  const cookies = r.headers.getSetCookie?.() ?? [];
  expect(texto, "a chave nunca volta na resposta").not.toContain(CHAVE);
  return { status: r.status, texto, cookies };
}

async function contaPorEmail(email: string) {
  const { data } = await adm().from("profiles").select("id, is_teste, role, qa_admin").eq("email", email).maybeSingle();
  return data as { id: string; is_teste: boolean; role: string; qa_admin: boolean } | null;
}

/** Entra pela porta no navegador (atalho /qa/entrar) e devolve a página. */
async function entrarPeloAtalho(browser: Browser, email: string, destino: string, base = BASE) {
  const ctx = await browser.newContext({ baseURL: base, extraHTTPHeaders: { "x-forwarded-for": novoIp() } });
  const page = await ctx.newPage();
  await page.goto(`/qa/entrar?email=${encodeURIComponent(email)}&destino=${encodeURIComponent(destino)}`);
  await page.getByTestId("qa-chave").fill(CHAVE);
  await page.getByTestId("qa-entrar").click();
  return page;
}

test.describe("T596 — QA-LOGIN-B v2: porta de QA e admin observador", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    test.setTimeout(240_000);
    ids.teste = await criarConta({ email: `teste.t596.${sufixo}@lab.vivanomads.test`, nome: "Tina Teste", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.teste);
    ids.real = await criarConta({ email: `real.t596.${sufixo}@lab.vivanomads.test`, nome: "Rui Real", role: "owner" }, senha);
    ids.adminComum = await criarAdmin(`daniel.t596.${sufixo}@lab.vivanomads.test`, "Dani Admin", senha);
    ids.adminTeste = await criarAdmin(`admin.t596.${sufixo}@lab.vivanomads.test`, "Ada Admin", senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.adminTeste);
    ids.limite = await criarConta({ email: `limite.t596.${sufixo}@lab.vivanomads.test`, nome: "Lia Limite", role: "owner" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.limite);
    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    await subir(3127, LOG, {});
  });

  test.afterAll(async () => {
    for (const s of servidores) s.kill("SIGTERM");
    const todos = [...Object.values(ids), ...criadas].filter(Boolean);
    if (ids.obs) await adm().rpc("revogar_qa_admin", { p_id: ids.obs });
    await adm().from("caixa_socios").delete().like("texto", `t596 ${sufixo}%`);
    await adm().from("qa_entradas").delete().in("usuario_id", todos);
    await adm().from("limites_uso").delete().like("chave", "qa-entrar:%");
    await apagarContas(todos);
  });

  test("1. sem QA_LOGIN_KEY_HASH a rota e o atalho não existem (servidor normal do lab)", async ({ request }) => {
    expect((await request.post("/api/qa/entrar", { data: { email: `teste.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE } })).status()).toBe(404);
    expect((await request.get(`/qa/entrar?email=teste.t596.${sufixo}@lab.vivanomads.test`)).status()).toBe(404);
  });

  test("2. chave errada, conta real, admin comum e admin de teste sem qa_admin → 404 igual, sem sessão", async () => {
    const casos = [
      await entrar({ email: `teste.t596.${sufixo}@lab.vivanomads.test`, chave: `${CHAVE}x` }),
      await entrar({ email: `teste.t596.${sufixo}@lab.vivanomads.test`, chave: HASH }), // o hash não serve de chave
      await entrar({ email: `teste.t596.${sufixo}@lab.vivanomads.test` }),
      await entrar({ email: `real.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE }),
      await entrar({ email: `daniel.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE }),
      await entrar({ email: `admin.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE }),
    ];
    for (const r of casos) {
      expect(r.status).toBe(404);
      expect(r.texto).toBe(casos[0].texto);
      expect(r.cookies.some((c) => /sb-.*-auth-token/.test(c))).toBe(false);
    }
  });

  test("3. conta de teste: sessão nos cookies, nenhum e-mail sai, registro 'teste' sem e-mail nem chave", async () => {
    const email = `teste.t596.${sufixo}@lab.vivanomads.test`;
    const desde = new Date().toISOString();
    const outbox = process.env.LAB_OUTBOX && existsSync(process.env.LAB_OUTBOX) ? process.env.LAB_OUTBOX : null;
    const outboxAntes = outbox ? readFileSync(outbox, "utf8").split(email).length : 0;
    const r = await entrar({ email, chave: CHAVE, destino: "/dashboard/favoritos?q=x@y.z" });
    expect(r.status, r.texto).toBe(200);
    const sessao = r.cookies.filter((c) => /sb-.*-auth-token/.test(c));
    expect(sessao.length, "cookie de sessão gravado").toBeGreaterThan(0);
    const cookie = sessao.map((c) => c.split(";")[0]).join("; ");
    const painel = await fetch(`${BASE}/dashboard`, { headers: { cookie }, redirect: "manual" });
    expect(painel.headers.get("location") ?? "", "com a sessão, o painel não manda para o login").not.toMatch(/\/auth(\?|$)/);
    const semSessao = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
    expect(semSessao.headers.get("location") ?? "", "controle: sem a sessão, vai para o login").toMatch(/\/auth(\?|$)/);
    await new Promise((res) => setTimeout(res, 2000));
    const { count } = await adm().from("emails_teste").select("id", { count: "exact", head: true }).eq("usuario_id", ids.teste).gt("criado_em", desde);
    expect(count ?? 0).toBe(0);
    if (outbox) expect(readFileSync(outbox, "utf8").split(email).length).toBe(outboxAntes);
    const { data: reg } = await adm().from("qa_entradas").select("*").eq("usuario_id", ids.teste);
    expect(reg).toHaveLength(1);
    expect(reg![0]).toMatchObject({ tipo: "teste", destino: "/dashboard/favoritos", conta_criada: false });
    expect(String(reg![0].ip_hash)).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(reg)).not.toContain(email);
    expect(JSON.stringify(reg)).not.toContain(CHAVE);
  });

  test("4. e-mail novo dentro do padrão → conta de teste (nunca admin); fora do padrão → 404 e nada criado", async () => {
    const novo = `qa+t596${sufixo}-dono1@lab.vivanomads.test`;
    expect((await entrar({ email: novo, chave: CHAVE, papel: "owner" })).status).toBe(200);
    const conta = await contaPorEmail(novo);
    criadas.push(conta!.id);
    expect(conta).toMatchObject({ is_teste: true, role: "owner", qa_admin: false });
    const outro = `qa+t596${sufixo}-tentaadmin@lab.vivanomads.test`;
    expect((await entrar({ email: outro, chave: CHAVE, papel: "admin" })).status).toBe(200);
    const c2 = await contaPorEmail(outro);
    criadas.push(c2!.id);
    expect(c2).toMatchObject({ role: "tenant", qa_admin: false });
    const fora = `fora.t596.${sufixo}@lab.vivanomads.test`;
    expect((await entrar({ email: fora, chave: CHAVE })).status).toBe(404);
    expect(await contaPorEmail(fora)).toBeNull();
  });

  test("5. limite: 30 por hora por IP e 30 por hora por conta", async () => {
    const ip = novoIp();
    for (let i = 0; i < LIMITE_QA_POR_HORA; i++) expect((await entrar({ email: `fora${i}.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE }, ip)).status).toBe(404);
    expect((await entrar({ email: `teste.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE }, ip)).status).toBe(429);
    expect((await entrar({ email: `teste.t596.${sufixo}@lab.vivanomads.test`, chave: "errada" }, ip)).status, "chave errada segue 404").toBe(404);
    // Por conta: as 30 da hora consumidas no limitador com a MESMA chave da rota (30 entradas reais estourariam o
    // limite de verificações do próprio Supabase, 30 a cada 5 min por IP).
    const email = `limite.t596.${sufixo}@lab.vivanomads.test`;
    for (let i = 0; i < LIMITE_QA_POR_HORA; i++) {
      const { data } = await adm().rpc("consumir_limite", { chave: chaveLimiteConta(email), maximo: LIMITE_QA_POR_HORA, janela_segundos: 3600 });
      expect(data).toBe(true);
    }
    expect((await entrar({ email, chave: CHAVE })).status).toBe(429);
    const { count } = await adm().from("qa_entradas").select("id", { count: "exact", head: true }).eq("usuario_id", ids.limite);
    expect(count ?? 0).toBe(0);
  });

  test("6a. admin observador: criado pela porta, promovido pela rotina de serviço, 2FA próprio cadastrado", async () => {
    expect((await entrar({ email: emailObs, chave: CHAVE })).status).toBe(200);
    const conta = await contaPorEmail(emailObs);
    ids.obs = conta!.id;
    expect(conta).toMatchObject({ is_teste: true, role: "tenant", qa_admin: false });
    // Ninguém se promove sozinho: a sessão da própria conta não muda qa_admin (gatilho da 0252).
    const { error: ePromo } = await adm().rpc("promover_qa_admin", { p_id: ids.obs });
    expect(ePromo).toBeNull();
    expect(await contaPorEmail(emailObs)).toMatchObject({ role: "admin", qa_admin: true, is_teste: true });
    // Conta real não pode ser promovida.
    const { error: eReal } = await adm().rpc("promover_qa_admin", { p_id: ids.real });
    expect(eReal?.message ?? "").toMatch(/teste/);
    // 2FA pelo fluxo normal do Supabase (como a tela de Segurança): enroll → challenge → verify. O segredo fica só aqui.
    await adm().auth.admin.updateUserById(ids.obs, { password: senha });
    clienteObservador = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    expect((await clienteObservador.auth.signInWithPassword({ email: emailObs, password: senha })).error).toBeNull();
    const { data: fator, error: eEnroll } = await clienteObservador.auth.mfa.enroll({ factorType: "totp", friendlyName: "qa-observador" });
    expect(eEnroll).toBeNull();
    segredoTotp = fator!.totp.secret;
    const { data: desafio } = await clienteObservador.auth.mfa.challenge({ factorId: fator!.id });
    expect((await clienteObservador.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredoTotp) })).error).toBeNull();
    // A sessão própria do observador também não consegue tirar a marca (o gatilho guarda qa_admin).
    await clienteObservador.from("profiles").update({ qa_admin: false }).eq("id", ids.obs);
    expect((await contaPorEmail(emailObs))!.qa_admin).toBe(true);
  });

  test("6b. pela porta em aal1 o /admin pede o código; com o código (aal2) abre; registro 'admin_qa'", async ({ browser }) => {
    const page = await entrarPeloAtalho(browser, emailObs, "/admin");
    await expect(page).toHaveURL(/\/auth\/verificar-codigo/, { timeout: 30_000 }); // aal1 não vê o admin
    await expect(page.getByTestId("admin-sistema")).toHaveCount(0);
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredoTotp));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin(\?|$|\/)/, { timeout: 30_000 });
    // Caixa dos Sócios: a página não existe para ele (notFound() dentro do layout do admin com streaming entrega a tela de
    // "não encontrada" com status 200; o que vale é o conteúdo: nada da Caixa aparece).
    await page.goto("/admin/socios");
    await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Novo envio")).toHaveCount(0);
    // Sistema: estado das chaves sem os botões; sem o cartão de backup; com a Porta de QA.
    await page.goto("/admin/sistema");
    await expect(page.getByTestId("admin-sistema")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("chaves-observador")).toBeVisible();
    await expect(page.getByTestId("chave-sms")).toHaveCount(0);
    await expect(page.getByTestId("cartao-backup-restauracao")).toHaveCount(0);
    await expect(page.getByTestId("porta-qa")).toBeVisible();
    await expect(page.getByTestId("porta-qa-admin")).toContainText("/admin");
    await page.context().close();
    const { data: reg } = await adm().from("qa_entradas").select("tipo, destino").eq("usuario_id", ids.obs).eq("tipo", "admin_qa");
    expect(reg).toEqual([{ tipo: "admin_qa", destino: "/admin" }]);
  });

  test("6c. Caixa dos Sócios invisível também na RLS (tabela e arquivos) para o observador em aal2", async () => {
    const { error: eIns } = await adm().from("caixa_socios").insert({ tipo: "texto", texto: `t596 ${sufixo} item da caixa`, autor: ids.adminComum });
    expect(eIns).toBeNull();
    const { count: total } = await adm().from("caixa_socios").select("id", { count: "exact", head: true }).like("texto", `t596 ${sufixo}%`);
    expect(total).toBe(1);
    const c = clienteObservador!;
    expect((await c.rpc("is_admin")).data, "o observador é admin de verdade (aal2)").toBe(true);
    const { data: lidos } = await c.from("caixa_socios").select("id").like("texto", `t596 ${sufixo}%`);
    expect(lidos ?? []).toHaveLength(0);
    const { error: eEnvia } = await c.from("caixa_socios").insert({ tipo: "texto", texto: `t596 ${sufixo} do observador`, autor: ids.obs, status: "novo" });
    expect(eEnvia, "nem envia").not.toBeNull();
    const { data: arquivos } = await c.storage.from("caixa-socios").list(ids.adminComum);
    expect(arquivos ?? []).toHaveLength(0);
    const { error: eUp } = await c.storage.from("caixa-socios").upload(`${ids.obs}/t596.txt`, new Blob(["x"], { type: "text/plain" }));
    expect(eUp, "nem sobe arquivo").not.toBeNull();
  });

  test("7. desligamento: com PRE_LANCAMENTO=off o observador leva 404; a conta de teste continua entrando", async () => {
    await subir(3129, LOG_OFF, { NEXT_PUBLIC_PRE_LANCAMENTO: "off" });
    expect((await entrar({ email: emailObs, chave: CHAVE }, novoIp(), BASE_OFF)).status).toBe(404);
    expect((await entrar({ email: `teste.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE }, novoIp(), BASE_OFF)).status).toBe(200);
    // E no servidor com o pré-lançamento ligado o observador segue entrando.
    expect((await entrar({ email: emailObs, chave: CHAVE })).status).toBe(200);
  });

  test("8. atalho /qa/entrar: ?chave= dá 404; o formulário leva ao destino; destino de fora cai no painel", async ({ browser }) => {
    expect((await fetch(`${BASE}/qa/entrar?email=teste.t596.${sufixo}@lab.vivanomads.test&chave=${CHAVE}`)).status).toBe(404);
    expect((await fetch(`${BASE}/qa/entrar?key=x`)).status).toBe(404);
    const page = await entrarPeloAtalho(browser, `teste.t596.${sufixo}@lab.vivanomads.test`, "/dashboard/favoritos");
    const urls: string[] = [];
    page.on("request", (r) => urls.push(r.url()));
    await expect(page).toHaveURL(/\/dashboard\/favoritos/, { timeout: 30_000 });
    await expect(page.getByTestId("qa-chave")).toHaveCount(0);
    await page.goto(`/qa/entrar?email=teste.t596.${sufixo}@lab.vivanomads.test&destino=https://exemplo.com`);
    await expect(page.getByTestId("qa-chave")).toHaveAttribute("type", "password");
    await page.getByTestId("qa-chave").fill(CHAVE);
    await page.getByTestId("qa-entrar").click();
    await expect(page).toHaveURL(new RegExp(`^${BASE}/dashboard`), { timeout: 30_000 });
    expect(urls.some((u) => u.includes(CHAVE)), "a chave nunca vai numa URL").toBe(false);
    await page.context().close();
  });

  test("9. nenhum log contém a chave, o segredo do TOTP ou o e-mail completo", async () => {
    await new Promise((r) => setTimeout(r, 1000));
    for (const arq of [LOG, LOG_OFF]) {
      const log = existsSync(arq) ? readFileSync(arq, "utf8") : "";
      expect(log.includes(CHAVE), `${arq}: chave`).toBe(false);
      expect(segredoTotp && log.includes(segredoTotp), `${arq}: segredo do TOTP`).toBeFalsy();
      for (const e of [emailObs, `teste.t596.${sufixo}@lab.vivanomads.test`, `real.t596.${sufixo}@lab.vivanomads.test`]) expect(log.includes(e), `${arq}: ${e.split("@")[0]}`).toBe(false);
    }
  });
});
