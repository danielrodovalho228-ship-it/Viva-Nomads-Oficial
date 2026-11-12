import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { gerarCodigoTotp } from "../fixtures/totp";
import {
  CHAVE_ANON,
  NO_LABORATORIO,
  URL_SUPABASE,
  apagarContas,
  criarAdmin,
  criarConta,
  entrarNaPagina,
  liberarLimiteLogin,
  liberarLimiteLoginIp,
  novaSenha,
  novoSufixo,
} from "../fixtures/laboratorio";

/*
  T1608 — E793 Onda 1 (piloto): o painel desenhado no servidor, com a sessão conferida lá, nas 5 rotas do piloto.
  Roda com o servidor em PAINEL_SESSAO_SERVIDOR=piloto (e com a MESMA variável no processo do Playwright). Sem ela, o
  spec prova o rollback: as rotas voltam ao HTML com o esqueleto do guarda (auth-guard-carregando).

  Pontos (prompt do coordenador):
   1. HTML do servidor (JS desligado): o conteúdo PRÓPRIO da tela, sem auth-guard-carregando;
   2. TPCU ≤ 300 ms (domcontentloaded → seletor da tela), sem esqueleto em nenhum quadro;
   3. zero erro de hidratação (build de produção: /Hydration|did not match|Minified React error #(418|423|425)/);
   4. proteção igual à de hoje (sem sessão → /auth?redirect=…; morador em /admin → 404);
   5. troca de conta no mesmo navegador (localStorage de A, cookies de B): o 1º quadro é de B e A nunca aparece;
   6. token vencido (expires_at no passado): a tela abre com o conteúdo, sem /auth (prova do A1 + A2);
   7. fora do piloto, com a chave ligada: 6 rotas com zero erro de hidratação e o HTML de hoje;
   8. chave off: as 5 rotas voltam ao esqueleto;
   9. o HTML do painel não é cacheável em cache compartilhado.
*/
const PILOTO = process.env.PAINEL_SESSAO_SERVIDOR === "piloto";
const HIDRATACAO = /Hydration|did not match|Minified React error #(418|423|425)/;
const LIMITE_TPCU_MS = 300;

/** As rotas do piloto e o seletor de conteúdo PRÓPRIO de cada uma (não o da casca). */
const ROTAS = [
  { rota: "/dashboard", conteudo: "inicio-dono" },
  // /dashboard/conta: no celular é o menu da Conta; no computador o próprio cliente leva ao Perfil (E492).
  { rota: "/dashboard/conta", conteudo: "conta-menu", soCelular: true },
  { rota: "/dashboard/conta/perfil", conteudo: "perfil-tela" },
  { rota: "/dashboard/conta/excluir", conteudo: "sair-da-viva" },
] as const;

const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.t1608.${sufixo}@lab.vivanomads.test`, nome: "Bruno Batista Piloto", role: "owner" as const };
const outra = { email: `ana.t1608.${sufixo}@lab.vivanomads.test`, nome: "Alice Antiga Piloto", role: "tenant" as const };
const admin = { email: `equipe.t1608.${sufixo}@lab.vivanomads.test`, nome: "[TESTE QA] Edu Equipe" };
const ids: (string | undefined)[] = [];
let segredoTotp = "";

/** Sonda instalada antes de qualquer script da página: o esqueleto aparece em algum quadro? quando o conteúdo apareceu? */
function sonda(seletor: string, nomeProibido?: string, iniciaisProibidas?: string) {
  return `(() => {
    window.__vn = { esqueleto: false, conteudoEm: null, proibido: false };
    const olhar = () => {
      if (document.querySelector('[data-testid="auth-guard-carregando"]')) window.__vn.esqueleto = true;
      const el = document.querySelector('[data-testid="${seletor}"]');
      if (el && window.__vn.conteudoEm === null) window.__vn.conteudoEm = performance.now();
      ${nomeProibido ? `if (document.body && document.body.innerText.includes(${JSON.stringify(nomeProibido)})) window.__vn.proibido = true;` : ""}
      ${iniciaisProibidas ? `for (const r of document.querySelectorAll("[data-rosto]")) if ((r.textContent || "").trim() === ${JSON.stringify(iniciaisProibidas)}) window.__vn.proibido = true;` : ""}
    };
    new MutationObserver(olhar).observe(document, { subtree: true, childList: true, characterData: true });
    document.addEventListener("DOMContentLoaded", olhar);
  })();`;
}

function colherErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("console", (m) => {
    if (HIDRATACAO.test(m.text())) erros.push(`console: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => {
    if (HIDRATACAO.test(String(e))) erros.push(`pageerror: ${String(e).slice(0, 200)}`);
  });
  return erros;
}

