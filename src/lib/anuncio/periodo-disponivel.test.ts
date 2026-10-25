import test from "node:test";
import assert from "node:assert/strict";
import { periodoDisponivelValido } from "./periodo-disponivel.ts";

test("até antes de a partir de é recusado", () => {
  assert.equal(periodoDisponivelValido("2026-11-10", "2026-11-01"), false);
});
test("até igual ou depois é aceito", () => {
  assert.equal(periodoDisponivelValido("2026-11-10", "2026-11-10"), true);
  assert.equal(periodoDisponivelValido("2026-11-10", "2027-01-01"), true);
});
test("campo vazio não bloqueia", () => {
  assert.equal(periodoDisponivelValido("", "2026-11-01"), true);
  assert.equal(periodoDisponivelValido("2026-11-10", undefined), true);
});

// E137: a janela precisa caber a duração mínima do anúncio.
import { diasDaJanela, erroJanelaDisponivel } from "./periodo-disponivel.ts";
test("E137 — 25/10 a 18/11 (24 dias) com mínimo de 30 é recusado, com a data que resolve", () => {
  assert.equal(diasDaJanela("2026-10-25", "2026-11-18"), 24);
  assert.equal(
    erroJanelaDisponivel("2026-10-25", "2026-11-18", "30"),
    "De 25/10/2026 a 18/11/2026 são 24 dias — menos que a duração mínima de 30 dias. Mude a data final para 24/11/2026 ou depois, ou deixe sem data final.",
  );
  assert.equal(erroJanelaDisponivel("2026-10-25", "2026-11-24", "30"), null);
  assert.equal(erroJanelaDisponivel("2026-10-25", "", "30"), null, "sem data final não há janela");
  assert.match(erroJanelaDisponivel("2026-10-25", "2027-01-10", 90)!, /menos que a duração mínima de 90 dias/);
});
