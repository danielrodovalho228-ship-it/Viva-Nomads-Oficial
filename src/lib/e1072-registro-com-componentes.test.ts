/*
  E1072 (fatia 1; ORDEM-DUET-348) — o registro do pagamento do bloco cobre o que o contrato diz: o aluguel do bloco, as
  contas do período e a limpeza de preparação, cada componente discriminado e a contar para o quitado.
  O contrato provado ao vivo em 20/11: 31 dias a R$ 2.500,00 por mês, contas de R$ 300,00 por mês e limpeza de
  preparação de R$ 250,00 → R$ 3.143,33 = aluguel R$ 2.583,33 + contas R$ 310,00 + limpeza R$ 250,00. Só os
  R$ 2.583,33 tinham registro.
  Roda: node --test src/lib/e1072-registro-com-componentes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ROTULO_CONTAS,
  ROTULO_LIMPEZA,
  componentesDoPagamento,
  componentesDosBlocos,
  contasDoContrato,
  emAbertoNoBloco,
  encargosDosComponentes,
  fatorDoBloco,
  somarComponentes,
  textoComponentes,
} from "./pagamento-componentes.ts";
import { conteudoPacoteProvas, linhasPagamentos, montarDadosProvas, totaisPagamentos, type LinhasProvas } from "./contrato-provas.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

// O contrato provado: um bloco de 31 dias.
const BLOCO = { numero: 1, meses: 2, inicio: "2027-01-10", fim: "2027-02-09", valor: 2583.33 };
const esperadoDoProvado = () => {
  const fator = fatorDoBloco(BLOCO, 31);
  const contas = contasDoContrato({ totalContratoDaProposta: 3143.33, aluguelDosBlocos: 2583.33, limpezaPreparacao: 250, fatorDaEstadia: fator });
  return componentesDosBlocos({ blocos: [{ numero: 1, valor: BLOCO.valor, fator }], contasDoContrato: contas, limpezaPreparacao: 250 }).get(1)!;
};

test("o contrato provado: o bloco custa R$ 3.143,33 = aluguel 2.583,33 + contas 310,00 + limpeza 250,00", () => {
  assert.equal(fatorDoBloco(BLOCO, 31), 31 / 30);
  assert.deepEqual(esperadoDoProvado(), { aluguel: 2583.33, contas: 310, limpeza: 250, total: 3143.33 });
  assert.equal(textoComponentes(esperadoDoProvado()), "valor do bloco R$ 2.583,33 + contas do período R$ 310,00 + limpeza de preparação R$ 250,00 = R$ 3.143,33");
});

test("sem proposta: as contas do mês congeladas no contrato × o fator da estadia", () => {
  assert.equal(contasDoContrato({ totalContratoDaProposta: null, aluguelDosBlocos: 2583.33, limpezaPreparacao: 250, extrasMesCongelados: 300, fatorDaEstadia: 31 / 30 }), 310);
  assert.equal(contasDoContrato({ aluguelDosBlocos: 6400, limpezaPreparacao: 0, extrasMesCongelados: 0, fatorDaEstadia: 2 }), 0);
});

test("vários blocos: as contas repartem-se pelo período de cada um, a limpeza fica no 1º e a soma bate no centavo", () => {
  // 6 meses em blocos de 2; contas de R$ 333,33 por mês (R$ 1.999,98 na estadia); limpeza de R$ 250,00.
  const blocos = [1, 2, 3].map((numero) => ({ numero, valor: 6400, fator: fatorDoBloco({ meses: 2 }, 180) }));
  const m = componentesDosBlocos({ blocos, contasDoContrato: 1999.98, limpezaPreparacao: 250 });
  assert.deepEqual(m.get(1), { aluguel: 6400, contas: 666.66, limpeza: 250, total: 7316.66 });
  assert.deepEqual(m.get(2), { aluguel: 6400, contas: 666.66, limpeza: 0, total: 7066.66 });
  assert.deepEqual(m.get(3), { aluguel: 6400, contas: 666.66, limpeza: 0, total: 7066.66 });
  const soma = [...m.values()].reduce((s, c) => s + c.total, 0);
  assert.equal(Math.round(soma * 100) / 100, 19200 + 1999.98 + 250);
});

test("sem contas nem limpeza, o bloco é só o aluguel — como sempre", () => {
  const c = componentesDosBlocos({ blocos: [{ numero: 1, valor: 6400, fator: 2 }], contasDoContrato: 0, limpezaPreparacao: 0 }).get(1)!;
  assert.deepEqual(c, { aluguel: 6400, contas: 0, limpeza: 0, total: 6400 });
  assert.equal(textoComponentes(c), "");
  assert.deepEqual(encargosDosComponentes(c), []);
});

test("o registro guarda as contas e a limpeza como encargos de rótulo fixo, e o pagamento volta com os três componentes", () => {
  const enc = encargosDosComponentes({ contas: 310, limpeza: 250 });
  assert.deepEqual(enc, [{ rotulo: ROTULO_CONTAS, valor: 310 }, { rotulo: ROTULO_LIMPEZA, valor: 250 }]);
  assert.deepEqual(componentesDoPagamento({ valor: "2583.33", encargos: enc }), { aluguel: 2583.33, contas: 310, limpeza: 250, total: 3143.33 });
  // Encargos de rótulo antigo (o formulário de antes) contam como contas.
  assert.deepEqual(componentesDoPagamento({ valor: 2500, encargos: [{ rotulo: "Condomínio", valor: 200 }, { rotulo: "IPTU", valor: 50 }] }), { aluguel: 2500, contas: 250, limpeza: 0, total: 2750 });
  assert.deepEqual(componentesDoPagamento({ valor: 2500, encargos: null }), { aluguel: 2500, contas: 0, limpeza: 0, total: 2500 });
});

test("quitado só com os três componentes: o registro de antes (só o aluguel) deixa R$ 560,00 em aberto", () => {
  const esperado = esperadoDoProvado();
  const soAluguel = somarComponentes([componentesDoPagamento({ valor: 2583.33, encargos: [] })]);
  assert.deepEqual(emAbertoNoBloco(esperado, soAluguel), { aluguel: 0, contas: 310, limpeza: 250, total: 560, quitado: false });
  const completo = somarComponentes([componentesDoPagamento({ valor: 2583.33, encargos: encargosDosComponentes({ contas: 310, limpeza: 250 }) })]);
  assert.deepEqual(emAbertoNoBloco(esperado, completo), { aluguel: 0, contas: 0, limpeza: 0, total: 0, quitado: true });
  // Nada registrado: tudo em aberto.
  assert.equal(emAbertoNoBloco(esperado, somarComponentes([])).total, 3143.33);
});

/* ---- Pacote de provas: cada componente visível e a contar nos totais ---- */
const base: LinhasProvas = {
  contratoId: "11111111-2222-3333-4444-555555555555",
  imovel: "Studio",
  situacao: "Em vigência",
  registradoEm: "2026-11-20T18:00:00Z",
  resumo: ["Valor mensal: R$ 2.500,00"],
  prazoEntradaEm: null,
  assinaturas: [],
  pagamentos: [
    { id: "p1", tipo: "aluguel", valor: "2583.33", forma: "pix", data_pagamento: "2026-11-21", confirmado_pelo_inquilino: true, confirmado_em: "2026-11-21T13:05:00Z", anulado_em: null, anulado_motivo: null, created_at: "2026-11-21T13:00:00Z", encargos: [{ rotulo: ROTULO_CONTAS, valor: 310 }, { rotulo: ROTULO_LIMPEZA, valor: 250 }] },
    { id: "p2", tipo: "caucao", valor: "1292.00", forma: "pix", data_pagamento: "2026-11-21", confirmado_pelo_inquilino: true, confirmado_em: "2026-11-21T13:06:00Z", anulado_em: null, anulado_motivo: null, created_at: "2026-11-21T13:01:00Z", encargos: [] },
  ],
  documentos: [{ tipo: "recibo_aluguel", numero: "REC-2026-000001", pagamento_id: "p1", anulado_em: null }],
  conferencias: [],
  itens: [],
  respostas: [],
  laudos: [],
};

