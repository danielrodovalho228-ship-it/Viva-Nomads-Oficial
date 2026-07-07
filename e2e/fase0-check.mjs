/* 10 testes da Fase 0 (integridade da área logada) + banner de Publicar pedido. */
import pw from "playwright-core";
const { chromium } = pw;
const BASE = "http://localhost:3214";
const EXEC = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT = "/tmp/claude-0/-home-user-Viva-Nomads-Oficial/28cadf6c-333b-5a9c-9cb9-ca6e2ba22b40/scratchpad";
const OWNER = { state: { user: { id: "own-1", name: "Marcos", email: "marcos@ex.com", role: "admin", plan: "gestor", isOwner: true, isTenant: true }, activeMode: "owner", authChecked: true, sessionStartedAt: Date.now() }, version: 0 };
const TENANT = JSON.parse(JSON.stringify(OWNER)); TENANT.state.activeMode = "tenant";

const bugs = [], oks = [];
const bug = (a, m) => { bugs.push(`[${a}] ${m}`); console.log(`  ✗ BUG [${a}] ${m}`); };
const ok = (a, m) => { oks.push(m); console.log(`  ✓ [${a}] ${m}`); };
const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
const errs = [];
async function ctxFor(auth, vw=1280, vh=1000){ const c=await browser.newContext({viewport:{width:vw,height:vh}}); if(auth) await c.addInitScript((a)=>{try{localStorage.setItem("vivanomads-auth",JSON.stringify(a));}catch{}},auth); return c; }
async function mk(ctx,t){ const p=await ctx.newPage(); p.on("console",(m)=>{if(m.type()==="error"){const x=m.text(); if(!/favicon|status of 40[34]/.test(x)) errs.push(`${t}: ${x.slice(0,140)}`);}}); p.on("pageerror",(e)=>errs.push(`${t}: ${e}`)); return p; }
const body = async (p)=>(await p.evaluate(()=>document.body.innerText).catch(()=>""))||"";
async function btn(p,re){const b=p.locator("button, a");const n=await b.count();for(let i=0;i<n;i++){const t=(await b.nth(i).innerText().catch(()=>""))||"";if(re.test(t))return b.nth(i);}return null;}
// casca do dashboard presente = existe <aside> com navegação (sidebar) OU botão "Abrir menu" (mobile)
async function temCasca(p){ const aside = await p.locator("aside a").count(); const menu = await p.locator('button[aria-label="Abrir menu"]').count(); return aside > 0 || menu > 0; }
async function navDemo(p, path){ const sep = path.includes("?")?"&":"?"; await p.goto(`${BASE}${path}${sep}demo=1`,{waitUntil:"networkidle",timeout:30000}).catch(()=>{}); await p.waitForTimeout(600); }

// 1. /dashboard/pedidos-cidade abre DENTRO da casca (owner, demo)
{
  const p = await mk(await ctxFor(OWNER), "pc");
  await navDemo(p, "/dashboard/pedidos-cidade");
  if (await temCasca(p)) ok("1-pc", "pedidos-cidade dentro da casca (sidebar)"); else bug("1-pc", "pedidos-cidade abriu solto (sem casca)");
  const b = await body(p);
  if (b.trim().length > 40) ok("1-pc", "conteúdo renderiza"); else bug("1-pc", "página vazia");
  await p.screenshot({ path: `${SHOT}/f0-pedidos-cidade.png` });
}

// 2. Menu do proprietário: "Pedidos de moradia" aponta p/ rota interna
{
  const p = await mk(await ctxFor(OWNER), "menu");
  await navDemo(p, "/dashboard");
  const link = p.locator('aside a', { hasText: "Pedidos de moradia" }).first();
  const href = (await link.count()) ? await link.getAttribute("href") : null;
  if (href === "/dashboard/pedidos-cidade") ok("2-menu", "menu → /dashboard/pedidos-cidade"); else bug("2-menu", `href errado: ${href}`);
}

// 3. Rota antiga /pedidos redireciona p/ a interna
{
  const p = await mk(await ctxFor(OWNER), "redir");
  await p.goto(`${BASE}/pedidos`, { waitUntil: "networkidle" }).catch(()=>{});
  await p.waitForTimeout(500);
  const url = p.url();
  if (/\/dashboard\/pedidos-cidade/.test(url)) ok("3-redir", "/pedidos → /dashboard/pedidos-cidade"); else bug("3-redir", `não redirecionou: ${url.replace(BASE,"")}`);
}

// 4. Guarda de papel: inquilino em /dashboard/pedidos-cidade volta p/ /dashboard
{
  const p = await mk(await ctxFor(TENANT), "guard");
  await navDemo(p, "/dashboard/pedidos-cidade");
  await p.waitForTimeout(500);
  const url = p.url();
  if (/\/dashboard(\?|$)/.test(url) && !/pedidos-cidade/.test(url)) ok("4-guard", "inquilino redirecionado p/ /dashboard"); else bug("4-guard", `inquilino acessou (url=${url.replace(BASE,"")})`);
}

