import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarAdmin, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { recursoFicticioDoLab } from "../../../src/lib/varredura-texto";
import { isExemplo } from "../../../src/lib/demo-listing";

/**
 * T48 — VARREDURA (laboratório, ordem 225d0648). Percorre a 390 px:
 *  • TODAS as rotas do sitemap (visitante) e
 *  • as telas logadas de cada persona (inquilino, proprietário, admin).
 * Em cada tela: sem erro 5xx, sem erro de JavaScript/console (recurso externo que não carregou no laboratório é
 * ignorado), sem rolagem horizontal (3 Ss) e todos os links internos da tela respondem (< 400).
 * Os problemas de TODAS as telas são juntados e reportados de uma vez (expect.soft), para a execução mostrar o
 * quadro completo em vez de parar no primeiro.
 *
 * Ampliação (plano de QA, 17/10): também a 1280 px; em cada tela, título e h1, toda imagem com alt, nenhum mp4
 * baixado antes do play (só o vídeo de fundo com autoplay pode) e nenhum JSON-LD de Review/AggregateRating nos
 * exemplos; endereços inexistentes respondem 404 com noindex; sitemap limpo (sem painel, admin, auth, exemplo,
 * repetição ou outro domínio).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const inq = { email: `inq.var.${sufixo}@lab.vivanomads.test`, nome: "Vera Varredura Inquilina", role: "tenant" as const };
const dono = { email: `dono.var.${sufixo}@lab.vivanomads.test`, nome: "Valter Varredura Dono", role: "owner" as const };
const adminConta = { email: `adm.var.${sufixo}@lab.vivanomads.test`, nome: "Alda Varredura Admin" };
const ids: { inq?: string; dono?: string; adm?: string; imovel?: string } = {};

const TELAS_LOGADAS = [
  "/dashboard",
  "/dashboard/mensagens",
  "/dashboard/favoritos",
  "/dashboard/candidaturas",
  "/dashboard/pedidos",
  "/dashboard/buscas",
  "/dashboard/garantias",
  "/dashboard/locacoes",
  "/dashboard/contratos",
  "/dashboard/verificacao",
  "/dashboard/indicacoes",
  "/dashboard/carteira",
  "/dashboard/reembolsos",
  "/dashboard/solicitacoes",
  "/dashboard/comparar",
  "/dashboard/simulador",
  "/dashboard/conta",
  "/dashboard/conta/perfil",
  "/dashboard/conta/notificacoes",
  "/dashboard/notificacoes",
  "/dashboard/conta/seguranca",
  "/dashboard/conta/ajuda",
  "/dashboard/assinatura",
  "/dashboard/imoveis",
  "/dashboard/imoveis/novo",
  "/dashboard/leads",
  "/dashboard/orcamentos",
  "/dashboard/ferramentas",
  "/dashboard/fechamento",
  "/dashboard/viabilidade",
  "/dashboard/roi-imovel",
  "/dashboard/pedidos-cidade",
  "/dashboard/avaliacoes",
  "/dashboard/visitas",
];
const TELAS_ADMIN = [
  "/admin",
  "/admin/documentos",
  "/admin/atendimento",
  "/admin/pedidos",
  "/admin/parceiros",
  "/admin/fotografos",
  "/admin/marketing",
  "/admin/agentes",
  "/admin/financeiro",
  "/admin/avaliacoes",
  "/admin/usuarios",
  "/admin/emails-teste",
];
const INEXISTENTES = [
  "/pagina-que-nao-existe-xyz",
  "/imoveis/nao-existe-123",
  "/imoveis/00000000-0000-4000-8000-000000000000",
  "/cidades/xpto123",
  "/proprietario/00000000-0000-4000-8000-000000000000",
  "/proprietario/exemplo-999",
];

const linksVistos = new Set<string>();

/** Abre a rota e devolve os problemas encontrados (lista vazia = tela limpa). */
async function conferir(page: Page, rota: string, largura = 390): Promise<string[]> {
  const problemas: string[] = [];
  const mp4s: string[] = [];
  const aoPedido = (r: import("@playwright/test").Request) => {
    if (/\.mp4(\?|$)/i.test(r.url())) mp4s.push(new URL(r.url()).pathname);
  };
  const origem = new URL(page.url() === "about:blank" ? "http://localhost" : page.url()).origin;
  const aoErro = (e: Error) => problemas.push(`erro de JavaScript: ${e.message.slice(0, 160)}`);
  const aoConsole = (m: import("@playwright/test").ConsoleMessage) => {
    if (m.type() !== "error") return;
    const alvo = m.location().url;
    // Imagem/arquivo de FORA do site que o laboratório não consegue baixar não é defeito do site.
    if (/Failed to load resource/i.test(m.text()) && alvo && !alvo.startsWith(origem)) return;
    // Foto fictícia que o próprio laboratório semeou (host lab.vivanomads.test): o Next devolve 400, não é defeito do site.
    if (/Failed to load resource/i.test(m.text()) && recursoFicticioDoLab(alvo)) return;
    problemas.push(`console.error: ${m.text().slice(0, 160)}${alvo ? ` (${alvo.slice(0, 140)})` : ""}`);
  };
  page.on("pageerror", aoErro);
  page.on("console", aoConsole);
  page.on("request", aoPedido);
  try {
    const resp = await page.goto(rota, { waitUntil: "networkidle", timeout: 40_000 });
    const status = resp?.status() ?? 0;
    if (status >= 400) problemas.push(`HTTP ${status}`);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (sobra > 1) problemas.push(`rolagem horizontal de ${sobra}px a ${largura}px`);

    // Título, h1, alt, vídeo e JSON-LD.
    const ficha = await page.evaluate(() => ({
      titulo: document.title.trim(),
      h1: document.querySelectorAll("h1").length,
      semAlt: [...document.querySelectorAll("img:not([alt])")].map((i) => (i.getAttribute("src") ?? "").slice(0, 80)),
      autoplay: [...document.querySelectorAll("video[autoplay]")].flatMap((v) =>
        [v.getAttribute("src"), ...[...v.querySelectorAll("source")].map((s) => s.getAttribute("src"))].filter(Boolean).map((u) => new URL(u!, location.href).pathname),
      ),
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? "").join("\n"),
    }));
    if (!ficha.titulo) problemas.push("sem <title>");
    if (ficha.h1 === 0) problemas.push("sem h1");
    if (ficha.semAlt.length) problemas.push(`imagem sem alt: ${ficha.semAlt.slice(0, 3).join(", ")}`);
    const mp4Antes = [...new Set(mp4s)].filter((u) => !ficha.autoplay.includes(u));
    if (mp4Antes.length) problemas.push(`mp4 baixado antes do play: ${mp4Antes.join(", ")}`);
    const caminho = rota.split("?")[0];
    const ehExemplo = (/^\/imoveis\/[^/]+$/.test(caminho) && isExemplo(caminho.split("/")[2])) || caminho.startsWith("/proprietario/exemplo-");
    if (ehExemplo && /"@type"\s*:\s*"(Review|AggregateRating)"/.test(ficha.jsonLd)) problemas.push("JSON-LD de Review/AggregateRating em exemplo");

    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    const internos = [...new Set(hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/api/") && !h.includes("/auth/callback") && !h.includes("/auth/confirm")))].map((h) => h.split("#")[0]).filter(Boolean);
    for (const h of internos.slice(0, 80)) {
      if (linksVistos.has(h)) continue;
      linksVistos.add(h);
      let r = await page.request.get(h, { maxRedirects: 5, timeout: 30_000 }).catch(() => null);
      // Páginas de cidade ficam em cache por 60 s: um anúncio que OUTRO spec do laboratório criou e já apagou
      // ainda aparece na lista e dá 404 por alguns segundos. Isso não é link quebrado do site: confere de novo.
      if (r?.status() === 404 && /^\/imoveis\/[0-9a-f]{8}-[0-9a-f-]{27}$/.test(h)) {
        await page.waitForTimeout(1_500);
        r = await page.request.get(h, { maxRedirects: 5, timeout: 30_000 }).catch(() => null);
        if (r?.status() === 404) continue;
      }
      if (!r || r.status() >= 400) problemas.push(`link quebrado ${h} → ${r ? r.status() : "sem resposta"}`);
    }
  } catch (e) {
    problemas.push(`não abriu: ${String(e).slice(0, 160)}`);
  } finally {
    page.off("pageerror", aoErro);
    page.off("console", aoConsole);
    page.off("request", aoPedido);
  }
  return problemas;
}

async function varrer(page: Page, rotas: string[], largura = 390): Promise<void> {
  for (const rota of rotas) {
    const problemas = await conferir(page, rota, largura);
    expect.soft(problemas, `${rota} (${largura}px)`).toEqual([]);
  }
}

async function lerSitemap(request: import("@playwright/test").APIRequestContext): Promise<string[]> {
  const xml = await (await request.get("/sitemap.xml")).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}
const caminhoDe = (loc: string) => {
  const u = new URL(loc);
  return u.pathname + u.search;
};

test.describe("T48 — Varredura do site e do app", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeAll(async () => {
    ids.inq = await criarConta(inq, senha);
    ids.dono = await criarConta(dono, senha);
    ids.adm = await criarAdmin(adminConta.email, adminConta.nome, senha);
    ids.imovel = await criarImovelPronto(ids.dono, `Studio da varredura ${sufixo}`, { ativo: true });
    await fotosReais(ids.imovel, ids.dono);
  });

  test.afterAll(async () => {
    await apagarContas([ids.inq, ids.dono, ids.adm]);
  });

  test("visitante: todas as rotas do sitemap", async ({ page, request }) => {
    test.setTimeout(900_000);
    // O sitemap tem cache de 60 s (revalidate): o imóvel criado agora entra na próxima geração.
    const lerRotas = async () => (await lerSitemap(request)).map(caminhoDe);
    await expect
      .poll(async () => (await lerRotas()).includes(`/imoveis/${ids.imovel}`), {
        message: "o imóvel publicado entra no sitemap (cache de 60 s)",
        timeout: 120_000,
        intervals: [5_000],
      })
      .toBe(true);
    const rotas = await lerRotas();
    expect(rotas.length, "o sitemap lista rotas").toBeGreaterThan(10);
    await varrer(page, [...new Set(rotas)]);
  });

  test("visitante a 1280 px: páginas institucionais e uma amostra de anúncios e cidades", async ({ browser, request }) => {
    test.setTimeout(900_000);
    const rotas = [...new Set((await lerSitemap(request)).map(caminhoDe))];
    const amostra = [
      ...rotas.filter((r) => !/^\/(imoveis|cidades|proprietario)\//.test(r)),
      ...rotas.filter((r) => r.startsWith("/imoveis/")).slice(0, 4),
      ...rotas.filter((r) => r.startsWith("/cidades/")).slice(0, 2),
      ...rotas.filter((r) => r.startsWith("/proprietario/")).slice(0, 2),
      "/imoveis/ube-001",
      "/proprietario/exemplo-1",
    ];
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await varrer(page, [...new Set(amostra)], 1280);
    await ctx.close();
  });

  test("endereços inexistentes: 404 com noindex, título e h1 (390 e 1280)", async ({ browser }) => {
    for (const largura of [390, 1280]) {
      const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, storageState: { cookies: [], origins: [] } });
      const page = await ctx.newPage();
      for (const rota of INEXISTENTES) {
        const resp = await page.goto(rota, { waitUntil: "domcontentloaded" });
        expect.soft(resp?.status(), `${rota} (${largura}px) responde 404`).toBe(404);
        const robots = await page.locator('meta[name="robots"]').evaluateAll((ms) => ms.map((m) => m.getAttribute("content") ?? "").join(" "));
        expect.soft(robots, `${rota} (${largura}px) tem noindex`).toContain("noindex");
        expect.soft(robots, `${rota} (${largura}px) não diz "index, follow"`).not.toMatch(/(^|[ ,])index/);
        expect.soft((await page.title()).trim(), `${rota} tem título`).not.toBe("");
        await expect.soft(page.locator("h1"), `${rota} tem h1`).toHaveCount(1);
        expect.soft(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${rota} sem rolagem lateral`).toBeLessThanOrEqual(1);
      }
      await page.screenshot({ path: `tests/laboratorio/saida/t48-404-${largura}.png`, fullPage: false });
      await ctx.close();
    }
  });

  test("sitemap limpo: só páginas públicas do próprio domínio, sem repetição nem exemplo", async ({ request, baseURL }) => {
    const locs = await lerSitemap(request);
    expect(locs.length).toBeGreaterThan(10);
    const origens = new Set(locs.map((l) => new URL(l).origin));
    expect(origens.size, `um domínio só: ${[...origens].join(", ")}`).toBe(1);
    expect(locs.length - new Set(locs).size, "sem URL repetida").toBe(0);
    const caminhos = locs.map(caminhoDe);
    const proibidos = caminhos.filter((c) => /^\/(dashboard|admin|auth|api|qualificar)(\/|$|\?)/.test(c) || c.startsWith("/proprietario/exemplo-") || c.includes("#"));
    expect(proibidos, "nada privado ou de exemplo no sitemap").toEqual([]);
    const testes = caminhos.filter((c) => /\[(TESTE|TEST|QA)/i.test(decodeURIComponent(c)));
    expect(testes, "sem anúncio de teste").toEqual([]);
    // robots.txt aponta para o sitemap.
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/Sitemap:\s*\S+\/sitemap\.xml/);
    expect(baseURL).toBeTruthy();
  });

  for (const [nome, conta, extras] of [
    ["inquilino", inq, [] as string[]],
    ["proprietário", dono, () => [`/dashboard/imoveis/${ids.imovel}/editar`]],
    ["admin", { email: adminConta.email }, TELAS_ADMIN],
  ] as const) {
    test(`${nome}: todas as telas logadas`, async ({ browser }) => {
      test.setTimeout(1_800_000);
      const page = await entrar(browser, conta.email, senha);
      const extra = typeof extras === "function" ? extras() : extras;
      await varrer(page, [...TELAS_LOGADAS, ...extra]);
      // 1280 px: o mesmo painel no computador.
      await page.setViewportSize({ width: 1280, height: 900 });
      await varrer(page, [...TELAS_LOGADAS, ...extra], 1280);
      await page.context().close();
    });
  }
});
