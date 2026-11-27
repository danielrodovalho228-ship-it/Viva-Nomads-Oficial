/*
  E511 — a lista de Meus imóveis com abas de estado, busca, ordenação e "Mostrar mais" (antes: 27+ cartões de uma vez,
  sem nada para achar um imóvel). PURO: a tela só guarda a escolha e desenha o resultado.
   • Abas: Todos · Ativos · Pausados · Rascunhos, cada uma com a contagem (aba sem imóvel some, exceto "Todos").
   • Busca: título, bairro ou cidade, sem diferenciar maiúsculas nem acentos.
   • Ordem: "Mais recentes" (a ordem do servidor, created_at desc), "Nome (A–Z)", "Maior valor", "Menor valor".
   • Página: POR_PAGINA cartões; "Mostrar mais" soma outra página.
*/
export type AbaEstado = "todos" | "active" | "paused" | "draft";
export type OrdemLista = "recentes" | "nome" | "maior_valor" | "menor_valor";

export const POR_PAGINA = 12;

export const ABAS_ESTADO: readonly { id: AbaEstado; rotulo: string }[] = [
  { id: "todos", rotulo: "Todos" },
  { id: "active", rotulo: "Ativos" },
  { id: "paused", rotulo: "Pausados" },
  { id: "draft", rotulo: "Rascunhos" },
];

export const ORDENS: readonly { id: OrdemLista; rotulo: string }[] = [
  { id: "recentes", rotulo: "Mais recentes" },
  { id: "nome", rotulo: "Nome (A–Z)" },
  { id: "maior_valor", rotulo: "Maior valor" },
  { id: "menor_valor", rotulo: "Menor valor" },
];

export interface ItemLista {
  id: string;
  status: "active" | "paused" | "draft";
  title: string;
  neighborhood?: string | null;
  city?: string | null;
  monthlyPrice?: number | null;
}

const normal = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Contagem por aba (Todos = o total). */
export function contagemPorAba(itens: readonly ItemLista[]): Record<AbaEstado, number> {
  const c: Record<AbaEstado, number> = { todos: itens.length, active: 0, paused: 0, draft: 0 };
  for (const i of itens) c[i.status] += 1;
  return c;
}

/** As abas que aparecem: "Todos" sempre; as outras só com algum imóvel naquele estado. */
export function abasVisiveis(itens: readonly ItemLista[]) {
  const c = contagemPorAba(itens);
  return ABAS_ESTADO.filter((a) => a.id === "todos" || c[a.id] > 0).map((a) => ({ ...a, n: c[a.id] }));
}

