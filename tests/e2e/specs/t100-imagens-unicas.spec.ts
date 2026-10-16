import { test, expect, type Page } from "@playwright/test";

/**
 * T100 — ordem 19b8abf5: imagens únicas no site. Em cada página pública, no computador e
 * no celular: toda imagem decorativa carrega (sem quebra) e nenhuma se repete na mesma
 * página nem entre páginas. Fotos de ANÚNCIO (cards e links de imóvel), logo, avatares e
 * mapa ficam de fora — a foto do imóvel acompanha o imóvel onde ele aparecer.
 */
const PAGINAS = ["/", "/como-funciona", "/para-proprietarios", "/parceiros", "/empresas", "/precos", "/buscar"];
/** Mesmo elemento/estado (não é repetição na tela). */
const PERMITIDAS = new Set(["/media/hero-home-poster.webp"]);

async function decorativas(page: Page): Promise<{ src: string; ok: boolean }[]> {
  // Leva cada imagem à tela (carregamento preguiçoso) e espera decodificar antes de conferir.
  await page.$$eval("img", async (imgs) => {
    for (const img of imgs as HTMLImageElement[]) {
      img.scrollIntoView({ block: "center" });
      await Promise.race([img.decode().catch(() => undefined), new Promise((r) => setTimeout(r, 4000))]);
    }
    window.scrollTo(0, 0);
  });
  return page.$$eval("img", (imgs) =>
    imgs
      .filter((img) => !img.closest('a[href^="/imoveis/"], [data-testid="card-resultado"], [data-testid="mapa-busca"], header, footer'))
      .map((img) => {
        const bruto = img.currentSrc || img.src;
        let src = bruto;
        try {
          const u = new URL(bruto, location.origin);
          src = u.pathname === "/_next/image" ? decodeURIComponent(u.searchParams.get("url") ?? "") : u.pathname;
        } catch {}
        return { src, ok: img.complete && img.naturalWidth > 0 };
      })
      .filter((i) => i.src.startsWith("/") && !/\/(brand|icons?|logo|agentes)\//.test(i.src) && !/avatar/.test(i.src))
  );
}

for (const largura of [1440, 390]) {
  test(`${largura} px: nenhuma imagem decorativa quebrada ou repetida nas páginas públicas`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: largura, height: largura > 500 ? 900 : 844 });
    const vistas = new Map<string, string>();
    const problemas: string[] = [];
    for (const rota of PAGINAS) {
      await page.goto(rota, { waitUntil: "networkidle" });
      const imgs = await decorativas(page);
      const nestaPagina = new Set<string>();
      for (const { src, ok } of imgs) {
        if (!ok) problemas.push(`${rota}: não carregou ${src}`);
        if (PERMITIDAS.has(src)) continue;
        if (nestaPagina.has(src)) problemas.push(`${rota}: repetida na página ${src}`);
        nestaPagina.add(src);
        const antes = vistas.get(src);
        if (antes && antes !== rota) problemas.push(`${src}: em ${antes} e ${rota}`);
        vistas.set(src, antes ?? rota);
      }
    }
    expect(vistas.size, "a varredura achou imagens").toBeGreaterThan(10);
    expect(problemas).toEqual([]);
  });
}
