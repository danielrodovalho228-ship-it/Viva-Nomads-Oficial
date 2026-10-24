/**
 * E53 — seleção da estadia na página do imóvel: UMA fonte só para o calendário de Disponibilidade, a caixa de reserva
 * e o diálogo do "Solicitar". Puro: sem tela, sem banco. Datas em ISO (yyyy-mm-dd), comparadas como texto, sem fuso.
 */

export interface SelecaoEstadia {
  /** "" = ainda não escolhida. */
  entrada: string;
  saida: string;
  pessoas: number;
}

export const SELECAO_VAZIA: SelecaoEstadia = { entrada: "", saida: "", pessoas: 1 };

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const valida = (iso: string) => ISO_DIA.test(iso);

/** Clique no calendário: 1º clique (ou reinício) = entrada; 2º = saída se for depois, senão vira a nova entrada. */
export function clicarDia(sel: SelecaoEstadia, iso: string): SelecaoEstadia {
  if (!sel.entrada || sel.saida || iso <= sel.entrada) return { ...sel, entrada: iso, saida: "" };
  return { ...sel, saida: iso };
}

/** Entrada mudada no campo (caixa ou diálogo): a saída que ficaria antes ou no mesmo dia cai. */
export function comEntrada(sel: SelecaoEstadia, iso: string): SelecaoEstadia {
  return { ...sel, entrada: iso, saida: sel.saida && iso && sel.saida <= iso ? "" : sel.saida };
}

/** Saída mudada no campo. Fica como digitada; uma saída antes da entrada vira erro no resumo (não some calada). */
export function comSaida(sel: SelecaoEstadia, iso: string): SelecaoEstadia {
  return { ...sel, saida: iso };
}

export function comPessoas(sel: SelecaoEstadia, n: number): SelecaoEstadia {
  return { ...sel, pessoas: Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1 };
}

/** Dias entre a entrada e a saída (24/11 → 24/12 = 30); null sem as duas datas válidas e em ordem. */
export function diasDaSelecao(sel: Pick<SelecaoEstadia, "entrada" | "saida">): number | null {
  if (!valida(sel.entrada) || !valida(sel.saida) || sel.saida <= sel.entrada) return null;
  const ms = Date.parse(`${sel.saida}T12:00:00Z`) - Date.parse(`${sel.entrada}T12:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Meses do total da estadia pela seleção (30 dias = 1 mês, arredonda para cima); null sem período completo. */
export function mesesDaSelecao(sel: Pick<SelecaoEstadia, "entrada" | "saida">): number | null {
  const d = diasDaSelecao(sel);
  return d === null ? null : Math.max(1, Math.ceil(d / 30));
}

const br = (iso: string) => {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
};

/**
 * A saída ainda não tem coluna no pedido (só a entrada vai a leads.inicio_desejado): com o período completo, ele segue
 * numa linha da mensagem ao proprietário, para o dono ver as duas datas.
 */
export function linhaPeriodoNaMensagem(sel: Pick<SelecaoEstadia, "entrada" | "saida">): string | null {
  const d = diasDaSelecao(sel);
  return d === null ? null : `Período escolhido: ${br(sel.entrada)} a ${br(sel.saida)} (${d} ${d === 1 ? "dia" : "dias"}).`;
}
