import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab da main 11/11 (0533d354, push): t132 esperava "Anúncio de exemplo" dentro de exemplo-sem-acoes. Desde o E713
// (#3408) a coluna do exemplo é só a explicação ("Este anúncio é de exemplo, …") + "Ver imóveis reais". A frase que a
// spec procura tem de existir no bloco que a tela desenha.
test("t132: o texto que a spec espera em exemplo-sem-acoes está no bloco da página do imóvel", () => {
  const spec = readFileSync("tests/e2e/specs/t132-solicitar-reserva.spec.ts", "utf8");
  const esperado = spec.match(/getByTestId\("exemplo-sem-acoes"\)\)\.toContainText\("([^"]+)"\)/)?.[1];
  assert.ok(esperado, "a spec confere um texto em exemplo-sem-acoes");
  const tela = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  const inicio = tela.indexOf('data-testid="exemplo-sem-acoes"');
  assert.ok(inicio > 0);
  const bloco = tela.slice(inicio, tela.indexOf("</div>", inicio)).replace(/\s+/g, " ");
  assert.ok(bloco.includes(esperado!), `"${esperado}" não aparece no bloco exemplo-sem-acoes`);
});
