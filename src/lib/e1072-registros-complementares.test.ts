/*
  E1072 (fatia 2; ORDEM-DUET-348, resposta 3) — um bloco pago em partes completa-se com REGISTROS COMPLEMENTARES no
  mesmo bloco: cada complemento com o seu recibo e a sua confirmação do morador; o bloco quita quando a soma chega ao
  total. O índice único "um registro por bloco" (0182) passa a "um por bloco e parte" (migração 0348).
  O caso que pede isto: o registro da prova de 20/11, só com o aluguel (R$ 2.583,33 de R$ 3.143,33) — faltam as contas
  (R$ 310,00) e a limpeza (R$ 250,00), que entram por um complemento de R$ 560,00.
  Roda: node --test src/lib/e1072-registros-complementares.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULO_CONTAS, ROTULO_LIMPEZA, componentesDoPagamento, emAbertoNoBloco, parteDaColuna, proximaParte, somarComponentes, textoComponentes } from "./pagamento-componentes.ts";
import { rotuloPagamentoBloco } from "./pagamento-bloco.ts";
import { COLUNAS_PROVAS, conteudoPacoteProvas, linhasPagamentos, montarDadosProvas, totaisPagamentos, type LinhasProvas } from "./contrato-provas.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const ESPERADO = { aluguel: 2583.33, contas: 310, limpeza: 250, total: 3143.33 };
const ENCARGOS_DO_COMPLEMENTO = [{ rotulo: ROTULO_CONTAS, valor: 310 }, { rotulo: ROTULO_LIMPEZA, valor: 250 }];

test("a parte do registro: 1 no primeiro, a seguinte em cada complemento; a anulada não conta", () => {
  assert.equal(proximaParte([]), 1);
  assert.equal(proximaParte([1]), 2);
  assert.equal(proximaParte([1, 2]), 3);
  // A parte 1 foi anulada e só a 2 está ativa: o novo registro é a 3 (nunca repete uma parte ativa).
  assert.equal(proximaParte([2]), 3);
  // ASSERÇÃO ALTERADA (teste novo deste PR; ORDEM-DUET-1104, julgamento 3): nas leituras, a parte é a da COLUNA
  // registada — antes era a ordem dos registros ativos do bloco (partesPorOrdem, que saiu).
  assert.equal(parteDaColuna(2), 2);
  assert.equal(parteDaColuna(null), 1);
});

test("o registro de antes + o complemento quitam o bloco", () => {
  const antes = componentesDoPagamento({ valor: 2583.33, encargos: [] });
  assert.deepEqual(emAbertoNoBloco(ESPERADO, somarComponentes([antes])), { aluguel: 0, contas: 310, limpeza: 250, total: 560, quitado: false });
  const complemento = componentesDoPagamento({ valor: 0, encargos: ENCARGOS_DO_COMPLEMENTO });
  assert.deepEqual(complemento, { aluguel: 0, contas: 310, limpeza: 250, total: 560 });
  assert.equal(emAbertoNoBloco(ESPERADO, somarComponentes([antes, complemento])).quitado, true);
});

test("o texto de um registro sem aluguel não diz 'aluguel R$ 0,00'", () => {
  assert.equal(textoComponentes({ aluguel: 0, contas: 310, limpeza: 250, total: 560 }), "contas do período R$ 310,00 + limpeza de preparação R$ 250,00 = R$ 560,00");
  assert.equal(textoComponentes({ aluguel: 0, contas: 310, limpeza: 0, total: 310 }), "contas do período R$ 310,00");
  // O registro completo continua como na fatia 1; só aluguel continua sem texto.
  assert.equal(textoComponentes(ESPERADO), "valor do bloco R$ 2.583,33 + contas do período R$ 310,00 + limpeza de preparação R$ 250,00 = R$ 3.143,33");
  assert.equal(textoComponentes({ aluguel: 6400, contas: 0, limpeza: 0, total: 6400 }), "");
});

test("o rótulo do complemento diz que é complementar e traz o total dele; o do primeiro registro não muda", () => {
  const bloco = { numero: 1, meses: 2, inicio: "2027-01-10", fim: "2027-02-09" };
  assert.match(rotuloPagamentoBloco({ tipo: "aluguel", valor: 0, bloco, parte: 2, total: 560, prazoTotalDias: 60 }), /^Bloco 1, registro complementar \(2 meses: 10\/01 a 09\/02\) — R\$\s560(,00)?$/);
  assert.equal(rotuloPagamentoBloco({ tipo: "aluguel", valor: 6400, bloco, valorMensal: 3200, prazoTotalDias: 60 }), rotuloPagamentoBloco({ tipo: "aluguel", valor: 6400, bloco, valorMensal: 3200, parte: 1, total: 6400, prazoTotalDias: 60 }));
});

/* ---- Pacote de provas ---- */
const base: LinhasProvas = {
  contratoId: "11111111-2222-3333-4444-555555555555",
  imovel: "Studio",
  situacao: "Em vigência",
  registradoEm: "2026-11-20T18:00:00Z",
  resumo: ["Valor mensal: R$ 2.500,00"],
  prazoEntradaEm: null,
  assinaturas: [],
  pagamentos: [
    { id: "p1", bloco_id: "b1", tipo: "aluguel", parte: 1, valor: "2583.33", forma: "pix", data_pagamento: "2026-11-20", confirmado_pelo_inquilino: true, confirmado_em: "2026-11-20T22:31:00Z", anulado_em: null, anulado_motivo: null, created_at: "2026-11-20T22:20:00Z", encargos: [] },
    { id: "p2", bloco_id: "b1", tipo: "aluguel", parte: 2, valor: "0", forma: "pix", data_pagamento: "2026-11-22", confirmado_pelo_inquilino: true, confirmado_em: "2026-11-22T13:10:00Z", anulado_em: null, anulado_motivo: null, created_at: "2026-11-22T13:00:00Z", encargos: ENCARGOS_DO_COMPLEMENTO },
  ],
  documentos: [
    { tipo: "recibo_aluguel", numero: "REC-2026-000001", pagamento_id: "p1", anulado_em: null },
    { tipo: "recibo_aluguel", numero: "REC-2026-000002", pagamento_id: "p2", anulado_em: null },
  ],
  conferencias: [],
  itens: [],
  respostas: [],
  laudos: [],
};

