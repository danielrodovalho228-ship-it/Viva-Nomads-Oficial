/*
  Prompt 58 — resumo da semana na seção "Dados e retenção".
  Roda: node --test src/lib/minimizacao/painel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { resumoDaSemana } from "./painel.ts";

test("só os últimos 7 dias; contas de teste à parte", () => {
  const agora = new Date("2026-11-10T12:00:00Z");
  const r = resumoDaSemana(
    [
      { tipo: "inquilino-docs/recusado", motivo: "prazo", teste: false, eliminado_em: "2026-11-09T03:00:00Z" },
      { tipo: "inquilino-docs/recusado", motivo: "prazo", teste: true, eliminado_em: "2026-11-09T03:00:00Z" },
      { tipo: "property-photos", motivo: "decisao", teste: false, eliminado_em: "2026-11-05T03:00:00Z" },
      { tipo: "property-photos", motivo: "decisao", teste: false, eliminado_em: "2026-11-01T03:00:00Z" },
    ],
    agora,
  );
  assert.equal(r.total, 2);
  assert.equal(r.teste, 1);
  assert.deepEqual(r.porItem, [
    { tipo: "inquilino-docs/recusado", motivo: "prazo", n: 1, teste: 1 },
    { tipo: "property-photos", motivo: "decisao", n: 1, teste: 0 },
  ]);
});
