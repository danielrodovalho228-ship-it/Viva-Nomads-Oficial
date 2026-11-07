import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E666: a legenda do calendário do anúncio diz as duas causas do "indisponível" e responde "as datas estão livres?".
const src = readFileSync(new URL("./availability-calendar.tsx", import.meta.url), "utf8");
const legenda = src.slice(src.indexOf('data-testid="calendario-legenda"'), src.indexOf("Resumo da seleção"));

test("E666: a legenda nomeia reservado e fechado pelo proprietário (e usa a mesma cor dos dias)", () => {
  assert.match(src, /ROTULO_INDISPONIVEL = "Indisponível \(já reservado ou fechado pelo proprietário\)"/);
  assert.match(legenda, /COR_DIA\.indisponivel[\s\S]{0,120}ROTULO_INDISPONIVEL/);
});

test("E666: uma linha sob a legenda responde se as datas estão livres, sem prometer data nem prazo", () => {
  assert.match(legenda, /data-testid="calendario-resposta-livres"/);
  const nota = src.match(/NOTA_DATAS_LIVRES = "([^"]+)"/)?.[1] ?? "";
  assert.match(nota, /livres para pedir/);
  assert.match(nota, /pergunte ao proprietário/);
  assert.doesNotMatch(nota, /\d/);
});

test("E666: o rótulo de acessibilidade do dia indisponível diz a causa", () => {
  assert.match(src, /\(indisponível: reservado ou fechado pelo proprietário\)/);
});
