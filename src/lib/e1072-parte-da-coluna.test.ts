/*
  E1072 — ORDEM-DUET-1104 (julgamento 3 do coordenador: a parte tem UMA fonte, a coluna registada).
  Antes: as telas de contratos e locações, o pacote de provas e o recibo tiravam a parte da ORDEM dos registros ativos
  do bloco (partesPorOrdem). Anulada a parte 1, o complemento passava a ser mostrado como parte 1 — e o pacote de
  provas, documento registado, deixava de o chamar complementar. Depois: toda a leitura usa a `parte` da coluna
  (parteDaColuna; 1 quando vier vazia) e o desvio do erro 42703 (a coluna por existir) sai — a 0348 está aplicada.
  Roda: node --test src/lib/e1072-parte-da-coluna.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as componentes from "./pagamento-componentes.ts";
import { COLUNAS_PROVAS, conteudoPacoteProvas, montarDadosProvas, type LinhasProvas } from "./contrato-provas.ts";
import { fonteSemComentarios } from "./fonte-sem-comentarios.ts";

const ler = (p: string) => fonteSemComentarios(readFileSync(new URL(`../../${p}`, import.meta.url), "utf8"));
const parteDaColuna = (componentes as unknown as { parteDaColuna?: (v: unknown) => number }).parteDaColuna;

test("parteDaColuna: a parte registada na coluna; vazia, zero ou lixo → 1", () => {
  assert.equal(typeof parteDaColuna, "function", "pagamento-componentes exporta parteDaColuna");
  assert.equal(parteDaColuna!(2), 2);
  assert.equal(parteDaColuna!("3"), 3);
  for (const v of [null, undefined, 0, -1, "x", 1.5]) assert.equal(parteDaColuna!(v), 1, String(v));
});

const linhas = (pagamentos: LinhasProvas["pagamentos"]): LinhasProvas => ({
  contratoId: "11111111-2222-4333-8444-555555555555", imovel: "Studio", situacao: "Em vigência", registradoEm: "2026-11-20T18:00:00Z",
  resumo: ["MINUTA"], assinaturas: [], pagamentos, conferencias: [], itens: [], respostas: [], laudos: [],
} as unknown as LinhasProvas);
const BLOCO = "bbbbbbbb-0000-4000-8000-000000000001";
const p1 = { id: "p1", bloco_id: BLOCO, tipo: "aluguel", parte: 1, valor: 2583.33, forma: "pix", data_pagamento: "2026-11-20", confirmado_pelo_inquilino: true, confirmado_em: "2026-11-20T22:31:00Z", anulado_em: null, anulado_motivo: null, created_at: "2026-11-20T22:20:00Z", encargos: [] };
const p2 = { id: "p2", bloco_id: BLOCO, tipo: "aluguel", parte: 2, valor: 0, forma: "pix", data_pagamento: "2026-11-21", confirmado_pelo_inquilino: true, confirmado_em: "2026-11-21T10:00:00Z", anulado_em: null, anulado_motivo: null, created_at: "2026-11-21T09:00:00Z", encargos: [{ rotulo: "Contas do período", valor: 310 }, { rotulo: "Limpeza de preparação", valor: 250 }] };

test("o pacote de provas: anulada a parte 1, a parte 2 continua a ser o registro complementar", () => {
  const anulada = { ...p1, anulado_em: "2026-11-22T10:00:00Z", anulado_motivo: "registro em duplicidade" };
  const dados = montarDadosProvas(linhas([anulada, p2] as LinhasProvas["pagamentos"]));
  const corpo = conteudoPacoteProvas(dados).corpo.join("\n");
  assert.match(corpo, /Registro complementar de R\$\s?560,00/, "a parte 2 continua complementar no pacote");
});

test("a coluna `parte` é lida pelo pacote, pelas telas e pelo recibo — e nenhuma leitura tira a parte da ordem", () => {
  assert.match(COLUNAS_PROVAS.pagamentos, /\bparte\b/, "o pacote lê a coluna");
  const acoes = ler("src/lib/data/contratos-actions.ts");
  assert.match(acoes, /parteDaColuna\(p\.parte\)/, "as telas leem a coluna");
  assert.doesNotMatch(acoes, /42703|semColuna/, "sem o desvio da coluna por existir");
  const emitir = ler("src/lib/fiscal/emitir.ts");
  assert.match(emitir, /select\("id, contrato_id, bloco_id, tipo, parte,/, "o recibo lê a coluna");
  assert.match(emitir, /parteDaColuna\(pg\.parte\)/);
  for (const f of ["src/lib/data/contratos-actions.ts", "src/lib/fiscal/emitir.ts", "src/lib/contrato-provas.ts", "src/lib/pagamento-componentes.ts"]) {
    assert.doesNotMatch(ler(f), /partesPorOrdem|parteDoPagamento|partesDasLinhas|partesDosPagamentos/, `${f}: nenhuma parte pela ordem`);
  }
});
