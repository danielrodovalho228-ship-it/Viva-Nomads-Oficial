/*
  E136 (QA ao vivo do Muse, 25/10): o pop-up do seletor de datas do navegador vem no idioma do NAVEGADOR ("November
  2026", "Clear", "Today", "Sunday, November 1, 2026") e não obedece à página. O calendário do site é nosso e sempre em
  pt-BR. PURO: a grade do mês e os textos, sem tela.
*/
export const MESES_BR = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;
export const DIAS_SEMANA_BR = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"] as const;
/** Cabeçalho das colunas (domingo primeiro, como o calendário brasileiro). */
export const INICIAIS_SEMANA_BR = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

export const TEXTOS_CALENDARIO = {
  anterior: "Mês anterior",
  proximo: "Próximo mês",
  limpar: "Limpar",
  hoje: "Hoje",
  fechar: "Fechar calendário",
} as const;

const doisDigitos = (n: number) => String(n).padStart(2, "0");
export const isoDe = (ano: number, mes0: number, dia: number) => `${ano}-${doisDigitos(mes0 + 1)}-${doisDigitos(dia)}`;

/** "novembro de 2026" */
export function tituloMesBR(ano: number, mes0: number): string {
  return `${MESES_BR[mes0]} de ${ano}`;
}

/** "domingo, 1 de novembro de 2026" — o rótulo acessível de cada dia. */
export function rotuloDiaBR(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return `${DIAS_SEMANA_BR[dia]}, ${d} de ${MESES_BR[m - 1]} de ${a}`;
}

/** As semanas do mês (domingo a sábado); null = célula vazia antes do dia 1 ou depois do último dia. */
export function gradeDoMes(ano: number, mes0: number): (string | null)[][] {
  const primeiro = new Date(Date.UTC(ano, mes0, 1)).getUTCDay();
  const total = new Date(Date.UTC(ano, mes0 + 1, 0)).getUTCDate();
  const celulas: (string | null)[] = [...Array(primeiro).fill(null), ...Array.from({ length: total }, (_, i) => isoDe(ano, mes0, i + 1))];
  while (celulas.length % 7) celulas.push(null);
  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

/** Mês vizinho (delta −1 ou +1). */
export function mesVizinho(ano: number, mes0: number, delta: number): { ano: number; mes0: number } {
  const t = ano * 12 + mes0 + delta;
  return { ano: Math.floor(t / 12), mes0: ((t % 12) + 12) % 12 };
}

/** Hoje em Brasília, em ISO. */
export function hojeIsoBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** Ano e mês (0–11) de uma data ISO. */
export function mesDe(iso: string): { ano: number; mes0: number } {
  const [a, m] = iso.split("-").map(Number);
  return { ano: a, mes0: m - 1 };
}

/** A data ISO n dias depois (ou antes, com n negativo) — para andar pelo calendário com as setas. */
export function somarDias(iso: string, n: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + n));
  return isoDe(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}
