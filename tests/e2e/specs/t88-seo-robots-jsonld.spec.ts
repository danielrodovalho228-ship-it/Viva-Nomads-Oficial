import { test, expect } from "@playwright/test";

/**
 * T88 — SEO e IA (ordem 9f68d9d3): robots.txt e dados estruturados que o
 * servidor entrega SEM JavaScript (o que Google e buscadores de IA leem).
 */
test.use({ storageState: { cookies: [], origins: [] }, javaScriptEnabled: false });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "chromium", "só no projeto do site (chromium)");
});

const PRIVADAS = ["/dashboard", "/admin", "/api"];
const BOTS_IA = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "PerplexityBot", "Google-Extended"];

function blocos(robots: string): { agentes: string[]; regras: string[] }[] {
  return robots
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .map((l) => ({
      agentes: l.filter((x) => /^user-agent:/i.test(x)).map((x) => x.split(":")[1].trim()),
      regras: l.filter((x) => /^(allow|disallow):/i.test(x)),
    }))
    .filter((b) => b.agentes.length > 0);
}

test("robots.txt: áreas privadas bloqueadas, sem bloqueio geral e bots de IA não barrados", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const txt = await res.text();
  const todos = blocos(txt);
  for (const b of todos) {
    for (const rota of PRIVADAS) expect(b.regras, `${b.agentes} bloqueia ${rota}`).toContain(`Disallow: ${rota}`);
    expect(b.regras, `${b.agentes} não pode bloquear o site todo`).not.toContain("Disallow: /");
  }
  for (const bot of BOTS_IA) {
    const regra = todos.find((b) => b.agentes.includes(bot));
    if (regra) expect(regra.regras).not.toContain("Disallow: /");
  }
  expect(txt).toMatch(/Sitemap: .*\/sitemap\.xml/);
});

test("/cidades/uberlandia: FAQPage e lista no HTML do servidor, sem endereço nem coordenada", async ({ request }) => {
  const html = await (await request.get("/cidades/uberlandia")).text();
  const jsons = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  expect(jsons.length).toBeGreaterThanOrEqual(2);
  const texto = jsons.join("\n");
  expect(texto).toContain('"FAQPage"');
  expect(texto).toContain('"ItemList"');
  expect(texto).not.toMatch(/streetAddress|latitude|longitude|"geo"/i);
  for (const j of jsons) expect(() => JSON.parse(j)).not.toThrow();
  // O FAQ também está no HTML visível (sem JavaScript).
  expect(html).toContain('data-testid="faq-cidade"');
  expect(html).toContain('data-testid="valor-medio-cidade"');
});

test("anúncio real: Offer com Accommodation, estadia mín/máx e sem coordenada", async ({ request }) => {
  const busca = await (await request.get("/cidades/uberlandia")).text();
  const id = busca.match(/\/imoveis\/([0-9a-f]{8}-[0-9a-f-]{27})/)?.[1];
  test.skip(!id, "sem anúncio real publicado em Uberlândia neste ambiente");
  const html = await (await request.get(`/imoveis/${id}`)).text();
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? "";
  const json = JSON.parse(ld);
  const texto = JSON.stringify(json);
  expect(texto).toContain('"Accommodation"');
  expect(texto).toContain('"eligibleDuration"');
  expect(texto).toContain('"Offer"');
  expect(texto).not.toMatch(/streetAddress|latitude|longitude|"geo"/i);
});
