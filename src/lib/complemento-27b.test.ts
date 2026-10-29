import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ERRO_REAIS_FORMATO, formatarReaisDigitando, lerReais, reaisOu, reaisParaCampo } from "./reais.ts";
import { normalizarLimites } from "./anuncio/negociacao.ts";
import { normalizarLimpezaEstadia } from "./anuncio/limpeza-estadia.ts";

/*
  Complemento do prompt 27, parte B (reteste do Muse, 18/10):
   1. valores em reais digitados no formato brasileiro (lerReais em todos os campos de dinheiro);
   3. "Limpezas por mês que posso incluir": vazio = sem limite (null); 0 só quando o dono escolhe "Nenhuma".
  O item 2 (taxa fixada no envio) está em taxa-matriz.test.ts.
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

test("1. lerReais aceita '3300', '3.300', '3.300,50' e 'R$ 3.300'", () => {
  assert.deepEqual(lerReais("3300"), { ok: true, valor: 3300 });
  assert.deepEqual(lerReais("3.300"), { ok: true, valor: 3300 });
  assert.deepEqual(lerReais("3.300,50"), { ok: true, valor: 3300.5 });
  assert.deepEqual(lerReais("R$ 3.300"), { ok: true, valor: 3300 });
  assert.deepEqual(lerReais("R$ 3.300,5"), { ok: true, valor: 3300.5 });
  assert.deepEqual(lerReais("1.250.000"), { ok: true, valor: 1250000 });
  assert.deepEqual(lerReais("2900,9"), { ok: true, valor: 2900.9 });
  assert.deepEqual(lerReais(""), { ok: true, valor: null });
  assert.deepEqual(lerReais(3200), { ok: true, valor: 3200 });
});

test("1. lerReais recusa entrada ambígua com erro claro (nunca inventa um número)", () => {
  for (const ruim of ["3.30", "3.3", "3.300.5", "3,300,00", "3.300,505", "abc", "-100", "3.30,00", "1.2345"]) {
    const r = lerReais(ruim);
    assert.equal(r.ok, false, ruim);
    if (!r.ok) assert.equal(r.erro, ERRO_REAIS_FORMATO);
  }
  assert.match(ERRO_REAIS_FORMATO, /3\.300 ou 3\.300,50/);
  assert.equal(reaisOu("3.30", 7), 7);
});

test("1. formata enquanto a pessoa digita: '3300' → '3.300'; o ponto vira separador de milhar", () => {
  assert.equal(formatarReaisDigitando("3300"), "3.300");
  assert.equal(formatarReaisDigitando("3.300"), "3.300");
  assert.equal(formatarReaisDigitando("33000"), "33.000");
  assert.equal(formatarReaisDigitando("3300,5"), "3.300,5");
  assert.equal(formatarReaisDigitando("3300,567"), "3.300,56");
  assert.equal(formatarReaisDigitando("3300,5", false), "3.300");
  assert.equal(formatarReaisDigitando("R$ 2.900"), "2.900");
  assert.equal(formatarReaisDigitando("0003"), "3");
  assert.equal(formatarReaisDigitando(",5"), "0,5");
  assert.equal(reaisParaCampo(3300), "3.300");
  assert.equal(reaisParaCampo(3300.5), "3.300,50");
  assert.equal(reaisParaCampo(null), "");
  // O que o campo mostra, o leitor entende de volta.
  for (const v of [2500, 2900, 3000, 3200, 3300, 3300.5, 125000]) {
    const r = lerReais(reaisParaCampo(v));
    assert.ok(r.ok && r.valor === v, String(v));
  }
});

test("1. a contraproposta, o piso privado, o preço do anúncio, os simuladores e os orçamentos usam o campo único", () => {
  const usa = (rel: string) => assert.match(ler(rel), /<CampoReais/, rel);
  usa("../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  usa("../components/anuncio/blocos-cadastro.tsx");
  usa("../app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx");
  usa("../app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  usa("../components/simulador/ui.tsx");
  usa("../components/precos/simulador-bolso.tsx");
  usa("../components/precos/preco-sugerido.tsx");
  usa("../app/(dashboard)/dashboard/orcamentos/nova/montagem-proposta.tsx");
  usa("../components/anuncio/limpeza-estadia-campos.tsx");
  usa("../components/anuncio/pets-regras-campos.tsx");
  usa("../app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  usa("../app/(dashboard)/dashboard/reembolsos/page.tsx");
  usa("../components/tax-simulator.tsx");
  // A causa do reteste: "3.300" virava 3,3.
  const detalhe = ler("../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  assert.doesNotMatch(detalhe, /replace\(",", "\."\)/);
  // O aviso de "tente a partir de…" é limpo no início de enviar().
  assert.match(detalhe, /async function enviar\([^)]*\) \{\n\s+setErro\(null\);\n[^\n]*\n\s+setAviso\(null\);/);
  // O campo de dinheiro do simulador não é mais type="number" (que lia "3.300" como 3,3).
  assert.match(ler("../components/simulador/ui.tsx"), /prefix === "R\$" \? \(/);
  // Leituras de servidor do valor do pacote de limpeza e do valor pet pela fonte única.
  assert.equal(normalizarLimpezaEstadia({ porMes: 2, inclui: "", valorMes: "1.200" })?.valorMes, 1200);
});

test("3. limpezas: vazio = sem limite (null); 0 só se o dono escolher 'Nenhuma'", () => {
  assert.deepEqual(normalizarLimites({ valorMinimo: 2900, limpezasMax: null }), { valorMinimo: 2900, limpezasMax: null });
  assert.deepEqual(normalizarLimites({ valorMinimo: 2900 }), { valorMinimo: 2900, limpezasMax: null });
  assert.deepEqual(normalizarLimites({ valorMinimo: 2900, limpezasMax: "" }), { valorMinimo: 2900, limpezasMax: null });
  assert.deepEqual(normalizarLimites({ valorMinimo: null, limpezasMax: 0 }), { valorMinimo: null, limpezasMax: 0 });
  assert.deepEqual(normalizarLimites({ valorMinimo: null, limpezasMax: "2" }), { valorMinimo: null, limpezasMax: 2 });
  const tela = ler("../components/anuncio/blocos-cadastro.tsx");
  // E193: pílulas de escolha única (antes, <select>): "Sem limite" grava null e "Nenhuma" grava 0.
  assert.match(tela, /\{ v: null, r: "Sem limite" \}/);
  assert.match(tela, /\{ v: 0, r: "Nenhuma" \}/);
  // Registros: a 0170 troca os 0 gravados pelo defeito por null, guardando as linhas para o rollback.
  const sql = ler("../../supabase/producao/aplicar-0170.sql");
  assert.match(sql, /update public\.property_negociacao_limites set limpezas_max = null where limpezas_max = 0;/);
  assert.match(ler("../../supabase/producao/rollback/0170_rollback.sql"), /_bkp_0170_limpezas_max/);
});
