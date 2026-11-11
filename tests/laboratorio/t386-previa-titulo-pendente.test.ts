import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TITULO_PREVIA_PENDENTE, tituloDaPrevia } from "../../src/lib/anuncio/assistente-telas.ts";
import { propertyTypeLabel } from "../../src/lib/amenities.ts";

// Lab 10/11: t386 esperava a prévia do Passo 1 com o tipo no título ("Apartamento"). Desde o E630 o título da prévia é
// só o do dono; vazio, aparece "Título ainda não definido" — o tipo escolhido fica nos chips da prévia.
test("t386: título da prévia pendente e o tipo nos chips", () => {
  assert.deepEqual(tituloDaPrevia(""), { texto: TITULO_PREVIA_PENDENTE, pendente: true });
  const spec = readFileSync("tests/e2e/specs/t386-cadastro-01-tipo.spec.ts", "utf8");
  assert.doesNotMatch(spec, /getByTestId\("previa-titulo"\)\)\.toHaveText\("(Apartamento|Casa|Studio \/ kitnet)"\)/);
  assert.match(spec, /TITULO_PREVIA_PENDENTE/);
  for (const tipo of ["apartamento", "casa", "studio"]) {
    const rotulo = propertyTypeLabel(tipo);
    assert.ok(spec.includes(`getByTestId("previa-chips")).toContainText("${rotulo}")`), `chips sem "${rotulo}"`);
  }
});
