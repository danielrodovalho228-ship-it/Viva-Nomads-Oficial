import pw from "/home/user/Viva-Nomads-Oficial/node_modules/playwright-core/index.js";
const { chromium } = pw;
const B = "http://localhost:3241";
const OUT = "/tmp/claude-0/-home-user-Viva-Nomads-Oficial/28cadf6c-333b-5a9c-9cb9-ca6e2ba22b40/scratchpad/shots";
const DEMO = { id:"demo-owner", name:"Marcos Andrade", email:"marcos@exemplo.com", role:"owner", fullName:"Marcos Andrade", plan:"gestor", isOwner:true, isTenant:true };
const AUTH = JSON.stringify({ state:{ user:DEMO, activeMode:"owner" }, version:0 });
const PAGES = [
  ["dash-visao","/dashboard"],
  ["dash-leads","/dashboard/leads"],
  ["dash-mensagens","/dashboard/mensagens"],
  ["dash-carteira","/dashboard/carteira"],
];
const b = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args:["--no-sandbox","--disable-dev-shm-usage"] });
const ctx = await b.newContext({ viewport:{width:412,height:900}, deviceScaleFactor:2, isMobile:true });
await ctx.addInitScript(a => { try{ localStorage.setItem("vivanomads-auth", a); }catch(e){} }, AUTH);
await ctx.route("**/*", r => { const u=r.request().url(); return (u.startsWith("http://localhost")||u.startsWith("data:")||u.startsWith("blob:"))?r.continue():r.abort(); });
for (const [name,path] of PAGES){
  const p = await ctx.newPage();
  try{
    await p.goto(B+path,{waitUntil:"domcontentloaded",timeout:20000});
    await p.waitForTimeout(2600);
    const isAuth = /Bem-vindo de volta/.test(await p.locator("body").innerText());
    const h = await p.evaluate(()=>document.body.scrollHeight);
    await p.screenshot({ path:`${OUT}/${name}.png`, fullPage:true });
    console.log(name, isAuth?"REDIRECIONOU_AUTH ❌":"ok ✅", "h=",h);
  }catch(e){ console.log(name,"ERRO",e.message.split("\n")[0]); }
  await p.close();
}
await b.close(); console.log("done");
