/*
  (B) da nota do desenho da pilha (ORDENS-DUET 1096, 1098 e 1107) — o teto do registro da caução. PURO (node --test).
  A conta é a ACUMULADA da decisão do coordenador para o E1225 (caução por bloco), escrita já aqui para o avulso não ser
  reescrito depois: o que ainda pode ser registrado de caução até ao bloco k = a soma das cauções dos blocos 1..k − a
  caução já registrada e ATIVA. Hoje o registro é um por contrato, e o teto é o do último bloco (a soma inteira).
  Um registro antigo maior cobre os blocos seguintes; um menor deixa a diferença em aberto. Nenhuma linha muda.
*/
import { formatBRLExato } from "./precos.ts";

const c2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function caucaoEmAbertoAte(blocos: readonly { numero: number; caucao: number }[], registradoAtivo: number, ateBloco?: number): number {
  const k = ateBloco ?? Math.max(0, ...blocos.map((b) => b.numero));
  const soma = blocos.filter((b) => b.numero <= k).reduce((s, b) => s + Math.max(0, Number(b.caucao) || 0), 0);
  return c2(Math.max(0, soma - Math.max(0, Number(registradoAtivo) || 0)));
}

/** ORDEM-DUET-1112: o registro de caução acima do que falta — a recusa diz quanto falta (ORDEM-DUET-1115: pelo formatBRLExato da casa). */
export const msgCaucaoPassa = (emAberto: number) => `O valor é maior que a caução que falta registrar neste contrato: ${formatBRLExato(emAberto)}.`;
/** ORDEM-DUET-1112: caução 0 em todos os blocos lidos — a garantia do contrato é outra. */
export const MSG_CAUCAO_SEM_CAUCAO = "Este contrato não tem caução: a garantia é outra (por exemplo, seguro-fiança).";
/** Sem a conta da caução lida (ou sem bloco nenhum lido), não se grava. */
export const MSG_CAUCAO_SEM_CONTA = "Não foi possível conferir a caução deste contrato. Tente de novo em instantes.";

/** E1225 (texto da ORDEM-DUET-1132): o bloco cuja caução já está coberta pelo que foi registrado. */
export const MSG_CAUCAO_NADA_NO_BLOCO = "Nada a registrar neste bloco: a caução já registrada cobre este bloco.";
/** E1225 (ORDEM-DUET-1132): a caução entra pela ordem dos blocos (a regra da tela). */
export const msgCaucaoRegistreAntes = (numero: number) => `Registre antes a caução do bloco ${numero}.`;
/** E1225 (ORDEM-DUET-1132): um registro novo de caução exige o bloco. */
export const MSG_CAUCAO_ESCOLHA_O_BLOCO = "Escolha o bloco da caução.";

/** E1225: a linha de um bloco no cartão da caução (o registro dele, ou o que falta nele). */
export interface LinhaCaucaoBloco {
  id: string;
  numero: number;
  caucao: number;
  /** A caução registada NESTE bloco (ativa), se houver. */
  registro: { id: string; valor: number; confirmado: boolean } | null;
  /** O que falta no bloco: min(caução do bloco, o teto acumulado até ele). 0 = nada a registrar. */
  emAberto: number;
  /** Só o 1.º bloco com algo em aberto (por ordem) oferece o registro. */
  oferecer: boolean;
}

/**
 * E1225 (ORDENS-DUET 1120 e 1127): as linhas da caução por bloco, na ordem dos blocos, só dos que têm caução. O teto é
 * o acumulado (caucaoEmAbertoAte); a caução já registada e ativa conta toda (com ou sem bloco). PURO.
 */
export function linhasDaCaucaoPorBloco(
  blocos: readonly { id: string; numero: number; caucao: number }[],
  pagamentos: readonly { id: string; blocoId: string | null; tipo: string; valor: number; confirmado: boolean }[],
): LinhaCaucaoBloco[] {
  const caucoes = pagamentos.filter((p) => p.tipo === "caucao");
  const registrado = caucoes.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const todos = blocos.map((b) => ({ numero: b.numero, caucao: Number(b.caucao) || 0 }));
  let jaOfereceu = false;
  return [...blocos]
    .filter((b) => (Number(b.caucao) || 0) > 0)
    .sort((a, b) => a.numero - b.numero)
    .map((b) => {
      const proprio = caucoes.find((p) => p.blocoId === b.id) ?? null;
      const emAberto = proprio ? 0 : c2(Math.min(Number(b.caucao) || 0, caucaoEmAbertoAte(todos, registrado, b.numero)));
      const oferecer = !proprio && emAberto > 0 && !jaOfereceu;
      if (oferecer) jaOfereceu = true;
      return { id: b.id, numero: b.numero, caucao: Number(b.caucao) || 0, registro: proprio ? { id: proprio.id, valor: Number(proprio.valor), confirmado: proprio.confirmado } : null, emAberto, oferecer };
    });
}
