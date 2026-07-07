/* Roteiro de teste 05/07 — Suites A–G automatizadas (o que dá sem Supabase real). */
import pw from "playwright-core";
const { chromium } = pw;
const BASE = "http://localhost:3217";
const EXEC = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const SHOT = "/tmp/claude-0/-home-user-Viva-Nomads-Oficial/28cadf6c-333b-5a9c-9cb9-ca6e2ba22b40/scratchpad";
const mkAuth = (role, mode) => ({ state: { user: { id: "u1", name: "Teste", email: "t@ex.com", role, plan: "gestor", isOwner: true, isTenant: true }, activeMode: mode, authChecked: true, sessionStartedAt: Date.now() }, version: 0 });
const OWNER = mkAuth("owner","owner"); const ADMIN = mkAuth("admin","owner"); const TENANT = mkAuth("tenant","tenant");

const R = [];
const pass = (id, m="") => { R.push({id, ok:true, m}); console.log(`  ✓ ${id} PASSA ${m}`); };
const fail = (id, m) => { R.push({id, ok:false, m}); console.log(`  ✗ ${id} FALHA — ${m}`); };
const browser = await chromium.launch({ executablePath: EXEC, args: ["--no-sandbox"] });
async function ctxFor(auth, vw=1280, vh=1000){ const c=await browser.newContext({viewport:{width:vw,height:vh}}); if(auth) await c.addInitScript((a)=>{try{localStorage.setItem("vivanomads-auth",JSON.stringify(a));}catch{}},auth); return c; }
const errs=[]; async function mk(ctx,t){ const p=await ctx.newPage(); p.on("pageerror",(e)=>errs.push(`${t}: ${e}`)); return p; }
const txt = async (p)=>(await p.evaluate(()=>document.body.innerText).catch(()=>""))||"";
async function navDemo(p, path){ const s=path.includes("?")?"&":"?"; await p.goto(`${BASE}${path}${s}demo=1`,{waitUntil:"networkidle"}).catch(()=>{}); await p.waitForTimeout(600); }
async function sidebar(p){ const raw=await p.$$eval("aside nav a",(as)=>as.map(a=>(a.textContent||"").trim()).filter(Boolean)); return [...new Set(raw)]; }
async function casca(p){ return (await p.locator("aside nav a").count())>0 || (await p.locator('button[aria-label="Abrir menu"]').count())>0; }

// ── SUITE A (legal) — checagens de conteúdo já feitas por grep; aqui confirmo no DOM ──
{ const p=await mk(await ctxFor(null),"A");
  await p.goto(`${BASE}/termos`,{waitUntil:"networkidle"}); const t=await txt(p);
  (!/capitaliza/i.test(t)) ? pass("A1","sem 'capitalização' em /termos") : fail("A1","'capitalização' presente");
  (!/\bde de\b/.test(t)) ? pass("A3","sem 'de de'") : fail("A3","'de de' presente");
  await p.goto(`${BASE}/privacidade`,{waitUntil:"networkidle"}); const pv=await txt(p);
  (/Asaas/.test(pv) && !/repasse[s]? do aluguel/i.test(pv)) ? pass("A2","Asaas sem repasse de aluguel") : fail("A2","menção a repasse de aluguel");
  // A4 footer
  let okFoot=true; for(const pg of ["/home","/buscar","/precos"]){ await p.goto(`${BASE}${pg}`,{waitUntil:"networkidle"}); const h=await p.content(); if(!/href="\/termos"/.test(h)||!/href="\/privacidade"/.test(h)) okFoot=false; }
  okFoot ? pass("A4a","footer c/ Termos+Privacidade nas 3 páginas") : fail("A4a","link faltando no footer");
  await p.goto(`${BASE}/auth`,{waitUntil:"networkidle"}); // alterna p/ modo cadastro
  { const b=p.locator("button, a"); const n=await b.count(); for(let i=0;i<n;i++){ const tt=(await b.nth(i).innerText().catch(()=>""))||""; if(/criar (uma )?conta|cadastr|n[ãa]o tem conta/i.test(tt)){ await b.nth(i).click().catch(()=>{}); break; } } }
  await p.waitForTimeout(400);
  const chk = await p.locator('input[type="checkbox"]').count();
  const linksAceite = /href="\/termos"/.test(await p.content()) && /href="\/privacidade"/.test(await p.content());
  (chk>0 && linksAceite) ? pass("A4b","cadastro c/ checkbox de aceite + links Termos/Privacidade") : fail("A4b",`checkbox=${chk} linksAceite=${linksAceite}`);
}