test("pacote de provas: a linha do pagamento discrimina aluguel, contas e limpeza, e os totais contam os três", () => {
  const d = montarDadosProvas(base);
  assert.deepEqual(totaisPagamentos(d.pagamentos), { confirmado: 4435.33, aguardando: 0, anulados: 0 });
  assert.deepEqual(linhasPagamentos(d.pagamentos), [
    "Aluguel de R$ 2.583,33 + contas do período de R$ 310,00 + limpeza de preparação de R$ 250,00 = R$ 3.143,33 (Pix, em 21/11/2026): confirmado pelo inquilino em 21/11/2026 às 10:05. Recibo REC-2026-000001.",
    "Caução de R$ 1.292,00 (Pix, em 21/11/2026): confirmada pelo inquilino em 21/11/2026 às 10:06. Comprovante da caução ainda não emitido.",
  ]);
  const corpo = conteudoPacoteProvas(d).corpo;
  assert.ok(corpo.includes("Confirmados pelo inquilino: R$ 4.435,33. Aguardando confirmação do inquilino: R$ 0,00."));
  assert.ok(corpo.includes("21/11/2026 às 10:00 — Aluguel de R$ 2.583,33 marcado como pago pelo proprietário (Pix, em 21/11/2026), com contas do período de R$ 310,00 e limpeza de preparação de R$ 250,00: total de R$ 3.143,33."));
});

test("pacote de provas: pagamento sem contas nem limpeza continua com a linha de antes", () => {
  const d = montarDadosProvas({ ...base, pagamentos: [{ ...base.pagamentos[0], encargos: [] }] });
  assert.deepEqual(linhasPagamentos(d.pagamentos), ["Aluguel de R$ 2.583,33 (Pix, em 21/11/2026): confirmado pelo inquilino em 21/11/2026 às 10:05. Recibo REC-2026-000001."]);
  assert.ok(conteudoPacoteProvas(d).corpo.includes("21/11/2026 às 10:00 — Aluguel de R$ 2.583,33 marcado como pago pelo proprietário (Pix, em 21/11/2026)."));
});

/* ---- A tela e as cargas usam a fonte única ---- */
test("a tela do dono, a confirmação do morador, a ação e as cargas usam os componentes", () => {
  const tela = ler("src/app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  assert.match(tela, /emAbertoNoBloco\(/);
  assert.match(tela, /"registrar-contas"/);
  assert.match(tela, /"registrar-limpeza"/);
  assert.match(tela, /encargosDosComponentes\(/);
  assert.doesNotMatch(tela, /quitado = pago >= bloco\.valor/);
  const acoes = ler("src/lib/data/contratos-actions.ts");
  assert.match(acoes, /componentesDosContratos\(/);
  assert.match(acoes, /componentesDoPagamento\(/);
  assert.match(ler("src/components/documentos/documentos-contrato.tsx"), /data-testid="pagamento-componentes"/);
  assert.match(ler("src/lib/contrato-provas.ts"), /anulado_motivo, created_at, encargos"/);
});
