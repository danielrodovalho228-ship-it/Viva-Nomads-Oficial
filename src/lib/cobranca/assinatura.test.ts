import { test } from "node:test";
import assert from "node:assert/strict";
import { assinaturaIsentaComissao, mensalidadePorImoveis } from "./assinatura.ts";

test("assinatura: faixas de mensalidade e carência de 90 dias; flag desligada = nunca isenta", () => {
  assert.deepEqual([1, 2, 3, 5, 6, 10, 11, 20, 21, 50].map((n) => mensalidadePorImoveis(n)), [149, 149, 299, 299, 499, 499, 799, 799, 999, 999]);
  const desde = new Date("2026-01-01T00:00:00Z");
  const em = (d: string) => new Date(d);
  assert.equal(assinaturaIsentaComissao({ flagAtiva: true, assinaturaDesde: desde, assinadoEm: em("2026-04-01T00:00:00Z") }), true);
  assert.equal(assinaturaIsentaComissao({ flagAtiva: true, assinaturaDesde: desde, assinadoEm: em("2026-03-31T00:00:00Z") }), false);
  assert.equal(assinaturaIsentaComissao({ flagAtiva: false, assinaturaDesde: desde, assinadoEm: em("2027-01-01T00:00:00Z") }), false);
  assert.equal(assinaturaIsentaComissao({ flagAtiva: true, assinaturaDesde: null, assinadoEm: em("2027-01-01T00:00:00Z") }), false);
});
