/*
  E517 — data de entrada vinda da busca e indisponível NÃO fica pré-selecionada no calendário do anúncio.
  Casos do QA: ube-003 só aceita a partir de 21/11 (busca com 15/11); ube-015 só a partir de 08/01/2027.
  Roda: node --test src/lib/imovel/e517-data-da-busca.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { entradaDaBusca } from "./selecao-estadia.ts";

const HOJE = "2026-11-05";

test("antes da disponibilidade: sem seleção e com aviso que diz a primeira data", () => {
  const r = entradaDaBusca("2026-11-15", { availableFrom: "2026-11-21", minDias: 30, hoje: HOJE });
  assert.equal(r.entrada, "");
  assert.match(r.aviso ?? "", /15\/11\/2026.*a partir de 21\/11\/2026/);
  const r2 = entradaDaBusca("2026-11-15", { availableFrom: "2027-01-08T00:00:00Z", minDias: 30, hoje: HOJE });
  assert.equal(r2.entrada, "");
  assert.match(r2.aviso ?? "", /a partir de 08\/01\/2027/);
});

test("dentro da disponibilidade: pré-seleciona como antes", () => {
  assert.deepEqual(entradaDaBusca("2026-11-21", { availableFrom: "2026-11-21", minDias: 30, hoje: HOJE }), { entrada: "2026-11-21", aviso: null });
  assert.deepEqual(entradaDaBusca("2026-12-01", { availableFrom: null, minDias: 30, hoje: HOJE }), { entrada: "2026-12-01", aviso: null });
});

test("sem espaço para o mínimo antes do fim da disponibilidade: sem seleção, com aviso", () => {
  const r = entradaDaBusca("2027-01-20", { availableFrom: "2026-11-01", availableUntil: "2027-02-01", minDias: 30, hoje: HOJE });
  assert.equal(r.entrada, "");
  assert.match(r.aviso ?? "", /estadia mínima de 30 dias/);
  assert.equal(entradaDaBusca("2027-01-01", { availableFrom: "2026-11-01", availableUntil: "2027-02-01", minDias: 30, hoje: HOJE }).entrada, "2027-01-01");
});

test("data vazia ou estranha: nada a pré-selecionar, sem aviso", () => {
  assert.deepEqual(entradaDaBusca("", { hoje: HOJE }), { entrada: "", aviso: null });
  assert.deepEqual(entradaDaBusca("15/11", { hoje: HOJE }), { entrada: "", aviso: null });
});

test("página do imóvel: a busca passa pela regra e o aviso aparece acima do calendário", () => {
  const p = readFileSync(new URL("../../app/(public)/imoveis/[id]/property-detail.tsx", import.meta.url), "utf8");
  assert.match(p, /entradaDaBusca\(inicio, \{ availableFrom: property\.availableFrom, availableUntil: property\.availableUntil, minDias: property\.minPeriodDays, hoje: hojeBR\(\) \}\)/);
  assert.doesNotMatch(p, /comEntrada\(atual, inicio\)/, "a data crua da busca não entra mais direto");
  assert.match(p, /data-testid="aviso-data-busca"/);
});
