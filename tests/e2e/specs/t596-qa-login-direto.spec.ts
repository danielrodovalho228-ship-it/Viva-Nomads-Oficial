import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { LIMITE_QA_POR_HORA, chaveLimiteConta } from "../../../src/lib/qa/entrar";
import { NO_LABORATORIO, adm, apagarContas, criarAdmin, criarConta, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T596 — QA-LOGIN-B: a QA entra direto numa conta de TESTE (sem código por e-mail).
    1. sem QA_LOGIN_KEY (o servidor normal do lab): POST /api/qa/entrar e GET /qa/entrar → 404;
    2. chave errada → 404;
    3. conta real com a chave certa → 404;
    4. administrador (mesmo marcado como teste) → 404;
    5. conta de teste → sessão gravada nos cookies, nenhum e-mail sai, registro em qa_entradas sem e-mail;
    6. e-mail novo dentro de QA_EMAIL_PADRAO → conta criada com is_teste = true; fora do padrão → 404 (e nada criado);
    7. limite: 30 por hora por IP e 30 por hora por conta → 429;
    8. a chave não aparece em resposta nem no log do servidor; GET /qa/entrar com ?chave= → 404, e o atalho entra pelo
       formulário com a chave no campo de senha.
  A chave e o padrão daqui são do teste (aleatórios); nada de valor real. O 2º servidor (porta 3127) é do mesmo
  build, com QA_LOGIN_KEY e QA_EMAIL_PADRAO só dele, como a t592.
*/
const SAIDA = "tests/laboratorio/saida";
const LOG = `${SAIDA}/t596-servidor-qa.log`;
const PORTA = 3127;
const BASE = `http://localhost:${PORTA}`;
const CHAVE = `t596-${randomBytes(16).toString("hex")}`;
const sufixo = novoSufixo();
const PADRAO = String.raw`qa\+t596${sufixo}-[a-z0-9]+@lab\.vivanomads\.test`;
const senha = novaSenha();
const ids: Record<string, string> = {};
const criadas: string[] = [];
let servidor: ChildProcess | null = null;
let ipSeq = 0;
/** Cada caso usa um IP próprio (x-forwarded-for), para o limite por IP de um não pesar no outro. */
const novoIp = () => `10.59.6.${++ipSeq}`;

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
  const { data } = await adm().from("profiles").select("id, is_teste, role").eq("email", email).maybeSingle();
  return data as { id: string; is_teste: boolean; role: string } | null;
}

