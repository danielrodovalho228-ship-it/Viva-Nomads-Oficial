/*
  E2E de regressão — testa as implementações principais no app rodando.

  Como usar (dois terminais ou em sequência):
    1) npm run build && npm run start        # sobe a app (porta 3000 por padrão)
    2) E2E_BASE_URL=http://localhost:3000 npm run e2e

  Variáveis:
    E2E_BASE_URL  URL da app já no ar (padrão http://localhost:3000)
    E2E_CHROME    caminho do executável do Chromium (tem fallback p/ o sandbox)

  Roda em MODO DEMONSTRAÇÃO (sem Supabase): valida UI, fluxo, regras e textos —
  não o backend real (persistência/e-mail/PDF). Sai com código !=0 se houver bug.
*/
import pw from "playwright-core";
const { chromium } = pw;

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const EXEC =
  process.env.E2E_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

// Sessão demo (proprietário com os dois papéis) + gate de qualificação liberado.
const AUTH = {
  state: {
    user: { id: "demo-owner", name: "Marcos Andrade", email: "marcos@exemplo.com", role: "owner", fullName: "Marcos Andrade", plan: "gestor", isOwner: true, isTenant: true },
    activeMode: null,
  },
  version: 0,
};

const bugs = [];
const oks = [];
const bug = (a, m) => { bugs.push(`[${a}] ${m}`); console.log(`  ✗ BUG [${a}] ${m}`); };
const ok = (a, m) => { oks.push(m); console.log(`  ✓ [${a}] ${m}`); };

const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const consoleErrors = [];
let cur = "/";
ctx.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`${cur}: ${m.text()}`); });
await ctx.addInitScript((a) => {
  try { localStorage.setItem("vivanomads-auth", JSON.stringify(a)); } catch { /* origem opaca */ }
  try { sessionStorage.setItem("vivanomads-qualification", JSON.stringify({ eligible: true, score: 100, baseBadge: true, tHome: true, tWork: true, tCondo: true })); } catch { /* idem */ }
}, AUTH);
const page = await ctx.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(`${cur}: ${e}`));

async function goto(p) { cur = p; const r = await page.goto(BASE + p, { waitUntil: "networkidle" }); const s = r ? r.status() : 0; if (s >= 400) bug("nav", `${p} -> HTTP ${s}`); return s; }
async function btn(re) { const b = page.locator("button"); const n = await b.count(); for (let i = 0; i < n; i++) { const t = (await b.nth(i).innerText().catch(() => "")) || ""; if (re.test(t)) return b.nth(i); } return null; }
const body = async () => (await page.textContent("body")) || "";

// ───────── A. Páginas carregam ─────────
console.log("\n# A. Páginas carregam");
for (const p of ["/home", "/precos", "/para-proprietarios", "/imoveis/ube-001"]) { const s = await goto(p); if (s < 400) ok("public", `${p} (${s})`); }
for (const p of ["/dashboard", "/dashboard/fechamento", "/dashboard/reembolsos", "/dashboard/imoveis/novo"]) { const s = await goto(p); if (s < 400) ok("dash", `${p} (${s})`); }

// ───────── B. Fechamento: garantia + caução flexível + proteção + serviços ─────────
console.log("\n# B. Fechamento");
await goto("/dashboard/fechamento");
await (await btn(/Iniciar verifica/i))?.click(); await page.waitForTimeout(1400);
await (await btn(/Continuar/))?.click(); await page.waitForTimeout(500);
{
  const b = await body();
  if (/não é locadora, fiadora, garantidora nem executora/.test(b)) ok("garantia", "regra de ouro visível"); else bug("garantia", "regra de ouro ausente");
  if (/Como funciona a sua prote[çc][ãa]o/.test(b)) ok("proteção", "seção 'Como funciona a sua proteção'"); else bug("proteção", "seção de proteção ausente");
  if (/cobre o aluguel, não só danos/.test(b)) ok("proteção", "msg cobertura (vs Airbnb)"); else bug("proteção", "msg de cobertura ausente");
  if (/30 a 180 dias/.test(b)) ok("proteção", "msg prazo 30-180 (vs Quinto Andar)"); else bug("proteção", "msg de prazo ausente");
  if (/nunca fica com a plataforma/.test(b)) ok("proteção", "msg custódia"); else bug("proteção", "msg de custódia ausente");
  if (/90 a 180 dias \(residencial\)/.test(b)) ok("garantia", "linha de trilha (residencial)"); else bug("garantia", "linha de trilha ausente");
}
{
  const cards = page.locator('[role="radio"]'); const n = await cards.count();
  let caucao = null, titulo = null, garChecked = null, garDisabled = null;
  for (let i = 0; i < n; i++) { const t = (await cards.nth(i).innerText().catch(() => "")) || ""; if (/Cau[çc][ãa]o/.test(t)) caucao = cards.nth(i); if (/T[íi]tulo/.test(t)) titulo = cards.nth(i); if (/Garantidor digital/.test(t)) { garChecked = await cards.nth(i).getAttribute("aria-checked"); garDisabled = await cards.nth(i).isDisabled(); } }
  if ((await caucao?.getAttribute("aria-checked")) === "true") ok("garantia", "caução pré-selecionada (padrão)"); else bug("garantia", "caução não pré-selecionada");
  if (garDisabled === true && garChecked === "false") ok("garantia", "garantidor 'em breve' não selecionável"); else bug("garantia", "garantidor selecionável (flag deveria estar off)");
  // Onda 1: o título de capitalização foi APOSENTADO — não aparece mais.
  if (!titulo) ok("garantia", "título aposentado (não aparece)"); else bug("garantia", "título ainda aparece (deveria estar aposentado)");
  await caucao?.click(); await page.waitForTimeout(200);
}
{
  const b = await body();
  if (/Como você quer pagar/.test(b)) ok("caução", "escolha de forma de pagamento"); else bug("caução", "toggle de pagamento ausente");
  if (/O valor é seu — devolvido ao final/.test(b)) ok("caução", "texto de conversão"); else bug("caução", "texto de conversão ausente");
  const parcelado = await btn(/Parcelado no cartão/);
  if (parcelado) { await parcelado.click(); await page.waitForTimeout(200); const b2 = await body(); if (/emissora/.test(b2)) ok("caução", "parcelado -> emissora"); else bug("caução", "destino emissor ausente"); if (/\/mês/.test(b2)) ok("caução", "valor da parcela exibido"); else bug("caução", "valor da parcela ausente"); } else bug("caução", "botão 'Parcelado' ausente");
  await (await btn(/À vista/))?.click(); await page.waitForTimeout(200); const b3 = await body();
  if (/conta vinculada/.test(b3) && /nunca recebe nem ret[ée]m/.test(b3)) ok("caução", "à vista -> conta vinculada + nunca retém"); else bug("caução", "texto de conta vinculada/retenção ausente");
}
await (await btn(/Continuar/))?.click(); await page.waitForTimeout(400);
{
  const b = await body();
  if (/Servi[çc]os adicionais/.test(b)) ok("serviços", "etapa serviços renderiza"); else bug("serviços", "etapa serviços não renderiza");
  if (/não executa o serviço/.test(b)) ok("serviços", "copy 'não executa o serviço'"); else bug("serviços", "copy de não-execução ausente");
  const sb = page.locator("button[aria-pressed]"); const sn = await sb.count(); let allEnabled = sn > 0;
  for (let i = 0; i < sn; i++) if (await sb.nth(i).isDisabled()) allEnabled = false;
  if (sn === 2 && allEnabled) ok("serviços", "2 serviços ativos/selecionáveis"); else bug("serviços", `serviços não ativos (n=${sn})`);
  const cont = await btn(/Continuar/);
  if (cont && !(await cont.isDisabled())) ok("serviços", "serviços opcionais (avança sem marcar)"); else bug("serviços", "serviços bloqueiam o avanço");
}

