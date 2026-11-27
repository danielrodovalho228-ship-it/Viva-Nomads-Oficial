/**
 * E466 (i): o mini-calendário da Agenda do parceiro navega por mês e os dias são clicáveis (o dia escolhido filtra os
 * horários da lista). PURO — meses de 0 a 11, como a grade (lib/calendario/grade).
 */
export interface ItemAgendaParceiro {
  id: string;
  /** Dia em Brasília (AAAA-MM-DD) do horário combinado. */
  dia: string;
  quando: string;
  categoria: string;
  /** E1103: para onde o item leva. Sem ele, é um pedido de serviço. */
  href?: string;
  /** E1103: o instante (ISO) do horário, para ordenar pedidos de serviço e visitas de avaliação juntos. */
  em?: string;
}

/** E1103: o destino de um item da Agenda — o pedido de serviço, ou a tela que o item indicar (a visita de avaliação). */
export function hrefDoItemDaAgenda(i: ItemAgendaParceiro): string {
  return i.href ?? `/dashboard/servicos/pedidos/${i.id}`;
}

/** E1103: uma agenda só, do mais próximo ao mais distante (os itens sem instante ficam no fim, na ordem em que vieram). */
export function ordenarAgenda(itens: readonly ItemAgendaParceiro[]): ItemAgendaParceiro[] {
  const t = (i: ItemAgendaParceiro) => (i.em ? Date.parse(i.em) : Number.POSITIVE_INFINITY);
  return itens.map((i, n) => ({ i, n })).sort((a, b) => t(a.i) - t(b.i) || a.n - b.n).map((x) => x.i);
}

export function moverMesGrade(c: { ano: number; mes: number }, delta: number): { ano: number; mes: number } {
  const t = c.ano * 12 + c.mes + delta;
  return { ano: Math.floor(t / 12), mes: ((t % 12) + 12) % 12 };
}

/** Os horários da lista: todos, ou só os do dia escolhido. */
export function itensDaAgenda(itens: readonly ItemAgendaParceiro[], dia: string | null): ItemAgendaParceiro[] {
  return dia ? itens.filter((i) => i.dia === dia) : [...itens];
}
