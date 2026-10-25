import { test, expect } from "@playwright/test";
import { ROTAS_AXE_PUBLICAS } from "../../../src/lib/lab/axe-regras";
import { caminhosDoSitemap, extrairMeta, linksInternos, pesoExcedido, problemasDaPagina, repetidos, type MetaPagina } from "../../../src/lib/lab/seo-regras";

/*
  T257 — SEO e peso (ordem 21708cca, parte D). Lê o HTML que o servidor entrega, sem login:
  1) título, descrição e H1 existem e não se repetem entre as páginas públicas principais;
  2) toda URL do sitemap responde 200 (sitemap = páginas públicas que existem);
  3) os links internos das páginas públicas principais não levam a 404;
  4) peso transferido de cada página pública principal abaixo do limite registrado em seo-regras.ts.
*/
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
});

test("título, descrição e H1 únicos nas páginas públicas principais", async ({ request }) => {
  const paginas: Record<string, MetaPagina> = {};
  const problemas: string[] = [];
  for (const rota of ROTAS_AXE_PUBLICAS.filter((r) => r !== "/auth")) {
    const res = await request.get(rota);
    expect(res.status(), rota).toBe(200);
    paginas[rota] = extrairMeta(await res.text());
    problemas.push(...problemasDaPagina(rota, paginas[rota]));
  }
  expect([...problemas, ...repetidos(paginas)].join("\n")).toBe("");
});

test("sitemap: toda URL responde 200 e as rotas principais estão nele", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const caminhos = caminhosDoSitemap(xml);
  expect(caminhos.length).toBeGreaterThan(10);
  for (const rota of ["/", "/buscar", "/como-funciona", "/precos", "/para-proprietarios"]) expect(caminhos, rota).toContain(rota);
  const falhas: string[] = [];
  for (const c of caminhos.slice(0, 60)) {
    const res = await request.get(c);
    if (res.status() !== 200) falhas.push(`${c}: ${res.status()}`);
  }
  expect(falhas.join("\n")).toBe("");
});

test("links internos das páginas públicas principais não quebram", async ({ request }) => {
  const origem = new Map<string, string>(); // link → página onde apareceu primeiro
  for (const rota of ROTAS_AXE_PUBLICAS) {
    const res = await request.get(rota);
    for (const l of linksInternos(await res.text())) if (!origem.has(l)) origem.set(l, rota);
  }
  const quebrados: string[] = [];
  for (const a of [...origem.keys()].slice(0, 120)) {
    const res = await request.get(a, { maxRedirects: 5 });
    if (res.status() < 400 || res.status() === 401 || res.status() === 403) continue;
    // No laboratório outras specs apagam os imóveis que criaram enquanto esta roda (lab de b1385f6, 22/10: /imoveis/… 404).
    // Só é link quebrado se a página de origem ainda aponta para ele.
    const ainda = linksInternos(await (await request.get(origem.get(a)!)).text()).includes(a);
    if (ainda) quebrados.push(`${a}: ${res.status()} (em ${origem.get(a)})`);
  }
  expect(quebrados.join("\n")).toBe("");
});

for (const rota of ROTAS_AXE_PUBLICAS.filter((r) => r !== "/auth")) {
  test(`${rota}: peso transferido abaixo do limite`, async ({ page }) => {
    let bytes = 0;
    page.on("response", async (r) => {
      const tam = Number((await r.allHeaders())["content-length"] ?? 0);
      bytes += Number.isFinite(tam) ? tam : 0;
    });
    await page.goto(rota, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    expect(pesoExcedido(rota, bytes)).toBe("");
  });
}
