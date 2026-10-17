import test from "node:test";
import assert from "node:assert/strict";
import { normalizarBusca } from "./buscas-salvas.ts";

test("busca salva guarda os filtros em ordem fixa (quartos antes de homeoffice), como o spec t125 consulta", () => {
  const salva = normalizarBusca("?local=Uberl%C3%A2ndia&homeoffice=1&quartos=2&utm=x");
  assert.match(salva, /quartos=2.*homeoffice=1/);
  assert.doesNotMatch(salva, /utm/);
  assert.equal(normalizarBusca("homeoffice=1&quartos=2&local=Uberl%C3%A2ndia"), salva);
});