test.describe("T596 — QA-LOGIN-B: entrada direta da QA nas contas de teste", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial", timeout: 240_000 });

  test.beforeAll(async () => {
    test.setTimeout(180_000);
    ids.teste = await criarConta({ email: `teste.t596.${sufixo}@lab.vivanomads.test`, nome: "Tina Teste", role: "tenant" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.teste);
    ids.real = await criarConta({ email: `real.t596.${sufixo}@lab.vivanomads.test`, nome: "Rui Real", role: "owner" }, senha);
    ids.admin = await criarAdmin(`admin.t596.${sufixo}@lab.vivanomads.test`, "Ada Admin", senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.admin);
    ids.limite = await criarConta({ email: `limite.t596.${sufixo}@lab.vivanomads.test`, nome: "Lia Limite", role: "owner" }, senha);
    await adm().from("profiles").update({ is_teste: true }).eq("id", ids.limite);

    test.skip(!existsSync(".next/BUILD_ID"), "Precisa do build do laboratório (next start).");
    const log = createWriteStream(LOG);
    servidor = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(PORTA)], {
      env: { ...process.env, QA_LOGIN_KEY: CHAVE, QA_EMAIL_PADRAO: PADRAO, PORT: String(PORTA) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    servidor.stdout?.pipe(log);
    servidor.stderr?.pipe(log);
    await expect.poll(async () => (await fetch(`${BASE}/api/qa/entrar`).catch(() => null))?.status ?? 0, { timeout: 90_000 }).toBe(404);
  });

  test.afterAll(async () => {
    servidor?.kill("SIGTERM");
    const todos = [ids.teste, ids.real, ids.admin, ids.limite, ...criadas].filter(Boolean);
    await adm().from("qa_entradas").delete().in("usuario_id", todos);
    await adm().from("limites_uso").delete().like("chave", "qa-entrar:%");
    await apagarContas(todos);
  });

  test("1. sem QA_LOGIN_KEY a rota e o atalho não existem (servidor normal do lab)", async ({ request }) => {
    const r = await request.post("/api/qa/entrar", { data: { email: `teste.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE } });
    expect(r.status()).toBe(404);
    const p = await request.get(`/qa/entrar?email=teste.t596.${sufixo}@lab.vivanomads.test`);
    expect(p.status()).toBe(404);
  });

  test("2–4. chave errada, conta real e administrador → 404 com o mesmo corpo, sem cookie de sessão", async () => {
    const errada = await entrar({ email: `teste.t596.${sufixo}@lab.vivanomads.test`, chave: `${CHAVE}x` });
    expect(errada.status).toBe(404);
    const semChave = await entrar({ email: `teste.t596.${sufixo}@lab.vivanomads.test` });
    expect(semChave.status).toBe(404);
    const real = await entrar({ email: `real.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE });
    expect(real.status).toBe(404);
    const admin = await entrar({ email: `admin.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE });
    expect(admin.status).toBe(404);
    for (const r of [errada, semChave, real, admin]) {
      expect(r.texto).toBe(errada.texto);
      expect(r.cookies.some((c) => /sb-.*-auth-token/.test(c))).toBe(false);
    }
  });

  test("5. conta de teste: sessão nos cookies, nenhum e-mail sai, registro sem e-mail nem chave", async () => {
    const email = `teste.t596.${sufixo}@lab.vivanomads.test`;
    const desde = new Date().toISOString();
    const outboxAntes = process.env.LAB_OUTBOX && existsSync(process.env.LAB_OUTBOX) ? readFileSync(process.env.LAB_OUTBOX, "utf8").split(email).length : 0;
    const r = await entrar({ email, chave: CHAVE });
    expect(r.status, r.texto).toBe(200);
    const sessao = r.cookies.filter((c) => /sb-.*-auth-token/.test(c));
    expect(sessao.length, "cookie de sessão gravado").toBeGreaterThan(0);
    // A sessão vale: com os cookies, o painel abre (sem mandar para /auth).
    const cookie = sessao.map((c) => c.split(";")[0]).join("; ");
    const painel = await fetch(`${BASE}/dashboard`, { headers: { cookie }, redirect: "manual" });
    expect(painel.headers.get("location") ?? "", "com a sessão, o painel não manda para o login").not.toMatch(/\/auth(\?|$)/);
    expect([200, 307, 308]).toContain(painel.status);
    const semSessao = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
    expect(semSessao.headers.get("location") ?? "", "controle: sem a sessão, vai para o login").toMatch(/\/auth(\?|$)/);
    // Nenhum e-mail: nem na caixa de teste, nem na saída simulada.
    await new Promise((res) => setTimeout(res, 2000));
    const { count } = await adm().from("emails_teste").select("id", { count: "exact", head: true }).eq("usuario_id", ids.teste).gt("criado_em", desde);
    expect(count ?? 0).toBe(0);
    if (process.env.LAB_OUTBOX && existsSync(process.env.LAB_OUTBOX)) expect(readFileSync(process.env.LAB_OUTBOX, "utf8").split(email).length).toBe(outboxAntes);
    const { data: reg } = await adm().from("qa_entradas").select("*").eq("usuario_id", ids.teste);
    expect(reg).toHaveLength(1);
    expect(reg![0].conta_criada).toBe(false);
    expect(String(reg![0].ip_hash)).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(reg)).not.toContain(email);
    expect(JSON.stringify(reg)).not.toContain(CHAVE);
  });

  test("6. e-mail novo dentro do padrão → conta criada com is_teste; fora do padrão → 404 e nada criado", async () => {
    const novo = `qa+t596${sufixo}-dono1@lab.vivanomads.test`;
    const r = await entrar({ email: novo, chave: CHAVE, papel: "owner" });
    expect(r.status, r.texto).toBe(200);
    const conta = await contaPorEmail(novo);
    expect(conta).toBeTruthy();
    criadas.push(conta!.id);
    expect(conta!.is_teste).toBe(true);
    expect(conta!.role).toBe("owner");
    const { data: reg } = await adm().from("qa_entradas").select("conta_criada").eq("usuario_id", conta!.id);
    expect(reg).toEqual([{ conta_criada: true }]);
    // Papel pedido "admin" não vira admin: conta nova é sempre morador ou proprietário.
    const outro = `qa+t596${sufixo}-tentaadmin@lab.vivanomads.test`;
    expect((await entrar({ email: outro, chave: CHAVE, papel: "admin" })).status).toBe(200);
    const c2 = await contaPorEmail(outro);
    criadas.push(c2!.id);
    expect(c2!.role).toBe("tenant");

    const fora = `fora.t596.${sufixo}@lab.vivanomads.test`;
    expect((await entrar({ email: fora, chave: CHAVE })).status).toBe(404);
    expect(await contaPorEmail(fora)).toBeNull();
  });

  test("7. limite: 30 por hora por IP e 30 por hora por conta", async () => {
    // Por IP: 30 tentativas (aqui com e-mail fora do padrão → 404); a 31ª, com a chave certa, leva 429.
    const ip = novoIp();
    for (let i = 0; i < 30; i++) expect((await entrar({ email: `fora${i}.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE }, ip)).status).toBe(404);
    expect((await entrar({ email: `teste.t596.${sufixo}@lab.vivanomads.test`, chave: CHAVE }, ip)).status).toBe(429);
    // Chave errada estourada continua 404 (não revela a rota).
    expect((await entrar({ email: `teste.t596.${sufixo}@lab.vivanomads.test`, chave: "errada" }, ip)).status).toBe(404);
    // Por conta: a conta já gastou as 30 da hora (consumidas direto no limitador, com a MESMA chave que a rota usa;
    // 30 entradas reais estourariam o limite de verificações do próprio Supabase, 30 a cada 5 min por IP).
    const email = `limite.t596.${sufixo}@lab.vivanomads.test`;
    for (let i = 0; i < LIMITE_QA_POR_HORA; i++) {
      const { data } = await adm().rpc("consumir_limite", { chave: chaveLimiteConta(email), maximo: LIMITE_QA_POR_HORA, janela_segundos: 3600 });
      expect(data).toBe(true);
    }
    expect((await entrar({ email, chave: CHAVE })).status, "de um IP novo, mas a conta estourou").toBe(429);
    const { count } = await adm().from("qa_entradas").select("id", { count: "exact", head: true }).eq("usuario_id", ids.limite);
    expect(count ?? 0, "estourada: não entra nem registra").toBe(0);
  });

  test("8. atalho /qa/entrar: ?chave= dá 404; o formulário pede a chave no campo de senha e leva ao destino", async ({ browser }) => {
    const comChave = await fetch(`${BASE}/qa/entrar?email=teste.t596.${sufixo}@lab.vivanomads.test&chave=${CHAVE}`);
    expect(comChave.status).toBe(404);
    expect((await fetch(`${BASE}/qa/entrar?key=x`)).status).toBe(404);

    const ctx = await browser.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": novoIp() } });
    const page = await ctx.newPage();
    const urls: string[] = [];
    page.on("request", (r) => urls.push(r.url()));
    await page.goto(`/qa/entrar?email=teste.t596.${sufixo}@lab.vivanomads.test&destino=/dashboard/favoritos`);
    await expect(page.getByTestId("qa-email")).toHaveValue(`teste.t596.${sufixo}@lab.vivanomads.test`);
    await expect(page.getByTestId("qa-chave")).toHaveAttribute("type", "password");
    await page.getByTestId("qa-chave").fill(CHAVE);
    await page.getByTestId("qa-entrar").click();
    await expect(page).toHaveURL(/\/dashboard\/favoritos/, { timeout: 30_000 });
    expect(urls.some((u) => u.includes(CHAVE)), "a chave nunca vai numa URL").toBe(false);
    // Destino de fora do site cai no painel.
    await page.goto(`/qa/entrar?email=teste.t596.${sufixo}@lab.vivanomads.test&destino=https://exemplo.com`);
    await page.getByTestId("qa-chave").fill(CHAVE);
    await page.getByTestId("qa-entrar").click();
    await expect(page).toHaveURL(new RegExp(`^${BASE}/dashboard`), { timeout: 30_000 });
    await ctx.close();
  });

  test("9. a chave não aparece no log do servidor", async () => {
    await new Promise((r) => setTimeout(r, 1000));
    const log = existsSync(LOG) ? readFileSync(LOG, "utf8") : "";
    expect(log.includes(CHAVE)).toBe(false);
    expect(log.includes(`teste.t596.${sufixo}`)).toBe(false);
  });
});
