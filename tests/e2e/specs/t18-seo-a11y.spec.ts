import { test, expect, type Page } from "@playwright/test";

/**
 * T18 — SEO e acessibilidade (auditoria, PR D). Lê o HTML que o SERVIDOR
 * entrega (o que o Google vê): um h1 por página, sem pular nível de título,
 * robots/canonical certos, e textos que não prometem o que não existe.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
});

async function htmlDoServidor(page: Page, rota: string): Promise<string> {
  const res = await page.request.get(rota);
  return res.text();
}

function niveis(html: string): number[] {
  const corpo = html.split("<body")[1] ?? "";
  return [...corpo.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
}

const PUBLICAS = ["/", "/buscar", "/como-funciona", "/para-proprietarios", "/precos", "/empresas", "/termos", "/privacidade", "/seguranca", "/pedidos/novo"];

for (const rota of PUBLICAS) {
  test(`${rota}: um h1, sem pular nível de título`, async ({ page }) => {
    const n = niveis(await htmlDoServidor(page, rota));
    expect(n.filter((x) => x === 1).length, "quantidade de h1").toBe(1);
    const pulos = n.slice(1).filter((x, i) => x > n[i] + 1);
    expect(pulos, `sequência ${n.join(",")}`).toEqual([]);
  });
}

for (const rota of ["/buscar", "/como-funciona", "/para-proprietarios", "/precos", "/empresas", "/termos", "/privacidade", "/seguranca"]) {
  test(`${rota}: canonical próprio`, async ({ page }) => {
    const html = await htmlDoServidor(page, rota);
    expect(html).toMatch(new RegExp(`<link rel="canonical" href="[^"]*${rota}"`));
  });
}

for (const rota of ["/auth", "/pedidos/novo", "/qualificar", "/dashboard"]) {
  test(`${rota}: noindex e título próprio`, async ({ page }) => {
    const html = await htmlDoServidor(page, rota);
    expect(html).toMatch(/<meta name="robots" content="noindex/);
    expect(html).not.toMatch(/<title>Viva Nomads — Locação mobiliada/);
  });
}

test("404: só noindex (sem o index da raiz)", async ({ page }) => {
  const html = await htmlDoServidor(page, "/pagina-que-nao-existe-t18");
  const robots = [...html.matchAll(/<meta name="robots" content="([^"]*)"/g)].map((m) => m[1]);
  expect(robots.length).toBeGreaterThan(0);
  for (const r of robots) expect(r).toContain("noindex");
});

test("/cidades/uberlandia: og:image e robots explícitos", async ({ page }) => {
  const html = await htmlDoServidor(page, "/cidades/uberlandia");
  expect(html).toMatch(/<meta property="og:image"/);
  expect(html).toMatch(/<meta name="robots"/);
});

test("textos: sem 180+, sem verificação prometida como pronta", async ({ page }) => {
  const home = await htmlDoServidor(page, "/");
  expect(home).not.toContain("Mais de 180 dias");
  expect(home).not.toContain("Disponíveis agora");
  const como = await htmlDoServidor(page, "/como-funciona");
  expect(como).not.toContain("conecta, verifica e documenta");
  expect(como).not.toContain("Verifique-se");
  const prop = await htmlDoServidor(page, "/para-proprietarios");
  expect(prop).not.toContain("verde/amarelo/vermelho");
  expect(prop).not.toContain("comprova a regularidade");
});
