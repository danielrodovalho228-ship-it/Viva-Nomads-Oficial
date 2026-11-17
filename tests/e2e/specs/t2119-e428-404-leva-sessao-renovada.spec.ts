import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, entrarNaPagina, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/*
  T2119 — E428 @E428: os 404 do proxy levam os cookies que o getUser() acabou de renovar.
  Regra: com o token de acesso vencido, o proxy renova a sessão no getUser(). TODA resposta que não é a normal (os 404
  por rewrite: área de admin para quem não é admin, detalhe de contrato inexistente) tem de levar os cookies novos. Sem
  isso, o navegador ficava com o refresh token já gasto e a conta caía em /auth na navegação seguinte.
  Prova, para cada 404:
    1. a resposta é 404 e traz Set-Cookie da sessão (sb-…-auth-token);
    2. o cookie que fica no navegador tem expires_at no futuro (a sessão renovada, não a vencida);
    3. a navegação seguinte abre o Perfil sem passar por /auth.
  Só no laboratório (banco local + chave de serviço). Regra de sessão, sem layout: uma largura (1280).
*/

const senha = novaSenha();
const sufixo = novoSufixo();
const morador = { email: `mora.t2119.${sufixo}@lab.vivanomads.test`, nome: "Marta Morais Sessao", role: "tenant" as const };
const ids: (string | undefined)[] = [];

const NOME_SESSAO = /^sb-.*-auth-token(\.\d+)?$/;

/** Lê o JSON da sessão gravado pelo @supabase/ssr ("base64-" + JSON, em pedaços .0/.1 quando grande). */
async function sessaoNoNavegador(ctx: BrowserContext): Promise<{ expires_at: number; refresh_token: string; nome: string; modelo: Awaited<ReturnType<BrowserContext["cookies"]>>[number] }> {
  const pedacos = (await ctx.cookies()).filter((c) => NOME_SESSAO.test(c.name));
  expect(pedacos.length, "há cookie de sessão").toBeGreaterThan(0);
  const ordem = (n: string) => Number(n.match(/\.(\d+)$/)?.[1] ?? -1);
  const ordenados = [...pedacos].sort((a, b) => ordem(a.name) - ordem(b.name));
  const valor = ordenados.map((c) => decodeURIComponent(c.value)).join("");
  const json = JSON.parse(Buffer.from(valor.replace(/^base64-/, ""), "base64url").toString("utf8"));
  return { expires_at: json.expires_at, refresh_token: json.refresh_token, nome: ordenados[0].name.replace(/\.\d+$/, ""), modelo: ordenados[0] };
}

/** Regrava o cookie de sessão com expires_at no passado: a próxima ida ao servidor obriga o getUser() a renovar. */
async function vencerToken(ctx: BrowserContext) {
  const pedacos = (await ctx.cookies()).filter((c) => NOME_SESSAO.test(c.name));
  const s = await sessaoNoNavegador(ctx);
  const ordem = (n: string) => Number(n.match(/\.(\d+)$/)?.[1] ?? -1);
  const valor = [...pedacos].sort((a, b) => ordem(a.name) - ordem(b.name)).map((c) => decodeURIComponent(c.value)).join("");
  const json = JSON.parse(Buffer.from(valor.replace(/^base64-/, ""), "base64url").toString("utf8"));
  json.expires_at = Math.floor(Date.now() / 1000) - 120;
  const novo = "base64-" + Buffer.from(JSON.stringify(json), "utf8").toString("base64url");
  await ctx.clearCookies({ name: NOME_SESSAO });
  const partes = novo.length <= 3180 ? [novo] : novo.match(/.{1,3180}/g)!;
  await ctx.addCookies(
    partes.map((v, i) => ({
      name: partes.length === 1 ? s.nome : `${s.nome}.${i}`,
      value: v,
      domain: s.modelo.domain,
      path: "/",
      httpOnly: s.modelo.httpOnly,
      secure: s.modelo.secure,
      sameSite: s.modelo.sameSite,
      expires: s.modelo.expires,
    })),
  );
  expect((await sessaoNoNavegador(ctx)).expires_at, "o token ficou vencido antes do 404").toBeLessThan(Date.now() / 1000);
}

async function contextoLogado(browser: Browser): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await entrarNaPagina(p, morador.email, senha);
  await p.close();
  return ctx;
}

function rastrearAuth(page: Page): string[] {
  const visitadas: string[] = [];
  page.on("framenavigated", (f) => {
    if (f === page.mainFrame()) visitadas.push(f.url());
  });
  return visitadas;
}

const CASOS = [
  { nome: "área de admin para quem não é admin", rota: "/admin" },
  { nome: "detalhe de contrato inexistente", rota: "/dashboard/contratos/00000000-0000-4000-8000-000000000428" },
] as const;

test.describe("T2119 — E428: o 404 do proxy leva a sessão renovada; a conta não cai em /auth depois dele @E428", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.push(await criarConta(morador, senha));
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const caso of CASOS) {
    test(`1280 px — ${caso.nome}: 404 com Set-Cookie da sessão renovada, e o Perfil abre depois sem /auth`, async ({ browser }) => {
      const ctx = await contextoLogado(browser);
      await vencerToken(ctx);
      const page = await ctx.newPage();

      // 1. o 404 traz os cookies da sessão renovada
      const resp = await page.goto(caso.rota, { waitUntil: "domcontentloaded" });
      expect(resp?.status(), `${caso.rota} responde 404`).toBe(404);
      const setCookies = (await resp!.headersArray()).filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value.split("=")[0]);
      expect(setCookies.filter((n) => NOME_SESSAO.test(n)), `Set-Cookie do 404 em ${caso.rota}: ${setCookies.join(", ") || "(nenhum)"}`).not.toHaveLength(0);

      // 2. o navegador ficou com a sessão renovada (não a vencida)
      const depois = await sessaoNoNavegador(ctx);
      expect(depois.expires_at, "expires_at do cookie depois do 404 está no futuro").toBeGreaterThan(Date.now() / 1000);

      // 3. a navegação seguinte segue dentro da conta
      const visitadas = rastrearAuth(page);
      await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("perfil-tela").first()).toBeAttached({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      expect(visitadas.some((u) => new URL(u).pathname === "/auth"), visitadas.join(" → ")).toBe(false);
      await ctx.close();
    });
  }
});