// ── SUITE B ── B1 (anônimo não vê /pedidos/novo? — na verdade é PÚBLICO por decisão; publicar exige login)
{ const p=await mk(await ctxFor(null),"B1");
  await p.goto(`${BASE}/pedidos/novo`,{waitUntil:"networkidle"}); await p.waitForTimeout(400);
  // Decisão posterior: /pedidos/novo é público; publicar deslogado -> /auth. Testo o publicar.
  const url1=p.url();
  await p.locator('input[placeholder="Uberlândia"]').fill("Uberlândia").catch(()=>{});
  await p.locator('input[type="date"]').fill("2026-09-01").catch(()=>{});
  await p.locator('input[placeholder="3500"]').fill("3000").catch(()=>{});
  await p.locator('form button[type="submit"]').first().click().catch(()=>{}); await p.waitForTimeout(700);
  (/\/auth/.test(p.url())) ? pass("B1","publicar deslogado → /auth (form público por decisão; submit gated)") : fail("B1",`submit não foi ao login: ${p.url().replace(BASE,"")}`);
}

// ── SUITE C (menu 9 + integridade) ──
const MENU9=["Visão geral","Meus imóveis","Pedidos de moradia","Mensagens","Fechamento","Contratos & blocos","Ferramentas","Assinatura","Conta"];
{ const p=await mk(await ctxFor(OWNER),"C1"); await p.goto(`${BASE}/dashboard`,{waitUntil:"networkidle"});
  const s=await sidebar(p); (s.length===9 && MENU9.every((l,i)=>s[i]===l)) ? pass("C1","9 itens na ordem") : fail("C1",`[${s.join("|")}]`);
  const html=await p.content(); (!/>\s*Admin\s*</.test(html)&&!s.includes("Admin")) ? pass("C2a","'Admin' ausente do DOM p/ não-admin") : fail("C2a","'Admin' no DOM");
}
{ const p=await mk(await ctxFor(ADMIN),"C3"); await p.goto(`${BASE}/dashboard`,{waitUntil:"networkidle"});
  const s=await sidebar(p); (s.includes("Admin")&&s.includes("Moderar pedidos")) ? pass("C3","admin vê grupo Admin") : fail("C3",`[${s.join("|")}]`);
}
{ const p=await mk(await ctxFor(OWNER),"C4"); let all=true;
  for(const h of ["/dashboard","/dashboard/imoveis","/dashboard/pedidos-cidade","/dashboard/mensagens","/dashboard/fechamento","/dashboard/contratos","/dashboard/ferramentas","/dashboard/assinatura","/dashboard/conta"]){
    const r=await p.goto(`${BASE}${h}`,{waitUntil:"networkidle"}); const st=r?r.status():0; if(st!==200||!(await casca(p))) { all=false; fail("C4",`${h} HTTP ${st} casca=${await casca(p)}`);} }
  if(all) pass("C4","9 itens abrem dentro da casca");
}
{ const p=await mk(await ctxFor(OWNER),"C6"); await p.goto(`${BASE}/dashboard/ferramentas`,{waitUntil:"networkidle"});
  const ext=await p.$$eval("main a",(as)=>as.map(a=>a.getAttribute("href")).filter(h=>h&&/^https?:\/\//.test(h)));
  (ext.length===0) ? pass("C6","zero link externo no Ferramentas") : fail("C6",`externos: ${ext.join(",")}`);
}
{ const p=await mk(await ctxFor(null),"C7"); await p.goto(`${BASE}/precos`,{waitUntil:"networkidle"});
  const links=p.locator('a',{hasText:"Ver opções de garantia"}); const n=await links.count(); let okg=n>0;
  for(let i=0;i<n;i++){ const h=await links.nth(i).getAttribute("href"); if(h!=="/como-funciona#garantias"||/para-proprietarios|fechamento/.test(h)) okg=false; }
  okg ? pass("C7","garantia → /como-funciona#garantias (nunca proprietário)") : fail("C7","destino errado");
}

// ── SUITE D (vocabulário/flags) ──
{ const p=await mk(await ctxFor(OWNER),"D2");
  let okNF=true; for(const id of ["ube-001","ube-002","ube-003"]){ await p.goto(`${BASE}/imoveis/${id}`,{waitUntil:"networkidle"}); if(/Emite Nota Fiscal/.test(await txt(p))) okNF=false; }
  okNF ? pass("D2","selo NF oculto nos 3 imóveis") : fail("D2","selo NF visível");
}
{ const p=await mk(await ctxFor(null),"D3"); let bad=[];
  for(const pg of ["/home","/buscar","/imoveis/ube-001","/como-funciona","/para-proprietarios","/precos"]){ await p.goto(`${BASE}${pg}`,{waitUntil:"networkidle"}); const t=await txt(p); const m=t.match(/\b(saldo|repasse)\b/i); if(m) bad.push(`${pg}:${m[0]}`); }
  (bad.length===0) ? pass("D3","sem 'saldo/repasse' nas públicas") : fail("D3",bad.join(", "));
}

// ── SUITE E (comissão %) ──
{ const p=await mk(await ctxFor(ADMIN),"E1"); await navDemo(p,"/dashboard/contratos");
  const t=await txt(p);
  (/R\$\s?256/.test(t) && /8% do 1º aluguel/.test(t)) ? pass("E1","Santa Mônica: R$ 256 (8% do 1º aluguel)") : fail("E1","faixa de comissão incorreta");
  (!/R\$\s?3\.200.*1 m[êe]s|1 m[êe]s.*3\.200/.test(t)) ? pass("E1b","não diz 'R$ 3.200 (1 mês)'") : fail("E1b","ainda mostra 1 mês cheio");
  await p.screenshot({ path: `${SHOT}/roteiro-E1-contratos.png` });
}
{ const p=await mk(await ctxFor(ADMIN),"E2"); await navDemo(p,"/dashboard/fechamento");
  async function clickByText(re){ for(const b of await p.locator("button").all()){ const tt=await b.innerText().catch(()=>""); if(re.test(tt)){ await b.click().catch(()=>{}); return true; } } return false; }
  await clickByText(/Iniciar verifica/i); await p.waitForTimeout(1600);
  // Percorre os passos do wizard: seleciona 1ª opção quando houver e avança.
  for(let step=0; step<8; step++){
    const radios = p.locator('[role="radio"]');
    if(await radios.count()>0) { await radios.first().click().catch(()=>{}); await p.waitForTimeout(200); }
    const advanced = await clickByText(/Continuar|Gerar contrato|Avançar|Próximo/i);
    await p.waitForTimeout(700);
    if(/\d+%/.test(await txt(p)) && /comiss/i.test(await txt(p))) break;
    if(!advanced) break;
  }
  const t=await txt(p);
  const temPct = /comiss[^\n]*\d+%|\d+%[^\n]*plano/i.test(t);
  (temPct && !/comiss[^.]{0,30}1 m[êe]s de aluguel/i.test(t)) ? pass("E2","fechamento mostra comissão em % (plano)") : fail("E2","comissão % não encontrada no resumo (verificar wizard)");
  await p.screenshot({ path: `${SHOT}/roteiro-E2-fechamento.png` });
}
{ const p=await mk(await ctxFor(TENANT),"E3"); let bad=[];
  for(const pg of ["/precos","/como-funciona","/para-proprietarios","/simulacao"]){ await p.goto(`${BASE}${pg}`,{waitUntil:"networkidle"}); const t=await txt(p); if(/comiss[^.]{0,40}(1 m[êe]s|um m[êe]s) de aluguel|(1 m[êe]s|um m[êe]s) de aluguel[^.]{0,40}comiss/i.test(t)) bad.push(pg); }
  (bad.length===0) ? pass("E3","nenhuma superfície diz comissão = 1 mês de aluguel") : fail("E3",bad.join(","));
}
{ const p=await mk(await ctxFor(TENANT),"E4"); await p.goto(`${BASE}/simulacao`,{waitUntil:"networkidle"}); const t=await txt(p);
  (/garantias e seguros|seguro incêndio/i.test(t)) ? pass("E4","linha de garantias e seguros presente") : fail("E4","linha de seguros ausente");
}

// ── SUITE F (Fundador) ──
{ const p=await mk(await ctxFor(null),"F1"); await p.goto(`${BASE}/precos`,{waitUntil:"networkidle"}); const t=await txt(p);
  (/Piloto Fundador/.test(t) && /12 meses/.test(t) && /8%/.test(t) && /20% de desconto vital/i.test(t)) ? pass("F1","banner Fundador completo") : fail("F1","banner incompleto");
  (/Gratuito/.test(t) && /Essencial/.test(t) && /Profissional/.test(t)) ? pass("F1b","tabela de planos segue publicada") : fail("F1b","tabela sumiu");
  await p.screenshot({ path: `${SHOT}/roteiro-F1-precos.png`, fullPage:true });
}

// ── SUITE G (regressão) ──
{ const p=await mk(await ctxFor(null),"G1"); const r=await p.goto(`${BASE}/imoveis/ube-001`,{waitUntil:"networkidle"}); const t=await txt(p);
  (r.status()===200 && /R\$/.test(t)) ? pass("G1","imóvel abre com preço") : fail("G1","imóvel sem preço");
}
{ const p=await mk(await ctxFor(TENANT),"G3"); await p.goto(`${BASE}/dashboard`,{waitUntil:"networkidle"}); const s=await sidebar(p);
  (s.includes("Favoritos")&&s.includes("Mensagens")&&!s.includes("Fechamento")) ? pass("G3","dashboard do inquilino (sem menu de proprietário)") : fail("G3",`[${s.join("|")}]`);
}

if(errs.length) errs.slice(0,8).forEach(e=>fail("pageerror",e));
await browser.close();
const okN=R.filter(r=>r.ok).length, failN=R.filter(r=>!r.ok).length;
console.log(`\n=== ${okN} PASSA / ${failN} FALHA ===`);
if(failN){ console.log(R.filter(r=>!r.ok).map(r=>`${r.id}: ${r.m}`).join("\n")); process.exit(1); }
console.log("✅ SUITES A–G VERDE");