/** A lista inteira depois da aba, da busca e da ordem (sem paginar). */
export function filtrarEOrdenar<T extends ItemLista>(itens: readonly T[], p: { aba: AbaEstado; busca: string; ordem: OrdemLista }): T[] {
  const q = normal(p.busca);
  const lista = itens.filter(
    (i) => (p.aba === "todos" || i.status === p.aba) && (!q || [i.title, i.neighborhood, i.city].some((c) => normal(c).includes(q))),
  );
  const valor = (i: T) => (typeof i.monthlyPrice === "number" && i.monthlyPrice > 0 ? i.monthlyPrice : null);
  if (p.ordem === "nome") return [...lista].sort((a, b) => normal(a.title).localeCompare(normal(b.title), "pt-BR"));
  if (p.ordem === "maior_valor" || p.ordem === "menor_valor") {
    const sinal = p.ordem === "maior_valor" ? -1 : 1;
    // Sem valor (rascunho sem preço) vai para o fim nas duas ordens.
    return [...lista].sort((a, b) => {
      const va = valor(a);
      const vb = valor(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return sinal * (va - vb);
    });
  }
  return lista; // "recentes": a ordem do servidor (created_at desc)
}

/** A página à vista: as primeiras `paginas × POR_PAGINA` e quantas faltam para o "Mostrar mais". */
export function paginar<T>(lista: readonly T[], paginas: number): { visiveis: T[]; restantes: number } {
  const n = Math.max(1, paginas) * POR_PAGINA;
  return { visiveis: lista.slice(0, n), restantes: Math.max(0, lista.length - n) };
}

/**
 * E514: as cópias abertas de um rascunho ("N cópias deste rascunho · ver") vêm logo depois do cartão-pai, na ordem do
 * grupo — antes, a ordem da lista (as cópias são mais antigas) as jogava para o fim. Cópia cujo pai não está na lista
 * (filtrado pela aba ou pela busca) fica onde estava.
 */
export function juntarCopiasAoPai<T extends { id: string }>(lista: readonly T[], copiasDe: ReadonlyMap<string, readonly string[]>): T[] {
  const porId = new Map(lista.map((p) => [p.id, p] as const));
  const presas = new Set<string>();
  for (const [pai, cs] of copiasDe) if (porId.has(pai)) for (const c of cs) if (porId.has(c)) presas.add(c);
  const out: T[] = [];
  for (const p of lista) {
    if (presas.has(p.id)) continue;
    out.push(p);
    for (const c of copiasDe.get(p.id) ?? []) if (presas.has(c)) out.push(porId.get(c)!);
  }
  return out;
}

/*
  E624 (ressalva da prova do E511, 05/11): os contadores de Meus imóveis divergiam na mesma tela — abas 29, "Mostrar
  mais (12 de 17)" / "(5 de 5)" e 31 com as cópias abertas. A unidade agora é UMA só, o ANÚNCIO: uma cópia de rascunho
  aberta aparece debaixo do cartão-pai, mas não conta nem ocupa vaga da página. Toda superfície (abas, "N imóveis",
  "Mostrando N de T", "Mostrar mais") lê `contagemDaLista`/`paginarAnuncios` — o mesmo número.
*/

/** Os anúncios da lista: tudo, menos as cópias de rascunho (que só aparecem abertas, sob o pai). */
export function anunciosDaLista<T extends { id: string }>(itens: readonly T[], copias: ReadonlySet<string>): T[] {
  return itens.filter((i) => !copias.has(i.id));
}

/**
 * A página de anúncios: conta só os anúncios (POR_PAGINA por página); cada cópia aberta vem junto do seu pai, sem
 * ocupar vaga. `lista` já vem na ordem da tela (juntarCopiasAoPai). Devolve o que desenhar e a contagem única.
 */
export function paginarAnuncios<T extends { id: string }>(
  lista: readonly T[],
  copias: ReadonlySet<string>,
  paginas: number,
): { visiveis: T[]; mostrados: number; total: number; restantes: number; copiasAbertas: number } {
  const limite = Math.max(1, paginas) * POR_PAGINA;
  const total = lista.filter((i) => !copias.has(i.id)).length;
  const visiveis: T[] = [];
  let mostrados = 0;
  let copiasAbertas = 0;
  for (const i of lista) {
    const ehCopia = copias.has(i.id);
    if (!ehCopia && mostrados >= limite) break;
    visiveis.push(i);
    if (ehCopia) copiasAbertas += 1;
    else mostrados += 1;
  }
  // visiveis.length === mostrados + copiasAbertas: a frase de contagem nomeia as duas parcelas (E624, 2ª prova).
  return { visiveis, mostrados, total, restantes: total - mostrados, copiasAbertas };
}

/**
 * "1 imóvel" / "N imóveis" — e, quando há mais páginas, "Mostrando M de N imóveis". Com cópias de rascunho abertas na tela, a
 * mesma frase as nomeia: "29 imóveis (+ 3 cópias de rascunho abertas)" — os cartões na tela sempre batem com o que ela diz.
 */
export function textoContagemLista(p: { mostrados: number; total: number; copiasAbertas?: number }): string {
  const n = p.total === 1 ? "1 imóvel" : `${p.total} imóveis`;
  const base = p.mostrados < p.total ? `Mostrando ${p.mostrados} de ${n}` : n;
  const c = p.copiasAbertas ?? 0;
  if (c <= 0) return base;
  return `${base} (+ ${c === 1 ? "1 cópia de rascunho aberta" : `${c} cópias de rascunho abertas`})`;
}

/** O botão: soma até mais uma página — "Mostrar mais 12" (ou o que faltar). */
export function textoMostrarMais(restantes: number): string {
  return `Mostrar mais ${Math.min(restantes, POR_PAGINA)}`;
}
