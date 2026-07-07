/* Varredura completa do site — 10 frentes, modo demonstração + logado-out.
   Rodar com o app no ar (next start). Sai !=0 se houver BUG. */
import pw from "playwright-core";
const { chromium } = pw;
const BASE = process.env.QA_BASE || "http://localhost:3212";
const EXEC = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT = "/tmp/claude-0/-home-user-Viva-Nomads-Oficial/28cadf6c-333b-5a9c-9cb9-ca6e2ba22b40/scratchpad";

const AUTH = { state: { user: { id: "demo-owner", name: "Marcos Andrade", email: "marcos@exemplo.com", role: "admin", plan: "gestor", isOwner: true, isTenant: true }, activeMode: "owner", authChecked: true, sessionStartedAt: Date.now() }, version: 0 };

const bugs = [], warns = [], oks = [];
const bug = (a, m) => { bugs.push(`[${a}] ${m}`); console.log(`  ✗ BUG  [${a}] ${m}`); };
const warn = (a, m) => { warns.push(`[${a}] ${m}`); console.log(`  ⚠ WARN [${a}] ${m}`); };
const ok = (a, m) => { oks.push(m); console.log(`  ✓ [${a}] ${m}`); };

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
const perr = [];
async function ctxFor(auth, vw = 1280, vh = 1000) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
  if (auth) await ctx.addInitScript((a) => { try { localStorage.setItem("vivanomads-auth", JSON.stringify(a)); } catch {} }, auth);
  return ctx;
}
let cur = "/";
function wire(page, tag) {
  page.on("console", (m) => { if (m.type() === "error") { const t = m.text(); if (!/favicon|Failed to load resource: the server responded with a status of 40[34]/.test(t)) perr.push(`${tag} ${cur}: ${t.slice(0, 160)}`); } });
  page.on("pageerror", (e) => perr.push(`${tag} ${cur}: PAGEERROR ${String(e).slice(0, 160)}`));
}
// texto VISÍVEL (innerText) — NÃO inclui o payload RSC dos <script>, que contém
// "null"/"NaN" válidos do JSON e geraria falso-positivo.
const body = async (p) => (await p.evaluate(() => document.body.innerText).catch(() => "")) || "";
async function nav(page, path, wait = "networkidle") {
  cur = path;
  const r = await page.goto(BASE + path, { waitUntil: wait, timeout: 30000 }).catch((e) => ({ err: e }));
  if (r && r.err) { bug("nav", `${path} — erro de navegação ${String(r.err).slice(0, 80)}`); return 0; }
  return r ? r.status() : 0;
}
const BADTOK = /\bundefined\b|\bNaN\b|\[object Object\]|Lorem ipsum|\bTODO\b|\bFIXME\b|\bnull\b|R\$\s*NaN|R\$\s*undefined/;

// ───────────────────────── 1. Páginas públicas carregam ─────────────────────────
console.log("\n# 1. Páginas públicas (logado-out)");
const PUBLIC = ["/", "/home", "/como-funciona", "/precos", "/para-proprietarios", "/modelodenegocio", "/roi", "/simulacao", "/socios", "/decisao", "/termos", "/privacidade", "/buscar", "/imoveis/ube-001", "/cidades/uberlandia", "/pedidos", "/auth"];
{
  const ctx = await ctxFor(null); const page = await ctx.newPage(); wire(page, "pub");
  for (const p of PUBLIC) {
    const s = await nav(page, p);
    if (s >= 400 || s === 0) bug("1-pub", `${p} → HTTP ${s}`);
    else { const b = await body(page); if (b.trim().length < 40) bug("1-pub", `${p} praticamente vazio`); else ok("1-pub", `${p} (${s})`); }
  }
  await ctx.close();
}

