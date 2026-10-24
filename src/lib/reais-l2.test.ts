/*
  L2-B item 15 — milhar brasileiro: todo valor em R$ digitado passa por UMA função (lerReais, src/lib/reais.ts).
  Os quatro formatos e os lugares que liam com Number()/parseFloat soltos.
  Roda: node --test src/lib/reais-l2.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerReais } from "./reais.ts";
import { validarOrcamento } from "./parceiros/pedido.ts";
import { taxaValida } from "./fotografos/regras.ts";
import { valorReais } from "./marketing.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const valor = (t: string) => {
  const r = lerReais(t);
  return r.ok ? r.valor : NaN;
};

test("os quatro formatos: '3300', '3.300', '3.300,50' e '3,5'", () => {
  assert.equal(valor("3300"), 3300);
  assert.equal(valor("3.300"), 3300);
  assert.equal(valor("3.300,50"), 3300.5);
  assert.equal(valor("3,5"), 3.5);
});

test("as leituras que eram soltas dão o mesmo número", () => {
  for (const [texto, esperado] of [["3300", 3300], ["3.300", 3300], ["3.300,50", 3300.5]] as const) {
    assert.deepEqual(validarOrcamento(texto), { ok: true, valor: esperado }, `orçamento do parceiro: ${texto}`);
    assert.equal(valorReais(texto), esperado, `gasto de marketing: ${texto}`);
  }
  // Antes: "3.300" virava 3,3 (taxa do fotógrafo, gasto de marketing).
  assert.equal(taxaValida("3.300"), 3300);
  assert.equal(taxaValida("3,5"), 3.5);
  assert.deepEqual(validarOrcamento("3,5"), { ok: true, valor: 3.5 });
  // Antes: "3300.5" virava 33005 no orçamento do parceiro. Ambíguo → recusa, nunca número inventado.
  assert.equal(validarOrcamento("3300.5").ok, false);
});

test("nenhum dos lugares trocados lê dinheiro com replace/Number solto", () => {
  const solto = /replace\(\/\\\.\/g, ""\)\.replace\(",", "\."\)/;
  for (const arq of ["src/lib/parceiros/pedido.ts", "src/lib/parceiros/painel-actions.ts", "src/lib/vistoria/actions.ts", "src/lib/marketing.ts"]) {
    const s = ler(arq);
    assert.doesNotMatch(s, solto, arq);
    assert.match(s, /lerReais\(/, arq);
  }
  assert.doesNotMatch(ler("src/lib/fotografos/regras.ts"), /Number\(String\(v \?\? ""\)\.replace\(",", "\."\)\)/);
  // Telas: o valor devolvido da caução e o orçamento do pedido usam o CampoReais (que lê por lerReais).
  const devolucao = ler("src/components/documentos/documentos-contrato.tsx");
  assert.doesNotMatch(devolucao, /type="number"[^>]*caucaoConfirmada/);
  assert.match(devolucao, /<CampoReais semPrefixo centavos/);
  const pedido = ler("src/app/(public)/pedidos/novo/page.tsx");
  assert.match(pedido, /<CampoReais\s+semPrefixo\s+id="pedido-orcamento-min"/);
  assert.match(pedido, /<CampoReais\s+semPrefixo\s+id="pedido-orcamento"/);
  assert.doesNotMatch(pedido, /mascararMilhar\(orcamento/);
  // O preço base do parceiro volta ao campo no formato brasileiro (o servidor lê por lerReais).
  assert.match(ler("src/app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx"), /precoBase: reaisParaCampo\(s\.precoBase, true\)/);
});
