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

/*
  E941 (Gerente, decidido): toda resposta da Ajuda que NOMEIA um destino (página, fluxo, caminho) liga-o dentro do próprio
  texto — o botão por baixo da resposta não conta. Cada entrada diz o trecho que vira link (o nome do destino, tal como a
  resposta o escreve) e o destino público. Resposta que não nomeia nada não ganha link. Só destinos que um visitante abre.
*/
export const LIGACOES_NOMEADAS: readonly { trecho: RegExp; href: string }[] = [
  { trecho: /publicar um Pedido de Moradia/i, href: "/pedidos" },
  { trecho: /Pedidos de moradia/i, href: "/pedidos" },
  { trecho: /Entre na sua conta/i, href: "/auth" },
  { trecho: /abra um chamado/i, href: "/ajuda/fale-com-a-viva" },
  { trecho: /(?<=página )Conferir documento/i, href: "/conferir" },
  { trecho: /(?<=página )Excluir conta/i, href: "/excluir-conta" },
  { trecho: /(?<=(?:tela|em) )Entrar\b/, href: "/auth" },
];

/** O primeiro nome de destino no texto (o mais à esquerda; empate: o mais longo). */
function primeiroNomeado(texto: string): { ini: number; fim: number; href: string } | null {
  let melhor: { ini: number; fim: number; href: string } | null = null;
  for (const l of LIGACOES_NOMEADAS) {
    const m = new RegExp(l.trecho.source, l.trecho.flags.replace("g", "")).exec(texto);
    if (!m) continue;
    const ini = m.index;
    const fim = ini + m[0].length;
    if (!melhor || ini < melhor.ini || (ini === melhor.ini && fim > melhor.fim)) melhor = { ini, fim, href: l.href };
  }
  return melhor;
}

/** As remissões (caminhos) e, nos pedaços que sobram, os destinos NOMEADOS das respostas da Ajuda (E941). */
export function pedacosComLigacoes(texto: string): PedacoRemissao[] {
  return pedacosComRemissoes(texto).flatMap((p) => {
    if (p.href) return [p];
    const out: PedacoRemissao[] = [];
    let resto = p.texto;
    for (let m = primeiroNomeado(resto); m; m = primeiroNomeado(resto)) {
      if (m.ini > 0) out.push({ texto: resto.slice(0, m.ini), href: null });
      out.push({ texto: resto.slice(m.ini, m.fim), href: m.href });
      resto = resto.slice(m.fim);
    }
    if (resto) out.push({ texto: resto, href: null });
    return out;
  });
}
