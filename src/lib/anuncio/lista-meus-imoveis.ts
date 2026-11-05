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
