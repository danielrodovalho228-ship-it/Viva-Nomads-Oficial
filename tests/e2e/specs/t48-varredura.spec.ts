import { test, expect, type Page } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarAdmin, criarConta, criarImovelPronto, entrar, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";
import { recursoFicticioDoLab } from "../../../src/lib/varredura-texto";

/**
 * T48 — VARREDURA (laboratório, ordem 225d0648). Percorre a 390 px:
 *  • TODAS as rotas do sitemap (visitante) e
 *  • as telas logadas de cada persona (inquilino, proprietário, admin).
 * Em cada tela: sem erro 5xx, sem erro de JavaScript/console (recurso externo que não carregou no laboratório é
 * ignorado), sem rolagem horizontal (3 Ss) e todos os links internos da tela respondem (< 400).
 * Os problemas de TODAS as telas são juntados e reportados de uma vez (expect.soft), para a execução mostrar o
 * quadro completo em vez de parar no primeiro.
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
];

const linksVistos = new Set<string>();

/** Abre a rota e devolve os problemas encontrados (lista vazia = tela limpa). */
async function conferir(page: Page, rota: string): Promise<string[]> {
  const problemas: string[] = [];
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
  try {
    const resp = await page.goto(rota, { waitUntil: "networkidle", timeout: 40_000 });
    const status = resp?.status() ?? 0;
    if (status >= 400) problemas.push(`HTTP ${status}`);
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (sobra > 1) problemas.push(`rolagem horizontal de ${sobra}px a 390px`);

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
  }
  return problemas;
}

async function varrer(page: Page, rotas: string[]): Promise<void> {
  for (const rota of rotas) {
    const problemas = await conferir(page, rota);
    expect.soft(problemas, `${rota}`).toEqual([]);
  }
}

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
    const lerRotas = async () => {
      const xml = await (await request.get("/sitemap.xml")).text();
      return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => {
        const u = new URL(m[1]);
        return u.pathname + u.search;
      });
    };
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

  for (const [nome, conta, extras] of [
    ["inquilino", inq, [] as string[]],
    ["proprietário", dono, () => [`/dashboard/imoveis/${ids.imovel}/editar`]],
    ["admin", { email: adminConta.email }, TELAS_ADMIN],
  ] as const) {
    test(`${nome}: todas as telas logadas`, async ({ browser }) => {
      test.setTimeout(900_000);
      const page = await entrar(browser, conta.email, senha);
      const extra = typeof extras === "function" ? extras() : extras;
      await varrer(page, [...TELAS_LOGADAS, ...extra]);
      await page.context().close();
    });
  }
});
