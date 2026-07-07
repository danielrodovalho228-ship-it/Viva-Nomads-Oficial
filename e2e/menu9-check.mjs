/* 10 testes: menu final de 9 itens, rotas vivas, admin gating, selo NF off. */
import pw from "playwright-core";
const { chromium } = pw;
const BASE = "http://localhost:3215";
const EXEC = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT = "/tmp/claude-0/-home-user-Viva-Nomads-Oficial/28cadf6c-333b-5a9c-9cb9-ca6e2ba22b40/scratchpad";
const mkAuth = (role, mode="owner") => ({ state: { user: { id: "u1", name: "Marcos", email: "m@ex.com", role, plan: "gestor", isOwner: true, isTenant: true }, activeMode: mode, authChecked: true, sessionStartedAt: Date.now() }, version: 0 });
const OWNER = mkAuth("owner"); const ADMIN = mkAuth("admin"); const TENANT = mkAuth("tenant","tenant");

const bugs = [], oks = [];
const bug = (a, m) => { bugs.push(`[${a}] ${m}`); console.log(`  ✗ BUG [${a}] ${m}`); };
const ok = (a, m) => { oks.push(m); console.log(`  ✓ [${a}] ${m}`); };
const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
const errs = [];
async function ctxFor(auth, vw=1280, vh=1000){ const c=await browser.newContext({viewport:{width:vw,height:vh}}); await c.addInitScript((a)=>{try{localStorage.setItem("vivanomads-auth",JSON.stringify(a));}catch{}},auth); return c; }
async function mk(ctx,t){ const p=await ctx.newPage(); p.on("console",(m)=>{if(m.type()==="error"){const x=m.text(); if(!/favicon|status of 40[34]/.test(x)) errs.push(`${t}: ${x.slice(0,140)}`);}}); p.on("pageerror",(e)=>errs.push(`${t}: ${e}`)); return p; }
const body = async (p)=>(await p.evaluate(()=>document.body.innerText).catch(()=>""))||"";
// só os links de NAVEGAÇÃO (exclui o logo do topo e o botão Sair); dedup p/ mobile (2 asides no DOM)
async function sidebarLabels(p){ const raw = await p.$$eval("aside nav a", (as)=>as.map(a=>(a.textContent||"").trim()).filter(Boolean)); return [...new Set(raw)]; }
async function temCasca(p){ return (await p.locator("aside a").count())>0 || (await p.locator('button[aria-label="Abrir menu"]').count())>0; }

const MENU9 = ["Visão geral","Meus imóveis","Pedidos de moradia","Mensagens","Fechamento","Contratos & blocos","Ferramentas","Assinatura","Conta"];
const REMOVIDOS = ["Carteira","Viabilidade","Leads","Orçamentos","Reembolsos","Solicitações","Qualificar imóvel","Indicações"];

// 1. Owner (não-admin): EXATAMENTE os 9 itens, nessa ordem
{
  const p = await mk(await ctxFor(OWNER), "owner9");
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const labels = await sidebarLabels(p);
  const eq = labels.length === 9 && MENU9.every((l, i) => labels[i] === l);
  if (eq) ok("1-menu", `9 itens na ordem certa`); else bug("1-menu", `menu = [${labels.join(" | ")}]`);
  await p.screenshot({ path: `${SHOT}/menu9-owner.png` });
}

// 2. Itens removidos NÃO aparecem no menu
{
  const p = await mk(await ctxFor(OWNER), "rem");
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const labels = await sidebarLabels(p);
  const vazou = REMOVIDOS.filter((r) => labels.includes(r));
  if (vazou.length === 0) ok("2-rem", "nenhum item removido aparece"); else bug("2-rem", `ainda no menu: ${vazou.join(", ")}`);
}

// 3. Admin: vê grupo Admin + Moderar pedidos (9 + 2)
{
  const p = await mk(await ctxFor(ADMIN), "admin");
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const labels = await sidebarLabels(p);
  if (labels.includes("Admin") && labels.includes("Moderar pedidos")) ok("3-admin", "admin vê grupo Admin"); else bug("3-admin", `admin sem grupo: [${labels.join("|")}]`);
}

