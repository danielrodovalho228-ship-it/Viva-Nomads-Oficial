/** Regras da varredura de SEO e peso do laboratório (ordem 21708cca, parte D). Funções puras, testadas em seo-regras.test.ts. */

/** Peso máximo (bytes transferidos, só o que o navegador baixa na carga) de cada página pública principal. */
export const PESO_MAX_BYTES = 2_500_000;

export type MetaPagina = { titulo: string; descricao: string; h1: string[]; canonical: string };

function texto(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

/** Lê título, descrição, H1 e canonical do HTML que o servidor entrega. */
export function extrairMeta(html: string): MetaPagina {
  const titulo = texto(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const descricao = (html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]
    ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1] ?? "").trim();
  const h1 = [...html.matchAll(/<h1[\s>][\s\S]*?<\/h1>/gi)].map((m) => texto(m[0]));
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i)?.[1] ?? "";
  return { titulo, descricao, h1, canonical };
}

/** Problemas de uma página sozinha: título, descrição e canonical presentes; exatamente um H1. */
export function problemasDaPagina(rota: string, m: MetaPagina): string[] {
  const p: string[] = [];
  if (!m.titulo) p.push(`${rota}: sem <title>`);
  if (!m.descricao) p.push(`${rota}: sem meta description`);
  if (m.h1.length !== 1) p.push(`${rota}: ${m.h1.length} H1 (esperado 1)`);
  if (!m.canonical) p.push(`${rota}: sem canonical`);
  return p;
}

/** Problemas entre páginas: título, descrição e H1 não podem se repetir. */
export function repetidos(paginas: Record<string, MetaPagina>): string[] {
  const out: string[] = [];
  for (const campo of ["titulo", "descricao", "h1"] as const) {
    const grupos = new Map<string, string[]>();
    for (const [rota, m] of Object.entries(paginas)) {
      const valor = campo === "h1" ? (m.h1[0] ?? "") : m[campo];
      if (!valor) continue;
      grupos.set(valor, [...(grupos.get(valor) ?? []), rota]);
    }
    for (const [valor, rotas] of grupos) if (rotas.length > 1) out.push(`${campo} repetido em ${rotas.join(", ")}: "${valor.slice(0, 60)}"`);
  }
  return out;
}

/** Caminhos (sem domínio) das <loc> de um sitemap.xml. */
export function caminhosDoSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => {
    try {
      const u = new URL(m[1]);
      return (u.pathname.replace(/\/+$/, "") || "/") + u.search;
    } catch {
      return m[1];
    }
  });
}

/** Links internos de uma página (href começando com "/", sem âncora, sem arquivos estáticos nem /api). */
export function linksInternos(html: string): string[] {
  const set = new Set<string>();
  for (const m of html.matchAll(/<a\s[^>]*href=["'](\/[^"'#?]*)(?:[?#][^"']*)?["']/gi)) {
    const href = m[1].replace(/\/+$/, "") || "/";
    if (href.startsWith("//") || href.startsWith("/api") || href.startsWith("/_next") || /\.[a-z0-9]{2,5}$/i.test(href)) continue;
    set.add(href);
  }
  return [...set];
}

export function pesoExcedido(rota: string, bytes: number, limite = PESO_MAX_BYTES): string {
  return bytes > limite ? `${rota}: ${(bytes / 1e6).toFixed(2)} MB acima do limite de ${(limite / 1e6).toFixed(2)} MB` : "";
}