// ───────── C. Reembolso (documental) ─────────
console.log("\n# C. Reembolso");
await goto("/dashboard/reembolsos"); await page.waitForTimeout(400);
{
  await (await btn(/Registrar vistoria de saída/i))?.click(); await page.waitForTimeout(200);
  if (/registrada e comparada/i.test(await body())) ok("reembolso", "vistoria registrada"); else bug("reembolso", "vistoria não registrou");
  await page.locator('input[placeholder^="Motivo"]').fill("Reparo de parede");
  await page.locator('input[placeholder="Valor"]').fill("300");
  await (await btn(/Adicionar/))?.click(); await page.waitForTimeout(250);
  const b = await body();
  if (/Reparo de parede/.test(b)) ok("reembolso", "desconto na lista"); else bug("reembolso", "desconto não apareceu");
  if (/[−-]\s?R\$\s?300/.test(b)) ok("reembolso", "desconto reflete no total"); else bug("reembolso", "desconto não reflete");
  await (await btn(/Notificar partes e registrar prazo/i))?.click(); await page.waitForTimeout(200);
  if (/Prazo limite de devolução/i.test(await body())) ok("reembolso", "prazo de 30 dias"); else bug("reembolso", "prazo não registrou");
  await (await btn(/Gerar comprovante de reembolso/i))?.click(); await page.waitForTimeout(200);
  const b2 = await body();
  if (/Reembolso registrado/i.test(b2)) ok("reembolso", "status 'reembolso registrado'"); else bug("reembolso", "status não mudou");
  if (/dobro/i.test(b2)) ok("reembolso", "aviso de devolução em dobro"); else bug("reembolso", "aviso de dobro ausente");
  if (/apenas marca o status|não transfere|guarda a prova/i.test(b2)) ok("reembolso", "plataforma não paga/transfere"); else bug("reembolso", "falta ressalva de não-transferência");
}

// ───────── D. Cadastro de imóvel: modalidades aceitas (passo 5) ─────────
console.log("\n# D. Cadastro de imóvel");
await goto("/dashboard/imoveis/novo"); await page.waitForTimeout(400);
{
  for (let i = 0; i < 5; i++) { await (await btn(/Continuar/))?.click(); await page.waitForTimeout(150); }
  const b = await body();
  if (/Garantias que você aceita/.test(b)) ok("cadastro", "seção de garantias aceitas"); else bug("cadastro", "seção de garantias ausente");
  if (/não muda o caminho do dinheiro/.test(b)) ok("cadastro", "aviso de preferência"); else bug("cadastro", "aviso de preferência ausente");
}

// ───────── Relatório ─────────
console.log("\n========================================");
const realConsole = consoleErrors.filter((e) => !/nao-existe|404/.test(e));
console.log(`OK: ${oks.length}  |  BUGS: ${bugs.length}  |  console errors: ${realConsole.length}  |  pageerrors: ${pageErrors.length}`);
bugs.forEach((b) => console.log("  ✗ " + b));
realConsole.forEach((e) => console.log("  ⚠ console: " + e.slice(0, 160)));
pageErrors.forEach((e) => console.log("  ⚠ pageerror: " + e.slice(0, 160)));
await browser.close();

const failed = bugs.length > 0 || pageErrors.length > 0 || realConsole.length > 0;
console.log(failed ? "\nRESULTADO: FALHOU" : "\nRESULTADO: OK");
process.exit(failed ? 1 : 0);
