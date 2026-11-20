import { test, expect, type APIRequestContext } from "@playwright/test";
import { NO_LABORATORIO, adm, apagarContas, criarConta, criarImovelPronto, novaSenha, novoSufixo } from "../fixtures/laboratorio";

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
  // Valor médio ("precos-medios") só aparece com média real (3+ anúncios no grupo): se vier, não pode estar quebrado.
  if (html.includes('data-testid="precos-medios"')) expect(html).not.toMatch(/R\$\s*(NaN|undefined|null)/);
});

/**
 * E1015: a página da cidade fica em cache (revalidate 60 s) e lista do mais novo para o mais velho. Na suíte, o primeiro
 * link costuma ser o anúncio que outro teste criou e já apagou: a página dele responde 404, sem JSON-LD, e o
 * JSON.parse("") parava o teste ("Unexpected end of JSON input"). A regra continua a mesma — um anúncio real publicado
 * entrega o JSON-LD certo —, agora sobre o primeiro anúncio da cidade que de fato abre.
 */
async function primeiroAnuncioVivo(request: APIRequestContext): Promise<{ id: string; ld: string } | null> {
  const busca = await (await request.get("/cidades/uberlandia")).text();
  const ids = [...new Set([...busca.matchAll(/\/imoveis\/([0-9a-f]{8}-[0-9a-f-]{27})/g)].map((m) => m[1]))];
  for (const id of ids) {
    const r = await request.get(`/imoveis/${id}`);
    if (r.status() !== 200) continue;
    const ld = (await r.text()).match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
    if (ld) return { id, ld };
  }
  return null;
}

test("anúncio real: Offer com Accommodation, estadia mín/máx e sem coordenada", async ({ request }) => {
  test.setTimeout(180_000);
  const contas: string[] = [];
  try {
    if (NO_LABORATORIO) {
      // Como na suíte: outro teste publica um anúncio em Uberlândia, a página da cidade o lista em cache, e o teste o apaga.
      const sufixo = novoSufixo();
      const dono = await criarConta({ email: `dono.t190.${sufixo}@lab.vivanomads.test`, nome: "Sérgio Seo", role: "owner" }, novaSenha());
      contas.push(dono);
      const apagado = await criarImovelPronto(dono, `T190 anúncio que outro teste apaga ${sufixo}`, { ativo: true });
      await expect
        .poll(async () => (await (await request.get("/cidades/uberlandia")).text()).includes(`/imoveis/${apagado}`), { timeout: 120_000, intervals: [2_000, 5_000] })
        .toBe(true);
      await adm().from("properties").delete().eq("id", apagado);
      expect((await request.get(`/imoveis/${apagado}`)).status(), "o anúncio apagado não abre").toBe(404);
    }
    const vivo = await primeiroAnuncioVivo(request);
    test.skip(!vivo, "sem anúncio real publicado em Uberlândia neste ambiente");
    const json = JSON.parse(vivo!.ld);
    const texto = JSON.stringify(json);
    expect(texto).toContain('"Accommodation"');
    expect(texto).toContain('"eligibleDuration"');
    expect(texto).toContain('"Offer"');
    expect(texto).not.toMatch(/streetAddress|latitude|longitude|"geo"/i);
  } finally {
    if (contas.length) await apagarContas(contas);
  }
});
