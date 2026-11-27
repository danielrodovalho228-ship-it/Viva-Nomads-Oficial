/**
 * E1244 (ORDEM-DUET 1233, texto do coordenador): a legenda da fila da Central segue o estado da opção
 * "Incluir simulações". Puro.
 */
export const LEGENDA_SEM_SIMULACOES = "Simulações ficam fora. Ligue 'Incluir simulações' para vê-las.";
export const LEGENDA_COM_SIMULACOES = "Incluindo simulações, marcadas como 'Simulação'. Elas não entram nos números.";

export function legendaDaFila(ligada: boolean): string {
  return ligada ? LEGENDA_COM_SIMULACOES : LEGENDA_SEM_SIMULACOES;
}
