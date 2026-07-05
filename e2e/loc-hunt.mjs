/* 10-way bug hunt: inquilino avalia o proprietário (/dashboard/locacoes, demo). */
import pw from "playwright-core";
const { chromium } = pw;
const BASE = "http://localhost:3211";
const EXEC = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT = "/tmp/claude-0/-home-user-Viva-Nomads-Oficial/28cadf6c-333b-5a9c-9cb9-ca6e2ba22b40/scratchpad";

// Admin owner+tenant so demo mode is available and tenant nav shows.
const AUTH = {
  state: {
    user: { id: "demo-owner", name: "Marcos Andrade", email: "marcos@exemplo.com", role: "admin", fullName: "Marcos Andrade", plan: "gestor", isOwner: true, isTenant: true },
    activeMode: "tenant", authChecked: true, sessionStartedAt: Date.now(),
  },
  version: 0,
};

const bugs = [], oks = [];
const bug = (a, m) => { bugs.push(`[${a}] ${m}`); console.log(`  ✗ BUG [${a}] ${m}`); };
const ok = (a, m) => { oks.push(m); console.log(`  ✓ [${a}] ${m}`); };

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
async function newCtx(vw = 1280, vh = 1000) {
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
  await ctx.addInitScript((a) => { try { localStorage.setItem("vivanomads-auth", JSON.stringify(a)); } catch {} }, AUTH);
  return ctx;
}
const errs = [];
async function openPage(ctx, label) {
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errs.push(`${label}: ${m.text()}`); });
  page.on("pageerror", (e) => errs.push(`${label}: ${e}`));
  return page;
}
const body = async (p) => (await p.textContent("body")) || "";
async function btn(page, re) { const b = page.locator("button, a"); const n = await b.count(); for (let i = 0; i < n; i++) { const t = (await b.nth(i).innerText().catch(() => "")) || ""; if (re.test(t)) return b.nth(i); } return null; }

const ctx = await newCtx();
const page = await openPage(ctx, "loc");

// Navega e espera o modo demo ATIVAR (o ?demo=1 é aplicado por um efeito do
// shell após a hidratação — networkidle sozinho pode chegar antes dos cards).
async function gotoLoc(pg) {
  const r = await pg.goto(`${BASE}/dashboard/locacoes?demo=1`, { waitUntil: "networkidle" });
  await pg.waitForFunction(() => document.body.innerText.includes("Avaliar o proprietário"), { timeout: 8000 }).catch(() => {});
  return r ? r.status() : 0;
}

// 1. Página carrega em modo demo
{
  const s = await gotoLoc(page);
  if (s === 200) ok("1-load", `/dashboard/locacoes?demo=1 (HTTP ${s})`); else bug("1-load", `HTTP ${s}`);
  const b = await body(page);
  if (/Minhas loca[çc][õo]es/.test(b)) ok("1-load", "título 'Minhas locações' visível"); else bug("1-load", "título ausente");
}

// 2. Existem cards de locação (demo) com o CTA de avaliar
{
  const b = await body(page);
  if (/Avaliar o propriet[áa]rio/.test(b)) ok("2-cta", "CTA 'Avaliar o proprietário' presente"); else bug("2-cta", "CTA ausente");
  const cards = await page.locator("h2").count();
  if (cards >= 1) ok("2-cta", `${cards} locação(ões) demo listada(s)`); else bug("2-cta", "nenhum card de locação");
}

// 3. Abrir o formulário revela 5 estrelas + textarea
{
  const open = await btn(page, /Avaliar o propriet[áa]rio/);
  await open?.click(); await page.waitForTimeout(300);
  const stars = await page.locator('[role="radio"]').count();
  if (stars >= 5) ok("3-open", `${stars} estrelas exibidas`); else bug("3-open", `só ${stars} estrelas`);
  const ta = await page.locator("textarea").count();
  if (ta >= 1) ok("3-open", "textarea de comentário presente"); else bug("3-open", "textarea ausente");
}

// 4. Botão Enviar começa desabilitado (sem estrela)
{
  const enviar = await btn(page, /Enviar avalia[çc][ãa]o/);
  const dis = await enviar?.isDisabled();
  if (dis === true) ok("4-guard", "Enviar desabilitado sem nota"); else bug("4-guard", "Enviar habilitado sem nota");
}