// 5. AUDITORIA 0.2: TODOS os itens do menu do proprietário abrem na casca
{
  const p = await mk(await ctxFor(OWNER), "audit");
  await navDemo(p, "/dashboard");
  const hrefs = await p.$$eval("aside a", (as) => as.map((a) => a.getAttribute("href")).filter(Boolean));
  const uniq = [...new Set(hrefs)];
  let fora = 0;
  for (const h of uniq) {
    await navDemo(p, h);
    const casca = await temCasca(p);
    const b = await body(p);
    if (!casca) { bug("5-audit", `${h} abriu FORA da casca`); fora++; }
    else if (b.trim().length < 30) { bug("5-audit", `${h} vazio`); fora++; }
  }
  if (fora === 0) ok("5-audit", `${uniq.length} itens do menu — todos dentro da casca`);
}

// 6. Fase 0.1: /precos "Ver opções de garantia" → /como-funciona#garantias (NÃO área do proprietário)
{
  const p = await mk(await ctxFor(null), "garantia");
  await p.goto(`${BASE}/precos`, { waitUntil: "networkidle" });
  const links = p.locator('a', { hasText: "Ver opções de garantia" });
  const n = await links.count();
  if (n >= 1) ok("6-gar", `${n} CTA(s) 'Ver opções de garantia'`); else bug("6-gar", "CTA de garantia não encontrado");
  let allOk = true;
  for (let i = 0; i < n; i++) {
    const href = await links.nth(i).getAttribute("href");
    if (href !== "/como-funciona#garantias") { bug("6-gar", `CTA ${i} aponta p/ ${href} (esperado /como-funciona#garantias)`); allOk = false; }
    if (href && /fechamento|para-proprietarios|dashboard/.test(href)) { bug("6-gar", `CTA ${i} leva à área do proprietário: ${href}`); allOk = false; }
  }
  if (allOk && n >= 1) ok("6-gar", "todos os CTAs de garantia levam ao destino do inquilino");
}

// 7. Fase 0.1: /como-funciona#garantias existe e mostra as duas garantias
{
  const p = await mk(await ctxFor(null), "cf");
  await p.goto(`${BASE}/como-funciona#garantias`, { waitUntil: "networkidle" });
  const anchor = await p.locator("#garantias").count();
  if (anchor >= 1) ok("7-cf", "âncora #garantias existe"); else bug("7-cf", "âncora #garantias ausente");
  const b = await body(p);
  if (/Caução/.test(b) && /Seguro-fiança|Seguro-fianca/.test(b)) ok("7-cf", "explica caução + seguro-fiança"); else bug("7-cf", "conteúdo de garantias incompleto");
  if (/em estrutura[çc][ãa]o/.test(b)) ok("7-cf", "status honesto 'em estruturação'"); else bug("7-cf", "status honesto ausente");
}

// 8. Banner novo de /pedidos/novo (hero forest + passos)
{
  const p = await mk(await ctxFor(null), "hero");
  await p.goto(`${BASE}/pedidos/novo`, { waitUntil: "networkidle" });
  const b = await body(p);
  if (/Deixe os im[óo]veis virem at[ée] voc[êe]/.test(b)) ok("8-hero", "título do hero presente"); else bug("8-hero", "título do hero ausente");
  // hero tem fundo escuro (forest) — verifica que a <section> hero existe com bg gradient
  const heroDark = await p.evaluate(() => {
    const secs = [...document.querySelectorAll("section")];
    return secs.some((s) => getComputedStyle(s).backgroundImage.includes("gradient") || getComputedStyle(s).backgroundColor.match(/rgb\(1[0-9], /));
  });
  if (heroDark) ok("8-hero", "banner com fundo/gradiente escuro"); else bug("8-hero", "banner sem fundo destacado");
  if (/Você publica/.test(b) && /Proprietários respondem/.test(b)) ok("8-hero", "3 passos no banner"); else bug("8-hero", "passos ausentes");
  await p.screenshot({ path: `${SHOT}/f0-pedido-hero.png`, fullPage: true });
}

// 9. Mobile: hero de /pedidos/novo sem overflow horizontal
{
  const p = await mk(await ctxFor(null, 390, 800), "mob");
  await p.goto(`${BASE}/pedidos/novo`, { waitUntil: "networkidle" });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  if (sw <= 393) ok("9-mob", `sem overflow (sw=${sw})`); else bug("9-mob", `overflow sw=${sw}`);
  await p.screenshot({ path: `${SHOT}/f0-pedido-mobile.png` });
}

// 10. Sanidade: páginas públicas-chave seguem 200 + sem erro de console
{
  const p = await mk(await ctxFor(null), "sane");
  for (const path of ["/precos", "/como-funciona", "/pedidos/novo", "/home"]) {
    const r = await p.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const s = r ? r.status() : 0;
    if (s === 200) ok("10-sane", `${path} (200)`); else bug("10-sane", `${path} → ${s}`);
  }
}

if (errs.length === 0) ok("console", "sem erros de console/página"); else errs.slice(0,12).forEach((e)=>bug("console", e));
await browser.close();
console.log(`\n=== ${oks.length} OK / ${bugs.length} BUGS ===`);
if (bugs.length) { console.log(bugs.join("\n")); process.exit(1); }
console.log("✅ TUDO VERDE");