/** Contexto novo, já logado (cookies e localStorage do próprio login), sem páginas abertas. */
async function contextoLogado(browser: Browser, conta: { email: string }, largura: number): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: largura, height: largura === 390 ? 844 : 900 } });
  const p = await ctx.newPage();
  await entrarNaPagina(p, conta.email, senha);
  await p.close();
  return ctx;
}

async function medirTpcu(page: Page): Promise<{ tpcu: number; esqueleto: boolean }> {
  return page.evaluate(() => {
    const v = (window as unknown as { __vn: { esqueleto: boolean; conteudoEm: number | null } }).__vn;
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    return { tpcu: Math.max(0, (v.conteudoEm ?? Infinity) - nav.domContentLoadedEventStart), esqueleto: v.esqueleto };
  });
}

/** Cookie de sessão do @supabase/ssr ("base64-" + JSON, em pedaços .0/.1 quando grande) com expires_at no passado. */
async function vencerToken(ctx: BrowserContext) {
  const todos = await ctx.cookies();
  const pedacos = todos.filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
  expect(pedacos.length, "há cookie de sessão").toBeGreaterThan(0);
  const base = pedacos[0].name.replace(/\.\d+$/, "");
  const ordem = (n: string) => Number(n.match(/\.(\d+)$/)?.[1] ?? -1);
  const valor = pedacos.sort((a, b) => ordem(a.name) - ordem(b.name)).map((c) => decodeURIComponent(c.value)).join("");
  const json = JSON.parse(Buffer.from(valor.replace(/^base64-/, ""), "base64url").toString("utf8"));
  json.expires_at = Math.floor(Date.now() / 1000) - 120;
  const novo = "base64-" + Buffer.from(JSON.stringify(json), "utf8").toString("base64url");
  const modelo = pedacos[0];
  await ctx.clearCookies({ name: /^sb-.*-auth-token(\.\d+)?$/ });
  const partes = novo.length <= 3180 ? [novo] : novo.match(/.{1,3180}/g)!;
  await ctx.addCookies(
    partes.map((v, i) => ({
      name: partes.length === 1 ? base : `${base}.${i}`,
      value: v,
      domain: modelo.domain,
      path: "/",
      httpOnly: modelo.httpOnly,
      secure: modelo.secure,
      sameSite: modelo.sameSite,
      expires: modelo.expires,
    })),
  );
}

async function entrarAdmin(page: Page) {
  await liberarLimiteLogin(admin.email);
  await liberarLimiteLoginIp();
  await page.goto("/auth?senha=1", { waitUntil: "domcontentloaded" });
  const campoEmail = page.locator('input[name="email"], input[type="email"]').first();
  const campoSenha = page.locator('input[name="password"], input[type="password"]').first();
  await expect(async () => {
    if (/verificar-codigo|\/dashboard|\/admin/.test(page.url())) return;
    if ((await campoEmail.inputValue({ timeout: 5_000 })) !== admin.email) await campoEmail.fill(admin.email, { timeout: 5_000 });
    if ((await campoSenha.inputValue({ timeout: 5_000 })) !== senha) await campoSenha.fill(senha, { timeout: 5_000 });
    await page.locator("form").getByRole("button", { name: /^entrar$/i }).click({ timeout: 5_000 });
    await page.waitForURL(/verificar-codigo|\/dashboard|\/admin/, { timeout: 15_000 });
  }).toPass({ timeout: 50_000 });
  await page.goto("/admin", { waitUntil: "domcontentloaded" });
  if (/verificar-codigo/.test(page.url())) {
    await page.locator("#codigo-2fa").fill(gerarCodigoTotp(segredoTotp));
    await page.getByRole("button", { name: /confirmar e entrar/i }).click();
    await page.waitForURL(/\/admin(?!.*verificar)/, { timeout: 30_000 });
  }
}