// ───────────────────────── 2. Links (sem quebrados / vazios) ─────────────────────────
console.log("\n# 2. Links internos (quebrados/vazios)");
{
  const ctx = await ctxFor(null); const page = await ctx.newPage(); wire(page, "link");
  const seen = new Set(); const internal = new Set();
  for (const p of ["/home", "/como-funciona", "/precos", "/para-proprietarios", "/buscar", "/imoveis/ube-001", "/pedidos"]) {
    await nav(page, p);
    const hrefs = await page.$$eval("a", (as) => as.map((a) => ({ href: a.getAttribute("href"), text: (a.textContent || "").trim().slice(0, 30) })));
    for (const { href, text } of hrefs) {
      if (href == null) { if (!(text === "")) warn("2-link", `${p}: <a> sem href ("${text}")`); continue; }
      if (href === "" || href === "#" || href === "undefined" || href === "null") { bug("2-link", `${p}: href inválido "${href}" ("${text}")`); continue; }
      if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) continue;
      if (href.startsWith("/")) internal.add(href.split("#")[0]);
    }
  }
  // Testa cada link interno único (GET) — 404/500 = bug.
  for (const href of internal) {
    if (seen.has(href)) continue; seen.add(href);
    const s = await nav(page, href).catch(() => 0);
    if (s >= 400 || s === 0) bug("2-link", `link interno ${href} → HTTP ${s}`);
  }
  ok("2-link", `${internal.size} links internos únicos verificados`);
  await ctx.close();
}

// ───────────────────────── 3. Textos claros / sem placeholder ─────────────────────────
console.log("\n# 3. Clareza dos textos (sem placeholders/NaN)");
{
  const ctx = await ctxFor(null); const page = await ctx.newPage(); wire(page, "txt");
  for (const p of ["/home", "/como-funciona", "/precos", "/para-proprietarios", "/roi", "/simulacao", "/imoveis/ube-001", "/buscar"]) {
    await nav(page, p);
    const b = await body(page);
    const m = b.match(BADTOK);
    if (m) bug("3-txt", `${p}: token suspeito "${m[0]}"`);
    // Headings vazios
    const emptyH = await page.$$eval("h1,h2,h3", (hs) => hs.filter((h) => !(h.textContent || "").trim()).length);
    if (emptyH > 0) warn("3-txt", `${p}: ${emptyH} heading(s) vazio(s)`);
    else if (!m) ok("3-txt", `${p} sem placeholders`);
  }
  await ctx.close();
}

// ───────────────────────── 4. Login (/auth) ─────────────────────────
console.log("\n# 4. Login /auth");
{
  const ctx = await ctxFor(null); const page = await ctx.newPage(); wire(page, "auth");
  await nav(page, "/auth");
  const email = await page.locator('input[type="email"], input[name="email"]').count();
  const pass = await page.locator('input[type="password"]').count();
  const submit = await page.locator('button[type="submit"], button:has-text("Entrar"), button:has-text("Acessar")').count();
  if (email >= 1) ok("4-auth", "campo de e-mail presente"); else bug("4-auth", "sem campo de e-mail");
  if (pass >= 1) ok("4-auth", "campo de senha presente"); else bug("4-auth", "sem campo de senha");
  if (submit >= 1) ok("4-auth", "botão de envio presente"); else bug("4-auth", "sem botão de envio");
  const b = await body(page);
  if (/cadastr|criar conta|Cadastre|nova conta|Registr/i.test(b)) ok("4-auth", "CTA de cadastro presente"); else warn("4-auth", "sem CTA de cadastro visível");
  await page.screenshot({ path: `${SHOT}/qa-auth.png` });
  await ctx.close();
}

// ───────────────────────── 5. Guarda de rota (logado-out → /auth) ─────────────────────────
console.log("\n# 5. Guarda de rota (logado-out)");
{
  const ctx = await ctxFor(null); const page = await ctx.newPage(); wire(page, "guard");
  // Rotas protegidas via AuthGuard (cliente) — funcionam mesmo sem Supabase local.
  for (const p of ["/dashboard", "/qualificar", "/admin"]) {
    await nav(page, p); await page.waitForTimeout(500);
    const url = page.url();
    if (/\/auth/.test(url)) ok("5-guard", `${p} → redireciona p/ /auth`);
    else bug("5-guard", `${p} NÃO protegido (url=${url.replace(BASE, "")})`);
  }
  // /pedidos/novo é PÚBLICO de propósito (o inquilino vê o formulário sem logar;
  // o login é pedido só ao PUBLICAR). O mural /pedidos e demais /pedidos/* seguem
  // protegidos pelo proxy em produção.
  await nav(page, "/pedidos/novo"); await page.waitForTimeout(300);
  if (/\/pedidos\/novo/.test(page.url())) ok("5-guard", "/pedidos/novo público (form visível sem login)");
  else warn("5-guard", `/pedidos/novo redirecionou inesperadamente (${page.url().replace(BASE, "")})`);
  await ctx.close();
}

