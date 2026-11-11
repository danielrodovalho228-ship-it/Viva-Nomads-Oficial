import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Lab 10/11: t547 esperava o texto do modelo fixo já DENTRO dos campos do Passo 7. Desde o E613 a sugestão fica no
// cartão "Sugestão com os dados do cadastro" e só entra nos campos no clique "Usar esta sugestão".
test("t547: confere o modelo no cartão e só depois do clique nos campos", () => {
  const spec = readFileSync("tests/e2e/specs/t547-e148a-texto-sugerido-passo7.spec.ts", "utf8");
  const iCartao = spec.indexOf('getByTestId("sugestao-titulo")');
  const iUsar = spec.indexOf('getByTestId("sugestao-usar").click()');
  const iCampo = spec.indexOf('toHaveValue("Apartamento mobiliado de 2 quartos no Santa Mônica"');
  assert.ok(iCartao > 0, "a spec não confere o título no cartão da sugestão");
  assert.ok(iUsar > iCartao, "a spec não clica em 'Usar esta sugestão' depois de conferir o cartão");
  assert.ok(iCampo > iUsar, "o campo só pode ter o texto do modelo depois do clique (E613)");
  // Antes do clique, os campos continuam vazios.
  assert.match(spec.slice(iCartao, iUsar), /cadastro-titulo"\)\)\.toHaveValue\(""\)|titulo\)\.toHaveValue\(""\)/);
});
