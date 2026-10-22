import { test, expect } from "@playwright/test";
import { lerMetadados, problemaDeMetadado } from "../fixtures/exif";
import { PAGINAS_PUBLICAS } from "../fixtures/varredura-pagina";

/*
  T278 — EXIF/GPS nas imagens que o site SERVE (estudo de segurança, validação do coordenador, 22/10).
  Abre cada página pública da varredura (t274), rola até o fim e baixa TODA imagem que o navegador recebeu: o arquivo
  servido e, quando vem pelo otimizador do Next (/_next/image?url=…), também o ORIGINAL, que fica público no depósito
  (property-photos, parceiros) e qualquer um baixa direto. Reprova se algum tiver EXIF ou GPS.
  Roda contra qualquer alvo: produção (npm run testes:publico) ou o laboratório. Os depósitos privados (conferência,
  entregas, pets) são conferidos onde a foto entra, pelos fluxos reais: t85, t250, t73 e t236.
*/
const TERCEIROS = /mapbox|maps\.googleapis|maps\.gstatic|googletagmanager|google-analytics|doubleclick|\/tiles?\//i;

test.describe("T278 — imagens servidas sem EXIF nem GPS (visitante)", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "chromium", "só chromium"));

  test("toda imagem das páginas públicas, e o original de cada uma, sai sem EXIF e sem GPS", async ({ browser, request }) => {
    test.setTimeout(300_000);
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const urls = new Set<string>();
    page.on("response", (r) => {
      if (r.request().resourceType() === "image" && r.ok() && !TERCEIROS.test(r.url())) urls.add(r.url());
    });
    const visitadas: string[] = [];
    for (const p of PAGINAS_PUBLICAS) {
      const rota = typeof p.rota === "string" ? p.rota : await p.rota(request);
      if (!rota) continue;
      const resp = await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 40_000 }).catch(() => null);
      if (!resp || resp.status() >= 400) continue;
      visitadas.push(rota);
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight * 0.8) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 150));
        }
      });
      await page.waitForTimeout(800);
    }
    await ctx.close();

    // O servido e, atrás do otimizador do Next, o original público.
    const alvos = new Map<string, string>(); // url → de onde veio
    for (const u of urls) {
      alvos.set(u, "servida");
      const url = new URL(u);
      const original = url.pathname === "/_next/image" ? url.searchParams.get("url") : null;
      if (original) alvos.set(new URL(original, url.origin).toString(), "original atrás do /_next/image");
    }
    const problemas: string[] = [];
    let conferidas = 0;
    for (const [u, origem] of alvos) {
      const r = await request.get(u, { timeout: 30_000 }).catch(() => null);
      if (!r?.ok()) continue;
      conferidas++;
      const m = lerMetadados(await r.body());
      const p = problemaDeMetadado(m);
      if (p) {
        const curta = u.replace(/^https?:\/\/[^/]+/, "").slice(0, 160);
        problemas.push(`${curta} (${m.formato}, ${origem}): ${p}`);
        console.log(`EXIF|${origem}|${m.formato}|${p}|${u.slice(0, 220)}`);
      }
    }
    console.log(`EXIF|resumo|${visitadas.length} páginas, ${urls.size} imagens servidas, ${conferidas} arquivos conferidos, ${problemas.length} com metadado`);
    expect(conferidas, "nenhuma imagem baixada: a varredura não conferiu nada").toBeGreaterThan(0);
    expect(problemas, "imagem servida (ou o original público dela) com EXIF/GPS").toEqual([]);
  });
});
