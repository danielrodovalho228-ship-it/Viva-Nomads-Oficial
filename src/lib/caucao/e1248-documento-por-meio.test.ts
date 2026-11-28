/*
  E1248 PR 1 — o comprovante conforme o meio (ESPEC-E1248 v11, secção 2.7; ORDENS-DUET 1337 e 1341). É UMA regra só: o
  nome do documento sai de uma função que recebe o meio registado, e o pedido, o lembrete do anexo, a linha do pedido no
  chamado e o motivo da decisão sem prova leem-na. Casos M38 a M41.
  Roda: node --test src/lib/caucao/e1248-documento-por-meio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";

const m = (await import("./devolucao-maquina.ts").catch(() => ({}))) as Record<string, (...a: never[]) => unknown>;
const f = <T>(nome: string) => {
  assert.equal(typeof m[nome], "function", `${nome} existe`);
  return m[nome] as unknown as T;
};
const pedido = (meio: string) => f<(d: Record<string, unknown>) => string>("textoPedidoDoComprovante")({ meio, valor: 3200, pedidoEm: "2026-12-03T18:30:00.000Z" });
const motivo = (meio: string) => f<(meio: string) => string>("motivoSemProva")(meio);

test("M39. Pix e transferência: o pedido fala do comprovante da transferência", () => {
  for (const meio of ["pix", "transferencia"]) {
    assert.equal(
      pedido(meio),
      "A equipe precisa do comprovante da transferência para decidir a contestação da devolução de R$ 3.200,00. Anexe o comprovante da transferência até 08/12 15:30; depois desse prazo, a equipe decide com o que houver.",
      meio,
    );
  }
});

test("M38. dinheiro: o pedido não fala de transferência; fala do recibo assinado", () => {
  const p = pedido("dinheiro");
  assert.doesNotMatch(p, /transfer/i);
  assert.match(p, /recibo assinado/);
  assert.equal(
    p,
    "A equipe precisa do recibo assinado pelo morador, ou outro comprovante do pagamento em dinheiro, para decidir a contestação da devolução de R$ 3.200,00. Anexe o recibo assinado pelo morador, ou outro comprovante do pagamento em dinheiro, até 08/12 15:30; depois desse prazo, a equipe decide com o que houver.",
  );
});

test("o meio outro: o comprovante do pagamento", () => {
  assert.equal(
    pedido("outro"),
    "A equipe precisa do comprovante do pagamento para decidir a contestação da devolução de R$ 3.200,00. Anexe o comprovante do pagamento até 08/12 15:30; depois desse prazo, a equipe decide com o que houver.",
  );
});

test("M41. as duas frases do pedido trazem o mesmo nome de documento, saído da mesma função", () => {
  const doc = f<(meio: string) => string>("documentoDoMeio");
  for (const meio of ["pix", "transferencia", "dinheiro", "outro"]) {
    const nome = doc(meio);
    const p = pedido(meio);
    assert.equal(p.split(nome).length - 1, 2, `${meio}: "${nome}" aparece nas duas frases`);
  }
});

test("M40. o motivo da decisão sem prova, por meio", () => {
  assert.equal(motivo("pix"), "o comprovante da transferência não foi apresentado no prazo");
  assert.equal(motivo("transferencia"), "o comprovante da transferência não foi apresentado no prazo");
  assert.equal(motivo("dinheiro"), "o recibo do pagamento em dinheiro não foi apresentado no prazo");
  assert.equal(motivo("outro"), "o comprovante do pagamento não foi apresentado no prazo");
  assert.equal(motivo("desconhecido"), "o comprovante do pagamento não foi apresentado no prazo", "um meio que não se conhece cai no do pagamento");
});
