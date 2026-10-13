import assert from "node:assert/strict";
import { test } from "node:test";
import { rotaDetalheContrato } from "./contrato-rota.ts";

const ID = "3f2c1a9e-1b2d-4c3e-8f4a-5b6c7d8e9f01";

test("detalhe do dono e do inquilino com UUID", () => {
  assert.deepEqual(rotaDetalheContrato(`/dashboard/contratos/${ID}`), { tipo: "id", id: ID });
  assert.deepEqual(rotaDetalheContrato(`/dashboard/locacoes/${ID}/`), { tipo: "id", id: ID });
});

test("id que não é UUID = inválida (404)", () => {
  assert.deepEqual(rotaDetalheContrato("/dashboard/contratos/nao-e-uuid"), { tipo: "invalida" });
  assert.deepEqual(rotaDetalheContrato("/dashboard/locacoes/123"), { tipo: "invalida" });
});

test("outras rotas não são tocadas", () => {
  assert.equal(rotaDetalheContrato("/dashboard/contratos"), null);
  assert.equal(rotaDetalheContrato("/dashboard/locacoes"), null);
  assert.equal(rotaDetalheContrato(`/dashboard/contratos/${ID}/extra`), null);
  assert.equal(rotaDetalheContrato(`/dashboard/mensagens/${ID}`), null);
});
