/* Valida os 3 ajustes: reserva em demo/próprio, nav "Publicar pedido", página pública. */
import pw from "playwright-core";
const { chromium } = pw;
const BASE = "http://localhost:3213";
const EXEC = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT = "/tmp/claude-0/-home-user-Viva-Nomads-Oficial/28cadf6c-333b-5a9c-9cb9-ca6e2ba22b40/scratchpad";
const AUTH = { state: { user: { id: "u-abc", name: "Inquilino Teste", email: "inq@ex.com", role: "tenant", isTenant: true }, activeMode: "tenant", authChecked: true, sessionStartedAt: Date.now() }, version: 0 };

const bugs = [], oks = [];
const bug = (a, m) => { bugs.push(`[${a}] ${m}`); console.log(`  ✗ BUG [${a}] ${m}`); };
const ok = (a, m) => { oks.push(m); console.log(`  ✓ [${a}] ${m}`); };
const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
const errs = [];
async function ctxFor(auth, vw=1280, vh=1000){ const c = await browser.newContext({viewport:{width:vw,height:vh}}); if(auth) await c.addInitScript((a)=>{try{localStorage.setItem("vivanomads-auth",JSON.stringify(a));}catch{}},auth); return c; }
async function mk(ctx,t){ const p=await ctx.newPage(); p.on("console",(m)=>{if(m.type()==="error"){const x=m.text(); if(!/favicon|status of 40[34]/.test(x)) errs.push(`${t}: ${x.slice(0,140)}`);}}); p.on("pageerror",(e)=>errs.push(`${t}: ${e}`)); return p; }
const body = async (p)=>(await p.evaluate(()=>document.body.innerText).catch(()=>""))||"";
async function btn(p,re){const b=p.locator("button, a");const n=await b.count();for(let i=0;i<n;i++){const t=(await b.nth(i).innerText().catch(()=>""))||"";if(re.test(t))return b.nth(i);}return null;}

// 1. Nav pública tem "Publicar pedido"
{
  const p = await mk(await ctxFor(null), "nav");
  await p.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  const link = await btn(p, /^Publicar pedido$/);
  if (link) ok("1-nav", "'Publicar pedido' no topo"); else bug("1-nav", "item de nav ausente");
  const href = link ? await link.getAttribute("href") : null;
  if (href === "/pedidos/novo") ok("1-nav", "aponta p/ /pedidos/novo"); else bug("1-nav", `href errado: ${href}`);
}

// 2. /pedidos/novo é PÚBLICO (deslogado) com header profissional + banner
{
  const p = await mk(await ctxFor(null), "pub");
  const r = await p.goto(`${BASE}/pedidos/novo`, { waitUntil: "networkidle" });
  const s = r ? r.status() : 0;
  const url = p.url();
  if (s === 200 && /\/pedidos\/novo/.test(url)) ok("2-pub", `acessível deslogado (${s})`); else bug("2-pub", `bloqueou/redirect: ${s} url=${url.replace(BASE,"")}`);
  const b = await body(p);
  if (/Deixe os im[óo]veis virem at[ée] voc[êe]/.test(b)) ok("2-pub", "header profissional novo"); else bug("2-pub", "header antigo/ausente");
  if (/Proprietários respondem/.test(b)) ok("2-pub", "passos 'como funciona' presentes"); else bug("2-pub", "passos ausentes");
  if (/pedimos um login/.test(b)) ok("2-pub", "banner de login (deslogado)"); else bug("2-pub", "banner de login ausente");
  // Deslogado NÃO mostra 'Ver meus pedidos'
  if (!/Ver meus pedidos/.test(b)) ok("2-pub", "'Ver meus pedidos' oculto p/ deslogado"); else bug("2-pub", "'Ver meus pedidos' visível deslogado");
  await p.screenshot({ path: `${SHOT}/fix-pedido-novo.png`, fullPage: true });
}

// 3. Submeter deslogado → vai p/ login com redirect
{
  const p = await mk(await ctxFor(null), "sub");
  await p.goto(`${BASE}/pedidos/novo`, { waitUntil: "networkidle" });
  await p.locator('input[placeholder="Uberlândia"]').fill("Uberlândia");
  await p.locator('input[type="date"]').fill("2026-09-01");
  await p.locator('input[placeholder="3500"]').fill("3000");
  const publicar = p.locator('form button[type="submit"]').first();
  await publicar.click(); await p.waitForTimeout(800);
  const url = p.url();
  if (/\/auth\?redirect=%2Fpedidos%2Fnovo|\/auth\?redirect=\/pedidos\/novo/.test(url)) ok("3-sub", "deslogado → /auth?redirect=/pedidos/novo"); else bug("3-sub", `não foi ao login: ${url.replace(BASE,"")}`);
}

// 4. Reserva em ANÚNCIO DEMO (ube-001), logado → nota "demonstração", sem botão quebrado
{
  const p = await mk(await ctxFor(AUTH), "demo-resv");
  await p.goto(`${BASE}/imoveis/ube-001`, { waitUntil: "networkidle" });
  // seleciona entrada+saída (2 dias disponíveis quaisquer)
  const dias = p.locator('button[aria-label*="de "]:not([disabled])');
  const n = await dias.count();
  if (n >= 2) {
    await dias.nth(0).click(); await p.waitForTimeout(150);
    await dias.nth(Math.min(n-1, 40)).click(); await p.waitForTimeout(200);
  }
  const b = await body(p);
  if (/Anúncio de demonstração/.test(b)) ok("4-demo", "nota 'anúncio de demonstração' exibida"); else bug("4-demo", "nota de demo ausente");
  // O botão 'Solicitar reserva' NÃO deve aparecer para o anúncio demo
  const solic = await btn(p, /^Solicitar reserva$/);
  if (!solic) ok("4-demo", "sem botão 'Solicitar reserva' quebrado no demo"); else bug("4-demo", "botão de reserva ainda aparece no demo");
  await p.screenshot({ path: `${SHOT}/fix-demo-reserva.png` });
}

// 5. Nav mobile mostra 'Publicar pedido'
{
  const p = await mk(await ctxFor(null, 390, 780), "mob-nav");
  await p.goto(`${BASE}/home`, { waitUntil: "networkidle" });
  const menu = await btn(p, /Abrir menu/) || p.locator('button[aria-label="Abrir menu"]').first();
  await menu?.click().catch(()=>{}); await p.waitForTimeout(300);
  const b = await body(p);
  if (/Publicar pedido/.test(b)) ok("5-mob", "'Publicar pedido' no menu mobile"); else bug("5-mob", "ausente no menu mobile");
}

if (errs.length === 0) ok("console", "sem erros de console/página"); else errs.slice(0,10).forEach((e)=>bug("console", e));
await browser.close();
console.log(`\n=== ${oks.length} OK / ${bugs.length} BUGS ===`);
if (bugs.length) { console.log(bugs.join("\n")); process.exit(1); }
console.log("✅ TUDO VERDE");
