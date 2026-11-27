/*
  E521 — /comparar mostrava "Valor mensal R$ 2.000" (ube-015) e "R$ 2.100" (ube-009), só o aluguel, enquanto busca,
  mapa e anúncio mostram o TOTAL por mês (R$ 2.430 e R$ 2.580). A primeira linha agora é o mesmo total da busca
  (calcularTotalMensal), com o rótulo da casa; o aluguel fica numa linha à parte, com a base escrita no rótulo.
  Roda: node --test src/lib/busca/e521-comparar-total.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarTabela } from "./comparar.ts";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { calcularTotalMensal, ROTULO_TOTAL_MES } from "../precos.ts";

const ex = (id: string) => SAMPLE_PROPERTIES.find((p) => p.id === id)!;

test("a primeira linha é o total por mês — o mesmo número da busca e do anúncio", () => {
  const t = montarTabela([ex("ube-015"), ex("ube-009")]);
  assert.equal(t[0].chave, "total");
  assert.equal(t[0].rotulo, ROTULO_TOTAL_MES);
  for (const [i, id] of ["ube-015", "ube-009"].entries()) {
    const total = calcularTotalMensal(ex(id)).total;
    assert.equal(t[0].valores[i], `R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
  }
  // O caso do QA: o total é maior que o aluguel (contas entram no total).
  assert.ok(calcularTotalMensal(ex("ube-015")).total > ex("ube-015").monthlyPrice);
});

test("o aluguel continua visível, mas com a base escrita no rótulo (nunca 'Valor mensal' sozinho)", () => {
  const t = montarTabela([ex("ube-015"), ex("ube-009")]);
  const aluguel = t.find((l) => l.chave === "mensal")!;
  assert.equal(aluguel.rotulo, "Aluguel (só o valor mensal)");
  assert.deepEqual(aluguel.valores, ["R$ 2.000", "R$ 2.100"]);
  assert.equal(t.some((l) => l.rotulo === "Valor mensal"), false);
});
