/*
  (B) da nota do desenho da pilha (ORDENS-DUET 1096, 1098 e 1107) — o teto do registro da caução. PURO (node --test).
  A conta é a ACUMULADA da decisão do coordenador para o E1225 (caução por bloco), escrita já aqui para o avulso não ser
  reescrito depois: o que ainda pode ser registrado de caução até ao bloco k = a soma das cauções dos blocos 1..k − a
  caução já registrada e ATIVA. Hoje o registro é um por contrato, e o teto é o do último bloco (a soma inteira).
  Um registro antigo maior cobre os blocos seguintes; um menor deixa a diferença em aberto. Nenhuma linha muda.
*/
const c2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export function caucaoEmAbertoAte(blocos: readonly { numero: number; caucao: number }[], registradoAtivo: number, ateBloco?: number): number {
  const k = ateBloco ?? Math.max(0, ...blocos.map((b) => b.numero));
  const soma = blocos.filter((b) => b.numero <= k).reduce((s, b) => s + Math.max(0, Number(b.caucao) || 0), 0);
  return c2(Math.max(0, soma - Math.max(0, Number(registradoAtivo) || 0)));
}

/** PROPOSTA DE TEXTO: o registro de caução acima do que falta. */
export const MSG_CAUCAO_PASSA = "O valor passa da caução do contrato que falta registrar.";
/** PROPOSTA DE TEXTO: sem a conta da caução lida, não se grava. */
export const MSG_CAUCAO_SEM_CONTA = "Não foi possível conferir a caução deste contrato. Tente de novo em instantes.";
