/* E101 — linha de localização sem separador pendurado. Roda: node --test src/lib/localizacao.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { linhaLocalizacao } from "./localizacao.ts";

test("junta bairro, cidade e UF só com o que existe", () => {
  assert.equal(linhaLocalizacao("Santa Mônica", "Uberlândia", "mg"), "Santa Mônica, Uberlândia - MG");
  assert.equal(linhaLocalizacao("Santa Mônica", "Uberlândia", ""), "Santa Mônica, Uberlândia");
  assert.equal(linhaLocalizacao("Santa Mônica", "Uberlândia", null), "Santa Mônica, Uberlândia");
  assert.equal(linhaLocalizacao("", "Uberlândia", "MG"), "Uberlândia - MG");
  assert.equal(linhaLocalizacao(undefined, "Uberlândia", undefined), "Uberlândia");
  assert.equal(linhaLocalizacao("  ", " Uberlândia ", " "), "Uberlândia");
  assert.equal(linhaLocalizacao("", "", ""), "");
  for (const s of [linhaLocalizacao("A", "B", ""), linhaLocalizacao("", "B", "MG"), linhaLocalizacao("A", "", "")]) assert.doesNotMatch(s, /^[ ,-]|[ ,-]$/);
});
