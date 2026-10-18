import { test, expect } from "@playwright/test";
import { NO_LABORATORIO, apagarContas, criarConta, criarImovelPronto, fotosReais, novaSenha, novoSufixo } from "../fixtures/laboratorio";

/**
 * T197 — Anúncio de teste oculto (ordem 781efe8c, complemento da 1d95c06e item 3; regra fa84ea52).
 * Anúncio ativo cujo título começa por "[TESTE ...]" não aparece para o visitante em /, /buscar, /cidades/uberlandia
 * nem na 404, a 390 e a 1280 px; fica fora do sitemap.xml e a página dele (aberta pelo link) é noindex.
 * Contraprova: um anúncio ativo normal do mesmo dono aparece no sitemap (a regra não esconde o que deve aparecer).
 */
const senha = novaSenha();
const sufixo = novoSufixo();
const dono = { email: `dono.teste.${sufixo}@lab.vivanomads.test`, nome: "Tadeu Teste Dono", role: "owner" as const };
const MARCA = `[TESTE QA ${sufixo}]`;
const ids: { dono?: string; teste?: string; normal?: string } = {};

const TELAS = ["/", "/buscar", "/cidades/uberlandia", `/pagina-que-nao-existe-${sufixo}`];
const LARGURAS = [
  { largura: 390, altura: 844 },
  { largura: 1280, altura: 800 },
];

test.describe("T197 — Anúncio de teste oculto @seo", () => {
  test.skip(!NO_LABORATORIO, "Só no laboratório.");
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    ids.dono = await criarConta(dono, senha);
    ids.teste = await criarImovelPronto(ids.dono, `${MARCA} Studio oculto`, { ativo: true });
    await fotosReais(ids.teste, ids.dono);
    ids.normal = await criarImovelPronto(ids.dono, `Studio visível ${sufixo}`, { ativo: true });
    await fotosReais(ids.normal, ids.dono);
  });

  test.afterAll(async () => {
    await apagarContas([ids.dono]);
  });

  for (const { largura, altura } of LARGURAS) {
    test(`${largura} px: nenhuma tela pública mostra o título [TESTE`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: altura });
      for (const rota of TELAS) {
        await page.goto(rota, { waitUntil: "domcontentloaded" });
        const corpo = (await page.locator("body").innerText()).toLowerCase();
        expect(corpo, `${rota} @${largura} mostra o anúncio de teste`).not.toContain(MARCA.toLowerCase());
        expect(corpo, `${rota} @${largura} mostra algum título [TESTE`).not.toMatch(/\[teste[^\]]*\]/);
      }
    });
  }

  test("sitemap.xml sem o anúncio de teste e com o anúncio normal", async ({ request }) => {
    const lerLocs = async () => {
      const xml = await (await request.get("/sitemap.xml")).text();
      return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    };
    // O sitemap tem cache de 60 s: espera o anúncio normal aparecer e só então confere a ausência do de teste.
    await expect
      .poll(async () => (await lerLocs()).includes(`/imoveis/${ids.normal}`), {
        message: "o anúncio normal entra no sitemap (cache de 60 s)",
        timeout: 120_000,
        intervals: [5_000],
      })
      .toBe(true);
    expect(await lerLocs()).not.toContain(`/imoveis/${ids.teste}`);
  });

  test("a página do anúncio de teste (pelo link) é noindex; a do normal é indexável", async ({ page }) => {
    const robots = async (id: string | undefined) => {
      await page.goto(`/imoveis/${id}`, { waitUntil: "domcontentloaded" });
      return (await page.locator('meta[name="robots"]').first().getAttribute("content").catch(() => null)) ?? "";
    };
    expect(await robots(ids.teste)).toMatch(/noindex/);
    expect(await robots(ids.normal)).not.toMatch(/noindex/);
  });
});
