/*
  Screenshots reais do site (Playwright) para apresentações/decks.
  Isolado — NÃO altera o site. Gera desktop/ e mobile/ em alta resolução.

  Uso:
    npm run screenshots                      # captura produção (vivanomads.com.br)
    BASE_URL=http://localhost:3000 npm run screenshots
  Login (telas do painel/cadastro), opcional — sem credenciais, essas telas são puladas:
    DEMO_EMAIL=... DEMO_SENHA=... npm run screenshots
  Alternativa p/ build de DEMONSTRAÇÃO (sem Supabase), injeta sessão local:
    DEMO_AUTH='{"state":{"user":{...},"activeMode":"owner"},"version":0}' BASE_URL=http://localhost:3000 npm run screenshots

  Browser: usa o Chromium do Playwright. Se PLAYWRIGHT_EXECUTABLE_PATH estiver
  definido, usa esse binário (útil em CI/containers com Chromium pré-instalado).
*/
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = (process.env.BASE_URL || "https://vivanomads.com.br").replace(/\/$/, "");
const OUT = path.resolve("screenshots");
const EXE = process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined;

// Import dinâmico: usa 'playwright' se instalado; senão cai para 'playwright-core'.
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import("playwright-core")); }

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

// [arquivo, rota, opções]. fold=true também gera versão só da dobra (viewport).
const PUBLIC = [
  ["01-home", "/home", { fold: true }],
  ["02-busca", "/buscar"],
  ["03-imovel", "/imoveis/ube-001"],
  ["04-como-funciona", "/como-funciona"],
  ["05-precos", "/precos"],
  ["06-para-proprietarios", "/para-proprietarios"],
  ["07-simulacao", "/simulacao"],
  ["08-sobre", "/sobre"],
];
const GATED = [
  ["10-painel-visao-geral", "/dashboard"],
  ["11-painel-leads", "/dashboard/leads"],
  ["12-painel-mensagens", "/dashboard/mensagens"],
  ["13-painel-carteira", "/dashboard/carteira"],
  ["14-cadastro-imovel", "/dashboard/imoveis/novo"],
];

const log = (...a) => console.log(...a);

async function dismissCookies(page) {
  const sels = ['button:has-text("Aceitar")', 'button:has-text("Aceito")', '[aria-label="Fechar"]', 'button:has-text("OK")'];
  for (const s of sels) {
    try { const el = page.locator(s).first(); if (await el.count() && await el.isVisible()) { await el.click({ timeout: 800 }); break; } } catch {}
  }
}

async function shoot(ctx, kind, name, route, opts = {}) {
  const page = await ctx.newPage();
  const url = BASE_URL + route;
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }));
    if (res && res.status() >= 400) { log(`  [${kind}] ${name} ${route} → HTTP ${res.status()} (pulado)`); await page.close(); return false; }
    await dismissCookies(page);
    await page.waitForTimeout(2200); // fontes/imagens
    // Detecta redirecionamento para /auth (tela protegida sem sessão)
    if (/\/auth(\?|$)/.test(page.url()) && !route.startsWith("/auth")) {
      log(`  [${kind}] ${name} ${route} → exigiu login (pulado)`);
      await page.close(); return false;
    }
    await page.screenshot({ path: path.join(OUT, kind, `${name}.png`), fullPage: true });
    if (opts.fold) await page.screenshot({ path: path.join(OUT, kind, `${name}-dobra.png`), fullPage: false });
    log(`  [${kind}] ${name} ${route} ✓`);
    await page.close(); return true;
  } catch (e) {
    log(`  [${kind}] ${name} ${route} → ERRO: ${String(e.message).split("\n")[0]} (pulado)`);
    await page.close(); return false;
  }
}

async function login(ctx) {
  const email = process.env.DEMO_EMAIL, senha = process.env.DEMO_SENHA;
  if (!email || !senha) return false;
  const page = await ctx.newPage();
  try {
    await page.goto(BASE_URL + "/auth", { waitUntil: "networkidle", timeout: 30000 });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', senha);
    await page.locator('button:has-text("Entrar"), button[type="submit"]').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    log("  login: sessão iniciada ✓");
    await page.close(); return true;
  } catch (e) {
    log(`  login: falhou (${String(e.message).split("\n")[0]}) — telas do painel serão puladas`);
    await page.close(); return false;
  }
}

async function main() {
  log(`Screenshots de ${BASE_URL}`);
  log("Rotas públicas:", PUBLIC.map((p) => p[1]).join(", "));
  log("Rotas com login:", GATED.map((p) => p[1]).join(", "));
  for (const k of Object.keys(VIEWPORTS)) await mkdir(path.join(OUT, k), { recursive: true });

  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  for (const [kind, vp] of Object.entries(VIEWPORTS)) {
    log(`\n== ${kind} (${vp.width}x${vp.height} @2x) ==`);
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, isMobile: kind === "mobile" });
    // Sessão para telas protegidas: injeção (DEMO_AUTH) ou login por formulário.
    if (process.env.DEMO_AUTH) {
      await ctx.addInitScript((a) => { try { localStorage.setItem("vivanomads-auth", a); } catch {} }, process.env.DEMO_AUTH);
    }
    for (const [name, route, opts] of PUBLIC) await shoot(ctx, kind, name, route, opts);
    const logged = process.env.DEMO_AUTH ? true : await login(ctx);
    if (logged) for (const [name, route] of GATED) await shoot(ctx, kind, name, route);
    else log("  (telas do painel puladas — defina DEMO_EMAIL/DEMO_SENHA ou DEMO_AUTH)");
    await ctx.close();
  }

  await browser.close();
  log(`\nPronto. Imagens em: ${OUT}/desktop e ${OUT}/mobile`);
}

main().catch((e) => { console.error(e); process.exit(1); });