test("pacote de provas: o complemento tem a sua linha, o seu recibo e entra nos totais", () => {
  const d = montarDadosProvas(base);
  assert.deepEqual(totaisPagamentos(d.pagamentos), { confirmado: 3143.33, aguardando: 0, anulados: 0 });
  assert.deepEqual(linhasPagamentos(d.pagamentos), [
    "Aluguel de R$ 2.583,33 (Pix, em 20/11/2026): confirmado pelo inquilino em 20/11/2026 às 19:31. Recibo REC-2026-000001.",
    "Registro complementar de R$ 560,00 — contas do período de R$ 310,00 + limpeza de preparação de R$ 250,00 (Pix, em 22/11/2026): confirmado pelo inquilino em 22/11/2026 às 10:10. Recibo REC-2026-000002.",
  ]);
  const corpo = conteudoPacoteProvas(d).corpo;
  assert.ok(corpo.includes("22/11/2026 às 10:00 — Registro complementar de R$ 560,00 (contas do período de R$ 310,00 e limpeza de preparação de R$ 250,00) marcado como pago pelo proprietário (Pix, em 22/11/2026)."));
  assert.ok(corpo.includes("22/11/2026 às 10:10 — Registro complementar de R$ 560,00 confirmado pelo inquilino."));
  // O primeiro registro continua com a redação de sempre.
  assert.ok(corpo.includes("20/11/2026 às 19:20 — Aluguel de R$ 2.583,33 marcado como pago pelo proprietário (Pix, em 20/11/2026)."));
});

