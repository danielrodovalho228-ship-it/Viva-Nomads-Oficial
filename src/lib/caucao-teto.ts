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

/** Reais com centavos (R$ 2.750,50): o teto pode ter centavos, e o formatBRL de utils arredonda para o real. */
const reais = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/** ORDEM-DUET-1112: o registro de caução acima do que falta — a recusa diz quanto falta. */
export const msgCaucaoPassa = (emAberto: number) => `O valor é maior que a caução que falta registrar neste contrato: ${reais(emAberto)}.`;
/** ORDEM-DUET-1112: caução 0 em todos os blocos lidos — a garantia do contrato é outra. */
export const MSG_CAUCAO_SEM_CAUCAO = "Este contrato não tem caução: a garantia é outra (por exemplo, seguro-fiança).";
/** Sem a conta da caução lida (ou sem bloco nenhum lido), não se grava. */
export const MSG_CAUCAO_SEM_CONTA = "Não foi possível conferir a caução deste contrato. Tente de novo em instantes.";
