import { test } from "node:test";
import assert from "node:assert/strict";
import { validarAvisoFotografo, TITULO_SEM_FOTOGRAFO } from "./aviso.ts";

test("avise-me de fotógrafo: cidade + UF válidas; sem UF pede o CEP; texto da busca vazia", () => {
  const ok = validarAvisoFotografo({ cidade: "  Uberlândia ", uf: "mg" });
  assert.ok(ok.ok);
  assert.equal(ok.ok && ok.uf, "MG");
  assert.equal(ok.ok && ok.cidade, "Uberlândia");
  assert.equal(ok.ok && ok.chave, "uberlandia");
  assert.equal(validarAvisoFotografo({ cidade: "Uberlândia", uf: "" }).ok, false);
  assert.equal(validarAvisoFotografo({ cidade: "x", uf: "MG" }).ok, false);
  assert.equal(TITULO_SEM_FOTOGRAFO("Uberlândia"), "Ainda não temos fotógrafo parceiro em Uberlândia.");
});
