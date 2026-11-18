/*
  E815 — uma só verdade sobre o que está incluído: as Regras do ube-002 diziam "Incluído no preço — Água e internet",
  mas a composição cobrava "Água, luz e gás (estimativa) R$ 200". A composição (o dinheiro) manda.
  Roda: node --test src/lib/anuncio/e815-incluido-x-composicao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { incluidosCoerentes, linhasDetalhes } from "./detalhes-anuncio.ts";
import { calcularTudoIncluido } from "../precos.ts";

const custos = (p: (typeof SAMPLE_PROPERTIES)[number]) => ({ utilitiesMode: p.utilitiesMode, utilitiesEstimate: p.utilitiesEstimate, condoFee: p.condoFee });
const incluido = (p: (typeof SAMPLE_PROPERTIES)[number]) =>
  linhasDetalhes(p.detalhesAnuncio, { tipo: p.propertyType, cidade: p.city, custos: custos(p) }).find((l) => l.chave === "incluidoNoPreco")?.texto ?? "";

test("ube-002: as Regras não prometem incluída a água que a composição cobra", () => {
  const p = SAMPLE_PROPERTIES.find((x) => x.id === "ube-002")!;
  assert.equal(calcularTudoIncluido(p).consumoFixo, 200);
  assert.equal(incluido(p), "Internet");
});

test("nenhum exemplo diz 'incluído' o que a composição do mês cobra à parte", () => {
  for (const p of SAMPLE_PROPERTIES) {
    const t = incluido(p).toLowerCase();
    const m = calcularTudoIncluido(p);
    if (m.consumoFixo > 0 || p.utilitiesMode === "real") assert.doesNotMatch(t, /água|luz|gás/, p.id);
    if (m.condominio > 0) assert.doesNotMatch(t, /condomínio/, p.id);
  }
});

test("a regra: contas cobradas (estimativa ou medidas à parte) e condomínio cobrado saem do 'incluído'", () => {
  const todos = ["agua", "luz", "gas", "internet", "condominio"] as const;
  assert.deepEqual(incluidosCoerentes(todos, { utilitiesMode: "fixed", utilitiesEstimate: 200, condoFee: 350 }), ["internet"]);
  assert.deepEqual(incluidosCoerentes(todos, { utilitiesMode: "real", utilitiesEstimate: 0, condoFee: 0 }), ["internet", "condominio"]);
  assert.deepEqual(incluidosCoerentes(todos, { utilitiesMode: "fixed", utilitiesEstimate: 0, condoFee: 0 }), [...todos]);
  assert.deepEqual(incluidosCoerentes(todos, null), [...todos], "sem os custos, a lista segue como gravada");
});

test("a página passa os custos do anúncio para as Regras", () => {
  const regras = readFileSync(new URL("../../components/property/stay-rules.tsx", import.meta.url), "utf8");
  assert.match(regras, /custos: \{ utilitiesMode: property\.utilitiesMode, utilitiesEstimate: property\.utilitiesEstimate, condoFee: property\.condoFee \}/);
});
