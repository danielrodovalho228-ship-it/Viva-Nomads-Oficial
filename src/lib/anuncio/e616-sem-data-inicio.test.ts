/*
  E616: a prévia do Passo 9 e a Revisão tratavam a data de início VAZIA como disponibilidade imediata ("Disponível agora
  (sem data de início)") sem o dono ter dito isso. Vazio agora é "Data de início não informada", e a nota da Revisão diz
  o que o anúncio vai mostrar e como mudar. Data informada (hoje ou antes) segue "Disponível agora" — o dono afirmou.
  Roda: node --test src/lib/anuncio/e616-sem-data-inicio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoDisponibilidadePrevia } from "./assistente-telas.ts";
import { NOTA_SEM_DATA_INICIO } from "./assistente-dez-etapas.ts";

test("E616: prévia sem data de início não afirma 'Disponível agora'", () => {
  const r = resumoDisponibilidadePrevia("", "30", "2026-11-05");
  assert.equal(r, "Resumo: Data de início não informada · Mínimo 30 dias");
  assert.doesNotMatch(r, /Disponível agora/);
  // data informada pelo dono, hoje ou no passado: aí sim
  assert.equal(resumoDisponibilidadePrevia("2026-11-05", "30", "2026-11-05"), "Resumo: Disponível agora · Mínimo 30 dias");
});

test("E616: a nota da Revisão diz que a data não foi informada e o que o anúncio mostra", () => {
  assert.match(NOTA_SEM_DATA_INICIO, /^Data de início não informada/);
  assert.match(NOTA_SEM_DATA_INICIO, /Passo 9/);
  assert.doesNotMatch(NOTA_SEM_DATA_INICIO, /^Disponível agora/);
});
