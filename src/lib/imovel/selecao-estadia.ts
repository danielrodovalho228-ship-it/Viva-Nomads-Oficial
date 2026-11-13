/**
 * E53 — seleção da estadia na página do imóvel: UMA fonte só para o calendário de Disponibilidade, a caixa de reserva
 * e o diálogo do "Solicitar". Puro: sem tela, sem banco. Datas em ISO (yyyy-mm-dd), comparadas como texto, sem fuso.
 */

export interface SelecaoEstadia {
  /** "" = ainda não escolhida. */
  entrada: string;
  saida: string;
  pessoas: number;
  /** E816: a entrada veio da última busca guardada no aparelho (não foi escolhida nesta página). */
  entradaDaBusca?: boolean;
}

export const SELECAO_VAZIA: SelecaoEstadia = { entrada: "", saida: "", pessoas: 1 };

const ISO_DIA = /^\d{4}-\d{2}-\d{2}$/;
const valida = (iso: string) => ISO_DIA.test(iso);

/** E816: escolha feita nesta página tira a marca de "veio da busca". */
function semMarca(sel: SelecaoEstadia): SelecaoEstadia {
  const { entradaDaBusca: _origem, ...resto } = sel;
  void _origem;
  return resto;
}

/** Clique no calendário: 1º clique (ou reinício) = entrada; 2º = saída se for depois, senão vira a nova entrada. */
export function clicarDia(sel: SelecaoEstadia, iso: string): SelecaoEstadia {
  if (!sel.entrada || sel.saida || iso <= sel.entrada) return { ...semMarca(sel), entrada: iso, saida: "" };
  return { ...semMarca(sel), saida: iso };
}

/** Entrada mudada no campo (caixa ou diálogo): a saída que ficaria antes ou no mesmo dia cai. */
export function comEntrada(sel: SelecaoEstadia, iso: string): SelecaoEstadia {
  return { ...semMarca(sel), entrada: iso, saida: sel.saida && iso && sel.saida <= iso ? "" : sel.saida };
}

/** E816: a entrada pré-preenchida pela última busca — marcada como tal (a tela diz de onde veio e deixa limpar). */
export function comEntradaDaBusca(sel: SelecaoEstadia, iso: string): SelecaoEstadia {
  return { ...comEntrada(sel, iso), entradaDaBusca: true };
}

/** E816: limpar a data que veio da busca — volta ao estado sem escolha (as pessoas ficam). */
export function semDatas(sel: SelecaoEstadia): SelecaoEstadia {
  return { ...SELECAO_VAZIA, pessoas: sel.pessoas };
}

/**
 * E816 — o texto do resumo da seleção. O estado inicial NUNCA simula escolha feita: a entrada que veio da última busca
 * diz que veio de lá ("da sua última busca"), e não "agora escolha a saída" como se a pessoa tivesse escolhido.
 */
export function textoDaSelecao(sel: Pick<SelecaoEstadia, "entrada" | "saida" | "entradaDaBusca">): string | null {
  if (!valida(sel.entrada)) return null;
  if (sel.saida) return null; // com as duas datas, a tela mostra o período
  return sel.entradaDaBusca
    ? `Entrada ${br(sel.entrada)}, da sua última busca (não escolhida aqui). Escolha a saída ou toque em outra data para trocar.`
    : `Entrada ${br(sel.entrada)} — agora escolha a saída.`;
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

const brDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const somaDias = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * E517 — a data de entrada que vem da BUSCA só pré-seleciona se couber NESTE anúncio: dentro da disponibilidade
 * (a partir de availableFrom, nunca no passado) e com espaço para a estadia mínima antes de availableUntil. Senão a
 * página abre SEM seleção e com o aviso claro (antes: 15/11 vinha marcada num anúncio que só aceita a partir de 21/11,
 * e escolher a saída gerava 15/11→21/11, 6 dias, abaixo do mínimo, com só um aviso).
 */
export function entradaDaBusca(
  inicio: string,
  a: { availableFrom?: string | null; availableUntil?: string | null; minDias?: number | null; hoje: string },
): { entrada: string; aviso: string | null } {
  if (!inicio || !valida(inicio)) return { entrada: "", aviso: null };
  const de = a.availableFrom && valida(a.availableFrom.slice(0, 10)) ? a.availableFrom.slice(0, 10) : null;
  const ate = a.availableUntil && valida(a.availableUntil.slice(0, 10)) ? a.availableUntil.slice(0, 10) : null;
  const primeira = de && de > a.hoje ? de : a.hoje;
  const min = a.minDias && a.minDias > 0 ? a.minDias : 30;
  if (inicio < primeira) {
    return { entrada: "", aviso: `A data da sua busca (${brDia(inicio)}) não está disponível neste imóvel: a entrada é a partir de ${brDia(primeira)}. Escolha as datas no calendário.` };
  }
  if (ate && somaDias(inicio, min) > ate) {
    return { entrada: "", aviso: `A data da sua busca (${brDia(inicio)}) não comporta a estadia mínima de ${min} dias neste imóvel (disponível até ${brDia(ate)}). Escolha as datas no calendário.` };
  }
  return { entrada: inicio, aviso: null };
}
