import pw from "/home/user/Viva-Nomads-Oficial/node_modules/playwright-core/index.js";
const { chromium } = pw;
const B = "http://localhost:3240";
const OUT = "/tmp/claude-0/-home-user-Viva-Nomads-Oficial/28cadf6c-333b-5a9c-9cb9-ca6e2ba22b40/scratchpad/shots";
const PAGES = [
  ["home", "/home"],
  ["buscar", "/buscar"],
  ["imovel", "/imoveis/ube-001"],
  ["como-funciona", "/como-funciona"],
  ["precos", "/precos"],
  ["proprietarios", "/para-proprietarios"],
];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args:["--no-sandbox","--disable-dev-shm-usage"] });
const ctx = await b.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, isMobile: true });
// bloqueia requests externos (só localhost e data:)
await ctx.route("**/*", (route) => {
  const u = route.request().url();
  if (u.startsWith("http://localhost") || u.startsWith("data:") || u.startsWith("blob:")) return route.continue();
  return route.abort();
});
for (const [name, path] of PAGES) {
  const p = await ctx.newPage();
  try {
    await p.goto(B + path, { waitUntil: "domcontentloaded", timeout: 20000 });
    await p.waitForTimeout(2200);
    const h = await p.evaluate(() => document.body.scrollHeight);
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log(name, "ok  h=", h);
  } catch (e) { console.log(name, "ERRO", e.message.split("\n")[0]); }
  await p.close();
}
await b.close();
console.log("done");