// ───────── helper: navegação demo (ativa ?demo=1 após hidratação) ─────────
async function navDemo(page, path, anchor) {
  cur = path;
  const sep = path.includes("?") ? "&" : "?";
  await page.goto(`${BASE}${path}${sep}demo=1`, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
  if (anchor) await page.waitForFunction((a) => document.body.innerText.includes(a), anchor, { timeout: 6000 }).catch(() => {});
  else await page.waitForTimeout(400);
}

// ───────────────────────── 6. Dashboard PROPRIETÁRIO (demo) ─────────────────────────
console.log("\n# 6. Dashboard proprietário (demo)");
const OWNER = ["/dashboard", "/qualificar", "/dashboard/imoveis", "/pedidos", "/dashboard/carteira", "/dashboard/viabilidade", "/dashboard/leads", "/dashboard/orcamentos", "/dashboard/fechamento", "/dashboard/contratos", "/dashboard/ferramentas", "/dashboard/reembolsos", "/dashboard/solicitacoes", "/dashboard/mensagens", "/dashboard/indicacoes", "/dashboard/assinatura", "/dashboard/conta", "/dashboard/imoveis/novo"];
{
  const ctx = await ctxFor(AUTH); const page = await ctx.newPage(); wire(page, "owner");
  for (const p of OWNER) {
    await navDemo(page, p);
    const s = 200; // navDemoto não retorna status; valida por conteúdo
    const b = await body(page);
    if (b.trim().length < 40) bug("6-owner", `${p} praticamente vazio`);
    else if (BADTOK.test(b)) bug("6-owner", `${p}: token suspeito "${b.match(BADTOK)[0]}"`);
    else ok("6-owner", `${p}`);
  }
  await page.screenshot({ path: `${SHOT}/qa-owner-dash.png` });
  await ctx.close();
}

// ───────────────────────── 7. Dashboard INQUILINO (demo) ─────────────────────────
console.log("\n# 7. Dashboard inquilino (demo)");
const TENANT_AUTH = JSON.parse(JSON.stringify(AUTH)); TENANT_AUTH.state.activeMode = "tenant";
const TENANT = ["/dashboard", "/dashboard/verificacao", "/dashboard/pedidos", "/dashboard/favoritos", "/dashboard/comparar", "/dashboard/locacoes", "/dashboard/solicitacoes", "/dashboard/buscas", "/dashboard/mensagens", "/dashboard/indicacoes", "/dashboard/conta"];
{
  const ctx = await ctxFor(TENANT_AUTH); const page = await ctx.newPage(); wire(page, "tenant");
  for (const p of TENANT) {
    await navDemo(page, p);
    const b = await body(page);
    if (b.trim().length < 40) bug("7-tenant", `${p} praticamente vazio`);
    else if (BADTOK.test(b)) bug("7-tenant", `${p}: token suspeito "${b.match(BADTOK)[0]}"`);
    else ok("7-tenant", `${p}`);
  }
  await page.screenshot({ path: `${SHOT}/qa-tenant-dash.png` });
  await ctx.close();
}

// ───────────────────────── 8. Busca + detalhe (fluxo) ─────────────────────────
console.log("\n# 8. Busca + detalhe do imóvel");
{
  const ctx = await ctxFor(null); const page = await ctx.newPage(); wire(page, "busca");
  await nav(page, "/buscar");
  const cards = await page.locator('a[href^="/imoveis/"]').count();
  if (cards >= 1) ok("8-busca", `${cards} card(s) de imóvel na busca`); else warn("8-busca", "nenhum card na busca (pode depender de dados)");
  await nav(page, "/imoveis/ube-001");
  const b = await body(page);
  if (/R\$\s?\d/.test(b)) ok("8-detalhe", "preço visível no detalhe"); else bug("8-detalhe", "sem preço no detalhe");
  if (/dispon|calend[áa]rio|reserv/i.test(b)) ok("8-detalhe", "bloco de disponibilidade/reserva presente"); else warn("8-detalhe", "sem bloco de disponibilidade evidente");
  if (/contat|mensagem|falar|solicit|reserv/i.test(b)) ok("8-detalhe", "CTA de contato/reserva presente"); else bug("8-detalhe", "sem CTA de contato/reserva");
  await page.screenshot({ path: `${SHOT}/qa-detalhe.png`, fullPage: true });
  await ctx.close();
}

// ───────────────────────── 9. Botões / CTAs (texto + visíveis) ─────────────────────────
console.log("\n# 9. Botões/CTAs bem formados");
{
  const ctx = await ctxFor(null); const page = await ctx.newPage(); wire(page, "btn");
  for (const p of ["/home", "/precos", "/imoveis/ube-001", "/para-proprietarios"]) {
    await nav(page, p);
    // Botões visíveis sem rótulo acessível
    const bad = await page.$$eval("button", (bs) => bs.filter((b) => {
      const r = b.getBoundingClientRect(); const vis = r.width > 0 && r.height > 0;
      const label = (b.textContent || "").trim() || b.getAttribute("aria-label") || b.querySelector("svg,img") ? (b.textContent || "").trim() || b.getAttribute("aria-label") : "";
      return vis && !label && !b.querySelector("svg,img");
    }).length);
    if (bad > 0) bug("9-btn", `${p}: ${bad} botão(ões) visível(is) sem rótulo`); else ok("9-btn", `${p}: botões rotulados`);
    // CTA primário dentro da viewport (não clipado à direita)
    const clipped = await page.$$eval("a,button", (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left < 0 - 4; }).length);
    if (clipped > 0) warn("9-btn", `${p}: ${clipped} elemento(s) clicável(is) fora à esquerda`);
  }
  await ctx.close();
}