// 4. Não-admin: 'Admin' NÃO existe no DOM
{
  const p = await mk(await ctxFor(OWNER), "noadmin");
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const html = await p.content();
  if (!/>\s*Admin\s*</.test(html) && !(await sidebarLabels(p)).includes("Admin")) ok("4-noadmin", "'Admin' ausente do DOM p/ não-admin"); else bug("4-noadmin", "'Admin' presente no DOM");
}

// 5. Rotas removidas do menu SEGUEM VIVAS e dentro da casca (não 404)
{
  const p = await mk(await ctxFor(OWNER), "alive");
  for (const rota of ["/dashboard/carteira","/dashboard/viabilidade","/dashboard/leads","/dashboard/orcamentos","/dashboard/reembolsos","/dashboard/solicitacoes"]) {
    const r = await p.goto(`${BASE}${rota}`, { waitUntil: "networkidle" });
    const s = r ? r.status() : 0;
    const casca = await temCasca(p);
    if (s === 200 && casca) ok("5-alive", `${rota} viva + na casca`); else bug("5-alive", `${rota} → HTTP ${s} casca=${casca}`);
  }
}

// 6. Qualificar continua alcançável via Meus imóveis
{
  const p = await mk(await ctxFor(OWNER), "qual");
  await p.goto(`${BASE}/dashboard/imoveis`, { waitUntil: "networkidle" });
  const link = p.locator('a[href="/qualificar"]');
  if (await link.count() > 0) ok("6-qual", "CTA 'Qualificar' presente em Meus imóveis"); else bug("6-qual", "sem CTA de qualificar");
}

// 7. Selo 'Emite Nota Fiscal' NÃO aparece na UI pública (flag off), mesmo com issuesInvoice=true
{
  const p = await mk(await ctxFor(OWNER), "nf");
  await p.goto(`${BASE}/imoveis/ube-001`, { waitUntil: "networkidle" });
  const b = await body(p);
  if (!/Emite Nota Fiscal/.test(b)) ok("7-nf", "selo NF oculto no detalhe (ube-001)"); else bug("7-nf", "selo NF ainda visível");
  await p.goto(`${BASE}/buscar`, { waitUntil: "networkidle" });
  const b2 = await body(p);
  if (!/Emite Nota Fiscal/.test(b2)) ok("7-nf", "selo NF oculto na busca"); else bug("7-nf", "selo NF visível na busca");
}

// 8. Ferramentas: cards de Viabilidade/Orçamento/Manutenção linkam p/ as rotas (fonte única)
{
  const p = await mk(await ctxFor(OWNER), "ferr");
  await p.goto(`${BASE}/dashboard/ferramentas`, { waitUntil: "networkidle" });
  const hrefs = await p.$$eval("main a", (as)=>as.map(a=>a.getAttribute("href")));
  const tem = (h) => hrefs.includes(h);
  if (tem("/dashboard/viabilidade") && tem("/dashboard/orcamentos") && tem("/dashboard/solicitacoes")) ok("8-ferr", "Ferramentas linka viabilidade/orçamentos/solicitações"); else bug("8-ferr", `faltam links no hub: ${hrefs.filter(Boolean).join(",")}`);
}

// 9. Menu do inquilino: Indicações oculto (flag PROGRAMA_INDICACAO off)
{
  const p = await mk(await ctxFor(TENANT), "tnav");
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  const labels = await sidebarLabels(p);
  if (!labels.includes("Indicações")) ok("9-tnav", "Indicações oculto p/ inquilino (flag off)"); else bug("9-tnav", "Indicações ainda visível");
}

// 10. Mobile: menu do proprietário abre com os 9 itens
{
  const p = await mk(await ctxFor(OWNER, 390, 800), "mob");
  await p.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await p.locator('button[aria-label="Abrir menu"]').first().click().catch(()=>{});
  await p.waitForTimeout(300);
  const labels = await sidebarLabels(p);
  if (labels.length === 9 && MENU9.every((l)=>labels.includes(l))) ok("10-mob", "9 itens no menu mobile"); else bug("10-mob", `mobile = [${labels.join("|")}]`);
}

if (errs.length === 0) ok("console", "sem erros de console/página"); else errs.slice(0,12).forEach((e)=>bug("console", e));
await browser.close();
console.log(`\n=== ${oks.length} OK / ${bugs.length} BUGS ===`);
if (bugs.length) { console.log(bugs.join("\n")); process.exit(1); }
console.log("✅ TUDO VERDE");
