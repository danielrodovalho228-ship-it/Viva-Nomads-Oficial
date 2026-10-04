/*
  Gastos de marketing: validação, totais e CSV.
  Roda: node --test src/lib/marketing.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { validarGasto, valorReais, totaisPorMes, gastosCsv, type GastoMarketing } from "./marketing.ts";

test("valor em reais no formato brasileiro", () => {
  assert.equal(valorReais("1.234,56"), 1234.56);
  assert.equal(valorReais("R$ 350,5"), 350.5);
  assert.equal(valorReais("350.5"), 350.5);
  assert.ok(Number.isNaN(valorReais("abc")));
  assert.ok(Number.isNaN(valorReais("")));
});

test("lançamento válido vira linha do dia 1", () => {
  const r = validarGasto({ mes: "2026-09", canal: "instagram", valor: "350,00", observacao: "  impulsionamento " });
  assert.deepEqual(r, { ok: true, linha: { mes: "2026-09-01", canal: "instagram", valor: 350, observacao: "impulsionamento" } });
});

test("recusa mês, canal e valor inválidos", () => {
  assert.equal(validarGasto({ mes: "2026-13", canal: "google", valor: 1 }).ok, false);
  assert.equal(validarGasto({ mes: "2026-09", canal: "tiktok", valor: 1 }).ok, false);
  assert.equal(validarGasto({ mes: "2026-09", canal: "google", valor: "-1" }).ok, false);
  assert.equal(validarGasto({ mes: "2026-09", canal: "google", valor: "" }).ok, false);
  assert.equal(validarGasto({ mes: "2026-09", canal: "google", valor: 0 }).ok, true);
});

test("totais por mês sem erro de centavos", () => {
  const g: GastoMarketing[] = [
    { id: "1", mes: "2026-08-01", canal: "google", valor: 0.1, observacao: null },
    { id: "2", mes: "2026-08-01", canal: "outro", valor: 0.2, observacao: null },
    { id: "3", mes: "2026-09-01", canal: "instagram", valor: 100, observacao: null },
  ];
  assert.deepEqual(totaisPorMes(g), [
    { mes: "2026-09-01", total: 100 },
    { mes: "2026-08-01", total: 0.3 },
  ]);
  assert.deepEqual(totaisPorMes([]), []);
});

test("CSV com ; e aspas escapadas", () => {
  const csv = gastosCsv([{ id: "1", mes: "2026-09-01", canal: "indicacao", valor: 50, observacao: 'bônus; "amigo"' }]);
  assert.equal(csv, 'mes;canal;valor;observacao\n2026-09;Indicação;50,00;"bônus; ""amigo"""');
});
