/* Roda: node --test src/lib/cep/bairro.test.ts — E147: bairro nunca é o estado nem a cidade. */
import test from "node:test";
import assert from "node:assert/strict";
import { bairroAceitavel, problemaDoBairro } from "./bairro.ts";

test("E147 — estado (nome ou sigla), Brasil e a própria cidade não valem como bairro", () => {
  assert.equal(problemaDoBairro("Minas Gerais"), "“Minas Gerais” é um estado, não um bairro. Informe o bairro do imóvel.");
  assert.ok(problemaDoBairro("minas gerais"));
  assert.ok(problemaDoBairro("MG"));
  assert.ok(problemaDoBairro("São Paulo"), "o estado São Paulo");
  assert.ok(problemaDoBairro("Brasil"));
  assert.equal(problemaDoBairro("Uberlândia", "Uberlândia"), "“Uberlândia” é a cidade, não o bairro. Informe o bairro do imóvel.");
  assert.equal(problemaDoBairro("Santa Mônica", "Uberlândia"), null);
  assert.equal(problemaDoBairro("Bairro Brasil", "Uberlândia"), null, "bairro que só contém a palavra vale");
  assert.equal(problemaDoBairro(""), null);
  assert.equal(bairroAceitavel("Minas Gerais", "Uberlândia"), "");
  assert.equal(bairroAceitavel(" Tibery ", "Uberlândia"), "Tibery");
});