// 5. Selecionar 5 estrelas habilita o envio
{
  const star5 = page.locator('[role="radio"]').nth(4);
  await star5.click(); await page.waitForTimeout(150);
  const checked = await star5.getAttribute("aria-checked");
  if (checked === "true") ok("5-star", "5ª estrela marcada (aria-checked)"); else bug("5-star", "estrela não marca");
  const enviar = await btn(page, /Enviar avalia[çc][ãa]o/);
  if ((await enviar?.isDisabled()) === false) ok("5-star", "Enviar habilitado após nota"); else bug("5-star", "Enviar segue desabilitado");
}

// 6. Enviar em demo mostra confirmação de exemplo
{
  await page.locator("textarea").first().fill("Ótima comunicação, imóvel como anunciado.");
  const enviar = await btn(page, /Enviar avalia[çc][ãa]o/);
  await enviar?.click(); await page.waitForTimeout(600);
  const b = await body(page);
  if (/Avalia[çc][ãa]o de exemplo registrada/.test(b)) ok("6-submit", "confirmação demo exibida"); else bug("6-submit", "sem confirmação após enviar");
  await page.screenshot({ path: `${SHOT}/loc-06-enviada.png` });
}

// 7. Cancelar fecha o formulário (em outro card, se houver)
{
  await gotoLoc(page);
  const open = await btn(page, /Avaliar o propriet[áa]rio/);
  await open?.click(); await page.waitForTimeout(250);
  const cancelar = await btn(page, /Cancelar/);
  await cancelar?.click(); await page.waitForTimeout(250);
  const b = await body(page);
  const stillOpen = /Como foi sua experi[êe]ncia/.test(b);
  if (!stillOpen) ok("7-cancel", "Cancelar fecha o formulário"); else bug("7-cancel", "formulário continua aberto após Cancelar");
}

// 8. Item de nav "Minhas locações" aparece no menu do inquilino e navega
{
  await page.goto(`${BASE}/dashboard?demo=1`, { waitUntil: "networkidle" });
  const navLink = await btn(page, /^Minhas loca[çc][õo]es$/);
  if (navLink) ok("8-nav", "item de menu 'Minhas locações' presente"); else bug("8-nav", "item de menu ausente");
}

// 9. Guarda de papel: no modo proprietário a rota redireciona p/ /dashboard
{
  const ownerAuth = JSON.parse(JSON.stringify(AUTH));
  ownerAuth.state.activeMode = "owner";
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.addInitScript((a) => { try { localStorage.setItem("vivanomads-auth", JSON.stringify(a)); } catch {} }, ownerAuth);
  const p2 = await openPage(ctx2, "owner-guard");
  await p2.goto(`${BASE}/dashboard/locacoes`, { waitUntil: "networkidle" });
  await p2.waitForTimeout(600);
  const url = p2.url();
  if (/\/dashboard(\?|$)/.test(url) && !/locacoes/.test(url)) ok("9-guard", "modo proprietário redireciona p/ /dashboard"); else bug("9-guard", `não redirecionou (url=${url})`);
  await ctx2.close();
}

// 10. Mobile: layout e formulário funcionam em 390px
{
  const ctxM = await newCtx(390, 780);
  const pm = await openPage(ctxM, "mobile");
  await gotoLoc(pm);
  const b = await body(pm);
  if (/Minhas loca[çc][õo]es/.test(b)) ok("10-mobile", "título renderiza no mobile"); else bug("10-mobile", "título ausente no mobile");
  const open = await btn(pm, /Avaliar o propriet[áa]rio/);
  await open?.click(); await pm.waitForTimeout(250);
  const stars = await pm.locator('[role="radio"]').count();
  if (stars >= 5) ok("10-mobile", "estrelas acessíveis no mobile"); else bug("10-mobile", "estrelas quebradas no mobile");
  // sem overflow horizontal
  const sw = await pm.evaluate(() => document.documentElement.scrollWidth);
  if (sw <= 390 + 2) ok("10-mobile", `sem overflow horizontal (sw=${sw})`); else bug("10-mobile", `overflow horizontal sw=${sw}`);
  await pm.screenshot({ path: `${SHOT}/loc-10-mobile.png` });
  await ctxM.close();
}

// Erros de console/página
if (errs.length === 0) ok("console", "sem erros de console/página"); else errs.forEach((e) => bug("console", e));

await browser.close();
console.log(`\n=== ${oks.length} OK / ${bugs.length} BUGS ===`);
if (bugs.length) { console.log(bugs.join("\n")); process.exit(1); }