test.describe(`T1608 — E793 Onda 1 (${PILOTO ? "chave piloto" : "chave off: rollback"})`, () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório (banco local + chave de serviço).");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.push(await criarConta(dono, senha));
    ids.push(await criarConta(outra, senha));
    ids.push(await criarAdmin(admin.email, admin.nome, senha));
    const c = createClient(URL_SUPABASE!, CHAVE_ANON!, { auth: { persistSession: false } });
    const { error: eLogin } = await c.auth.signInWithPassword({ email: admin.email, password: senha });
    if (eLogin) throw eLogin;
    const { data: fator, error: eEnroll } = await c.auth.mfa.enroll({ factorType: "totp", friendlyName: "t1608" });
    if (eEnroll) throw eEnroll;
    segredoTotp = fator!.totp.secret;
    const { data: desafio } = await c.auth.mfa.challenge({ factorId: fator!.id });
    const { error: eVer } = await c.auth.mfa.verify({ factorId: fator!.id, challengeId: desafio!.id, code: gerarCodigoTotp(segredoTotp) });
    if (eVer) throw eVer;
  });
  test.afterAll(async () => {
    await apagarContas(ids);
  });

  for (const largura of [390, 1280]) {
    test(`${largura}px — 1, 2, 3 e 8: HTML do servidor, TPCU e hidratação nas rotas do piloto`, async ({ browser }) => {
      const ctx = await contextoLogado(browser, dono, largura);
      const estado = await ctx.storageState();
      const semJs = await browser.newContext({ storageState: estado, javaScriptEnabled: false, viewport: { width: largura, height: 900 } });
      const linhas: string[] = [];
      for (const r of ROTAS) {
        // E798 (asserção alterada): no computador, /dashboard/conta vai ao Perfil já no servidor (307) — não há menu da
        // Conta a desenhar ali; o redirecionamento é provado no t1611.
        if (largura === 1280 && "soCelular" in r) continue;
        // (1)/(8) HTML do servidor, sem JavaScript.
        const pJs = await semJs.newPage();
        await pJs.goto(r.rota, { waitUntil: "domcontentloaded" });
        const html = await pJs.content();
        await pJs.close();
        if (PILOTO) {
          expect(html, `${r.rota}: conteúdo próprio no HTML`).toContain(`data-testid="${r.conteudo}"`);
          expect(html, `${r.rota}: sem esqueleto do guarda no HTML`).not.toContain('data-testid="auth-guard-carregando"');
        } else {
          expect(html, `${r.rota}: chave off → esqueleto (rollback)`).toContain('data-testid="auth-guard-carregando"');
        }
        // (2)(3) carga fria (página nova, mesmo login), TPCU e hidratação.
        const page = await ctx.newPage();
        const erros = colherErros(page);
        await page.addInitScript(sonda(r.conteudo));
        await page.goto(r.rota, { waitUntil: "domcontentloaded" });
        await expect(page.getByTestId(r.conteudo).first()).toBeAttached({ timeout: 30_000 });
        await page.waitForTimeout(1500); // dá tempo de a hidratação reclamar
        const { tpcu, esqueleto } = await medirTpcu(page);
        linhas.push(`${r.rota} @${largura}: TPCU ${tpcu.toFixed(0)} ms, esqueleto em algum quadro: ${esqueleto}`);
        expect(erros, `${r.rota}: erros de hidratação`).toEqual([]);
        if (PILOTO) {
          expect(esqueleto, `${r.rota}: o esqueleto do guarda não pode aparecer em nenhum quadro`).toBe(false);
          expect(tpcu, `${r.rota}: TPCU`).toBeLessThanOrEqual(LIMITE_TPCU_MS);
        }
        await page.close();
      }
      console.log(linhas.join("\n"));
      await semJs.close();
      await ctx.close();
    });
  }

  test("4. proteção igual à de hoje: sem sessão vai para /auth?redirect=…; morador em /admin recebe 404", async ({ browser }) => {
    const anon = await browser.newContext();
    const p = await anon.newPage();
    for (const r of ROTAS) {
      await p.goto(r.rota, { waitUntil: "domcontentloaded" });
      await expect(p).toHaveURL(/\/auth\?redirect=/);
    }
    await anon.close();
    const ctx = await contextoLogado(browser, outra, 1280);
    const m = await ctx.newPage();
    const resp = await m.goto("/admin", { waitUntil: "domcontentloaded" });
    expect(resp?.status()).toBe(404);
    await ctx.close();
  });

  test("5. troca de conta no mesmo navegador: localStorage de A, cookies de B — o 1º quadro é de B e A nunca aparece", async ({ browser }) => {
    // Com a chave off (rollback) não há sessão do servidor: vale o comportamento de antes (a conferência do cliente troca A por B).
    test.skip(!PILOTO, "só com a chave piloto");
    // A (Alice) entra e deixa o usuário dela gravado no localStorage.
    const ctxA = await contextoLogado(browser, outra, 390);
    const pa = await ctxA.newPage();
    await pa.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    const salvoA = await pa.evaluate(() => localStorage.getItem("vivanomads-auth"));
    expect(salvoA).toContain(outra.nome);
    await ctxA.close();
    // B (Bruno) entra no seu contexto; o localStorage passa a ter o da A (outra conta no mesmo navegador).
    const ctxB = await contextoLogado(browser, dono, 390);
    await ctxB.addInitScript((v) => {
      if (!sessionStorage.getItem("vn-t1608-semeado")) {
        localStorage.setItem("vivanomads-auth", v as string);
        sessionStorage.setItem("vn-t1608-semeado", "1");
      }
    }, salvoA);
    const page = await ctxB.newPage();
    const erros = colherErros(page);
    // A casca mostra o PRIMEIRO nome (saudação, rodapé) ou as iniciais: procura "Alice" (o Bruno não tem esse nome).
    const primeiroNomeA = outra.nome.split(" ")[0];
    // E o avatar da casca (iniciais do nome completo, E788): "AP" é a Alice; o Bruno é "BP".
    await page.addInitScript(sonda("perfil-tela", primeiroNomeA, "AP"));
    const resp = await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    const html = (await resp?.text()) ?? "";
    if (PILOTO) {
      expect(html, "o HTML é de B").toContain(dono.nome.split(" ")[0]);
      expect(html, "o HTML nunca traz A").not.toContain(primeiroNomeA);
    }
    await expect(page.getByTestId("perfil-tela").first()).toBeAttached({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    const proibido = await page.evaluate(() => (window as unknown as { __vn: { proibido: boolean } }).__vn.proibido);
    expect(proibido, "o nome de A apareceu em algum quadro").toBe(false);
    expect(erros).toEqual([]);
    await ctxB.close();
  });

  test("6. token vencido (expires_at no passado): a tela abre com o conteúdo, sem passar por /auth", async ({ browser }) => {
    const ctx = await contextoLogado(browser, dono, 1280);
    await vencerToken(ctx);
    const page = await ctx.newPage();
    const visitadas: string[] = [];
    page.on("framenavigated", (f) => {
      if (f === page.mainFrame()) visitadas.push(f.url());
    });
    const resp = await page.goto("/dashboard/conta/perfil", { waitUntil: "domcontentloaded" });
    const html = (await resp?.text()) ?? "";
    if (PILOTO) {
      expect(html, "o servidor (layout) viu a sessão renovada: conteúdo no HTML").toContain('data-testid="perfil-tela"');
      expect(html).not.toContain('data-testid="auth-guard-carregando"');
    }
    await expect(page.getByTestId("perfil-tela").first()).toBeAttached({ timeout: 30_000 });
    await page.waitForTimeout(1500);
    expect(visitadas.some((u) => /\/auth(\?|$)/.test(new URL(u).pathname + new URL(u).search)), visitadas.join(" → ")).toBe(false);
    await ctx.close();
  });

  test("7. fora do piloto, com a chave ligada: zero erro de hidratação e o HTML de hoje (esqueleto do guarda)", async ({ browser }) => {
    const ctx = await contextoLogado(browser, dono, 1280);
    // Amostra (Apêndice A do desenho): 2 da Onda 3 (servidor) + 2 da Onda 4 (dados no cliente); + 2 do admin abaixo.
    const fora = ["/dashboard/imoveis", "/dashboard/leads", "/dashboard/favoritos", "/dashboard/candidaturas"];
    for (const rota of fora) {
      const page = await ctx.newPage();
      const erros = colherErros(page);
      const resp = await page.goto(rota, { waitUntil: "domcontentloaded" });
      expect(await resp?.text(), `${rota}: HTML de hoje`).toContain('data-testid="auth-guard-carregando"');
      await expect(page.getByTestId("auth-guard-carregando")).toHaveCount(0, { timeout: 30_000 });
      await page.waitForTimeout(1500);
      expect(erros, rota).toEqual([]);
      await page.close();
    }
    await ctx.close();
    // Admin (2 rotas): o mesmo, com 2FA.
    const adm = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const pa = await adm.newPage();
    await entrarAdmin(pa);
    await pa.close();
    for (const rota of ["/admin", "/admin/usuarios"]) {
      const page = await adm.newPage();
      const erros = colherErros(page);
      const resp = await page.goto(rota, { waitUntil: "domcontentloaded" });
      expect(await resp?.text(), `${rota}: HTML de hoje`).toContain('data-testid="auth-guard-carregando"');
      await expect(page.getByTestId("auth-guard-carregando")).toHaveCount(0, { timeout: 30_000 });
      await page.waitForTimeout(1500);
      expect(erros, rota).toEqual([]);
      await page.close();
    }
    await adm.close();
  });

  test("9. o HTML do painel não pode ir para cache compartilhado (leva dados da pessoa)", async ({ browser }) => {
    const ctx = await contextoLogado(browser, dono, 1280);
    for (const r of ROTAS) {
      const resp = await ctx.request.get(r.rota, { maxRedirects: 0 });
      const cc = resp.headers()["cache-control"] ?? "";
      expect(cc, `${r.rota}: Cache-Control`).not.toMatch(/\bpublic\b/);
      expect(cc, `${r.rota}: Cache-Control`).toMatch(/\bprivate\b|\bno-store\b/);
    }
    await ctx.close();
  });
});