test("pacote de provas: complemento só de aluguel (bloco pago em duas vezes) diz o aluguel", () => {
  const d = montarDadosProvas({ ...base, pagamentos: [{ ...base.pagamentos[0], valor: "1583.33" }, { ...base.pagamentos[1], valor: "1000", encargos: [] }], documentos: [] });
  assert.deepEqual(linhasPagamentos(d.pagamentos), [
    "Aluguel de R$ 1.583,33 (Pix, em 20/11/2026): confirmado pelo inquilino em 20/11/2026 às 19:31. Recibo ainda não emitido.",
    "Registro complementar de R$ 1.000,00 — aluguel de R$ 1.000,00 (Pix, em 22/11/2026): confirmado pelo inquilino em 22/11/2026 às 10:10. Recibo ainda não emitido.",
  ]);
  // ASSERÇÃO ALTERADA (teste novo deste PR; ORDEM-DUET-1104): a parte é a da coluna. Antes: "um registro sozinho no
  // bloco é sempre o primeiro" (pela ordem, mesmo com parte 2 gravada). Agora: o registro com a parte 1 (ou sem ela) é o
  // primeiro, nunca complementar; o caso da parte 2 sozinha (a 1 anulada) está em e1072-parte-da-coluna.test.ts.
  const so = montarDadosProvas({ ...base, pagamentos: [{ ...base.pagamentos[1], parte: null, valor: "1000", encargos: [] }], documentos: [] });
  assert.match(linhasPagamentos(so.pagamentos)[0], /^Aluguel de R\$ 1\.000,00 /);
});

/* ---- Banco, ação e tela ---- */
test("migração 0348: a parte do registro e o índice único por bloco e parte; o aplicar regista-se; o rollback desfaz", () => {
  const sql = ler("supabase/migrations/0348_pagamentos_bloco_partes_e1072.sql");
  assert.match(sql, /add column if not exists parte integer not null default 1/);
  assert.match(sql, /create unique index if not exists pagamentos_bloco_uma_parte_por_bloco\s+on public\.pagamentos_bloco \(bloco_id, parte\) where tipo = 'aluguel' and anulado_em is null/);
  assert.match(sql, /drop index if exists public\.pagamentos_bloco_um_valor_mensal/);
  // O índice novo é criado antes de o antigo sair.
  assert.ok(sql.indexOf("pagamentos_bloco_uma_parte_por_bloco") < sql.indexOf("drop index if exists public.pagamentos_bloco_um_valor_mensal"));
  const aplicar = ler("supabase/producao/aplicar-0348.sql");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /'20261121000348', '0348_pagamentos_bloco_partes_e1072'/);
  assert.match(aplicar, /pagamentos_bloco_uma_parte_por_bloco/);
  const rollback = ler("supabase/producao/rollback/0348_rollback.sql");
  assert.match(rollback, /create unique index if not exists pagamentos_bloco_um_valor_mensal/);
  assert.match(rollback, /drop column if exists parte/);
  assert.match(rollback, /delete from supabase_migrations\.schema_migrations where version = '20261121000348'/);
});

test("a ação grava a parte e recusa o que passa do que falta; a tela oferece o registro complementar", () => {
  const acoes = ler("src/lib/data/contratos-actions.ts");
  assert.match(acoes, /proximaParte\(/);
  assert.match(acoes, /parte,/);
  assert.match(acoes, /MSG_PASSA_DO_QUE_FALTA/);
  const tela = ler("src/app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  // O registro complementar abre pelo MESMO botão de registro do bloco (a mesma marca "registrar-recebimento"): cada bloco
  // tem um só botão de registro de cada vez. É por essa marca que a trava t2212 (Pista 3, #4082) registra a 2ª parte.
  assert.match(tela, /data-testid=\{tipo === "caucao" \? "registrar-caucao" : "registrar-recebimento"\}/);
  assert.doesNotMatch(tela, /"registrar-complemento"/);
  assert.match(tela, /Registrar o que falta/);
  // ASSERÇÃO ALTERADA (teste novo deste PR; ORDEM-DUET-1104, julgamento 3): as leituras (pacote, telas, recibo) leem a
  // parte da COLUNA registada. Antes: o pacote não lia a coluna e o recibo tirava a parte da ordem (parteDoPagamento).
  assert.match(COLUNAS_PROVAS.pagamentos, /\bbloco_id\b/);
  assert.match(COLUNAS_PROVAS.pagamentos, /\bparte\b/);
  assert.match(ler("src/lib/fiscal/emitir.ts"), /parteDaColuna\(pg\.parte\)/);
});
