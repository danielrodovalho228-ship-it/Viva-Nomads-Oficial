/*
  E810 — a busca pública devolve o MESMO conjunto, na MESMA ordem e com os MESMOS preços entre carregamentos.
  A ordem de relevância é a função pura `comparaRelevancia` (sem relógio nem sorteio). Este teste trava a vitrine dos 15
  exemplos: qualquer ordem de entrada (o banco e o sort não garantem a ordem de chegada) dá a mesma lista, igual à que o
  RELATORIO-011 viu no recarregamento de 12/11 (ube-001…ube-015, Jardim Karaíba a R$ 5.620/mês).
  Roda: node --test src/lib/busca/e810-ordem-busca-estavel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { comparaRelevancia } from "./ordem-estavel.ts";
import { precoDeBusca } from "./painel-filtros.ts";
import { prng } from "../ranking/ordem.ts";

const VITRINE = [
  ["ube-001", "Santa Mônica", 3960], ["ube-002", "Centro", 3130], ["ube-003", "Tibery", 4100], ["ube-004", "Umuarama", 2830],
  ["ube-005", "Aparecida", 3470], ["ube-006", "Centro", 4420], ["ube-007", "Brasil", 3020], ["ube-008", "Jardim Karaíba", 5620],
  ["ube-009", "Santa Mônica", 2580], ["ube-010", "Tibery", 3610], ["ube-011", "Osvaldo Rezende", 2670], ["ube-012", "Saraiva", 3320],
  ["ube-013", "Morada da Colina", 4540], ["ube-014", "Cidade Jardim", 6680], ["ube-015", "Fundinho", 2430],
] as const;

const vitrine = (lista: typeof SAMPLE_PROPERTIES) =>
  [...lista].sort(comparaRelevancia).map((p) => [p.id, p.neighborhood, precoDeBusca(p)] as const);

test("a vitrine dos exemplos é a mesma em qualquer ordem de chegada (50 carregamentos embaralhados)", () => {
  const sorteio = prng(20261112);
  for (let i = 0; i < 50; i++) {
    const embaralhada = [...SAMPLE_PROPERTIES].map((p) => [sorteio(), p] as const).sort((a, b) => a[0] - b[0]).map(([, p]) => p);
    assert.deepEqual(vitrine(embaralhada), VITRINE.map((v) => [...v]), `carregamento ${i}`);
  }
});

test("o conjunto não muda: só os 15 exemplos, um bairro Jardim Karaíba, a R$ 5.620/mês", () => {
  assert.equal(SAMPLE_PROPERTIES.length, 15);
  const jk = SAMPLE_PROPERTIES.filter((p) => p.neighborhood === "Jardim Karaíba");
  assert.deepEqual(jk.map((p) => [p.id, precoDeBusca(p)]), [["ube-008", 5620]]);
});

test("a busca usa a função pura na relevância e desempata por id em todas as ordens", () => {
  const fonte = readFileSync(new URL("../../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");
  assert.match(fonte, /list = \[\.\.\.list\]\.sort\(comparaRelevancia\);/);
  assert.doesNotMatch(fonte, /Math\.random/);
  for (const s of fonte.match(/\.sort\([^;]*;/g) ?? []) if (!/comparaRelevancia/.test(s)) assert.match(s, /desempatePorId/, s);
});
