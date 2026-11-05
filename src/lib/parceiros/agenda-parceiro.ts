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
}

export function moverMesGrade(c: { ano: number; mes: number }, delta: number): { ano: number; mes: number } {
  const t = c.ano * 12 + c.mes + delta;
  return { ano: Math.floor(t / 12), mes: ((t % 12) + 12) % 12 };
}

/** Os horários da lista: todos, ou só os do dia escolhido. */
export function itensDaAgenda(itens: readonly ItemAgendaParceiro[], dia: string | null): ItemAgendaParceiro[] {
  return dia ? itens.filter((i) => i.dia === dia) : [...itens];
}
