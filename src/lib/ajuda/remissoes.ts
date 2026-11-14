/*
  E906: as remissões internas das respostas da Ajuda e dos guias viram links. Só os destinos VIVOS da lista entram; /precos
  (suspensa, E563) e qualquer outro caminho ficam como texto. PURO: a tela desenha os pedaços (TextoComRemissoes).
*/
export const DESTINOS_REMISSAO = ["/parceiros/buscar", "/parceiros/fotografos", "/parceiros", "/empresas", "/auth", "/seguranca"] as const;

// Os mais longos primeiro (para /parceiros/buscar não virar /parceiros + texto); depois do caminho, nada que o continue.
const RE = new RegExp(`(${[...DESTINOS_REMISSAO].sort((a, b) => b.length - a.length).map((d) => d.replace(/\//g, "\\/")).join("|")})(?![\\w/-])`, "g");

export interface PedacoRemissao {
  texto: string;
  href: string | null;
}

export function pedacosComRemissoes(texto: string): PedacoRemissao[] {
  const out: PedacoRemissao[] = [];
  let i = 0;
  for (const m of texto.matchAll(RE)) {
    const ini = m.index ?? 0;
    if (ini > i) out.push({ texto: texto.slice(i, ini), href: null });
    out.push({ texto: m[0], href: m[0] });
    i = ini + m[0].length;
  }
  if (i < texto.length) out.push({ texto: texto.slice(i), href: null });
  return out;
}
