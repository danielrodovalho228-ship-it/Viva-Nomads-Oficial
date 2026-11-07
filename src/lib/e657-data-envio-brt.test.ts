/*
  E657 — "Enviada em" da lista de candidaturas (e outras listas) lia o carimbo de data cortando o texto UTC
  (`iso.slice(0, 10)`): a data mostrada era a do calendário UTC, não a de Brasília — uma candidatura enviada à noite
  em Brasília aparecia com outro dia. Toda data de CARIMBO (timestamptz) exibida passa por dataBRT (America/Sao_Paulo).
  Roda: node --test src/lib/e657-data-envio-brt.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dataBRT } from "./datas-brasilia.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("dataBRT: 22h de Brasília (01h UTC do dia seguinte) segue sendo o dia do envio", () => {
  assert.equal(dataBRT("2026-11-07T01:30:00+00:00"), "06/11/2026");
  assert.equal(dataBRT("2026-11-06T15:00:00Z"), "06/11/2026");
});

test("a lista de candidaturas mostra a data de envio no calendário de Brasília", () => {
  const src = ler("app/(dashboard)/dashboard/candidaturas/page.tsx");
  assert.match(src, /Enviada em \{dataBRT\(c\.createdAt\)\}/);
  assert.doesNotMatch(src, /function dataBR\(/);
  assert.doesNotMatch(src, /slice\(0, 10\)/);
});

for (const [arquivo, ruim] of [
  ["app/(dashboard)/admin/moderacao/ofensas/page.tsx", /dataBR\(o\.criadoEm\.slice\(0, 10\)\)/],
  ["app/(dashboard)/dashboard/fechamento/closing-flow.tsx", /estadoContrato\.criadoEm\.slice\(0, 10\)/],
] as const) {
  test(`${arquivo.split("/").slice(-2).join("/")}: carimbo exibido sem cortar o texto UTC`, () => {
    assert.doesNotMatch(ler(arquivo), ruim);
  });
}