// ───────────────────────── 10. Responsivo mobile (390px) ─────────────────────────
console.log("\n# 10. Mobile 390px (sem overflow)");
{
  const ctx = await ctxFor(AUTH, 390, 780); const page = await ctx.newPage(); wire(page, "mob");
  const MOB = ["/home", "/como-funciona", "/precos", "/buscar", "/imoveis/ube-001", "/auth", "/pedidos"];
  for (const p of MOB) {
    await nav(page, p);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw <= 390 + 3) ok("10-mob", `${p} sem overflow (sw=${sw})`); else bug("10-mob", `${p} OVERFLOW horizontal sw=${sw}`);
  }
  // Dashboard mobile + menu hambúrguer
  await navDemo(page, "/dashboard");
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  if (sw <= 390 + 3) ok("10-mob", `/dashboard sem overflow (sw=${sw})`); else bug("10-mob", `/dashboard OVERFLOW sw=${sw}`);
  const menuBtn = page.locator('button[aria-label="Abrir menu"]');
  if (await menuBtn.count()) { await menuBtn.first().click(); await page.waitForTimeout(300); const navVis = await page.locator('aside a').count(); if (navVis > 0) ok("10-mob", "menu mobile abre com itens"); else bug("10-mob", "menu mobile não abre"); }
  await page.screenshot({ path: `${SHOT}/qa-mobile-home.png` });
  await ctx.close();
}

// ───────────────────────── Erros de console/página ─────────────────────────
console.log("\n# Erros de console/página agregados");
if (perr.length === 0) ok("console", "sem erros de console/página"); else perr.slice(0, 25).forEach((e) => bug("console", e));

await browser.close();
console.log(`\n================ RESUMO ================`);
console.log(`OK: ${oks.length}   WARN: ${warns.length}   BUGS: ${bugs.length}`);
if (warns.length) { console.log(`\n--- WARNINGS ---`); console.log(warns.join("\n")); }
if (bugs.length) { console.log(`\n--- BUGS ---`); console.log(bugs.join("\n")); process.exit(1); }
console.log("\n✅ TUDO VERDE");
