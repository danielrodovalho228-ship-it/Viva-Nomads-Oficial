/* Roda: node --test src/lib/calendario/grade.test.ts — Prompt 43, item 4: uma grade para os três calendários. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { celulasDoMes, diasDoIntervalo, marcaPrincipal, marcasDaEstadia, mesesAPartirDe, mesesEntre, ymd } from "./grade.ts";

test("grade do mês começa no domingo e tem todos os dias", () => {
  const out2026 = celulasDoMes(2026, 9); // outubro de 2026 começa numa quinta
  assert.deepEqual(out2026.slice(0, 5), [null, null, null, null, 1]);
  assert.equal(out2026.filter((c) => c !== null).length, 31);
  assert.equal(celulasDoMes(2028, 1).filter(Boolean).length, 29, "fevereiro bissexto");
});

test("meses a partir de uma data viram o ano", () => {
  assert.deepEqual(mesesAPartirDe("2026-11-20", 3), [
    { ano: 2026, mes: 10 },
    { ano: 2026, mes: 11 },
    { ano: 2027, mes: 0 },
  ]);
  assert.equal(mesesEntre("2026-10-30", "2027-01-02").length, 4);
  assert.equal(mesesEntre("2026-10-01", "2028-10-01", 6).length, 6, "limite");
});

test("intervalo, estadia e prioridade das marcas", () => {
  assert.deepEqual(diasDoIntervalo("2026-12-30", "2027-01-02"), ["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.deepEqual(diasDoIntervalo("x", "2027-01-02"), []);
  const m = marcasDaEstadia("2026-11-01", "2026-11-03");
  assert.equal(marcaPrincipal(m["2026-11-01"]), "entrada");
  assert.equal(marcaPrincipal(m["2026-11-02"]), "periodo");
  assert.equal(marcaPrincipal(m["2026-11-03"]), "saida");
  assert.equal(marcaPrincipal(["hoje", "bloqueado"]), "bloqueado");
  assert.equal(marcaPrincipal([]), null);
  assert.equal(ymd(2026, 0, 5), "2026-01-05");
});
