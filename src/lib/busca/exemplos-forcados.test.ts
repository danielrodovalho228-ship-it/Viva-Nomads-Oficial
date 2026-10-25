import test from "node:test";
import assert from "node:assert/strict";
import { exemplosForcadosNaUrl, semExemplosQuandoHaReal } from "./exemplos-e-pedido.ts";

const ehExemplo = (x: { id: string }) => x.id.startsWith("ube-");
const lista = [{ id: "real-1" }, { id: "ube-001" }];

test("sem o parâmetro, o exemplo some quando há imóvel real (regra do Prompt 30)", () => {
  assert.deepEqual(semExemplosQuandoHaReal(lista, ehExemplo), [{ id: "real-1" }]);
});

test("?exemplos=1 mantém os exemplos na lista (laboratório: os specs acham o ube-001 mesmo com reais)", () => {
  assert.equal(exemplosForcadosNaUrl("?exemplos=1"), true);
  assert.equal(exemplosForcadosNaUrl("?local=x&exemplos=1"), true);
  assert.equal(exemplosForcadosNaUrl(""), false);
  assert.equal(exemplosForcadosNaUrl("?exemplos=0"), false);
  assert.deepEqual(semExemplosQuandoHaReal(lista, ehExemplo, true), lista);
});
