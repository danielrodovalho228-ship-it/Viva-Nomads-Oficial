import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Rodada completa do lab 10/11: t799 procurava em cada bloco de convivência um elemento com testid terminado em
// "-icone". Desde o E193 (c83bc24f) o bloco é o cartão grande do assistente (CartaoEscolha, data-cartao-assistente) e o
// ícone é o svg filho direto do cartão — sem testid. A spec confere o svg no cartão do bloco.
test("t799: o ícone da regra é o svg do cartão do assistente, e a spec procura por ele", () => {
  const cartao = readFileSync("src/components/anuncio/escolha-assistente.tsx", "utf8");
  assert.match(cartao, /data-cartao-assistente/);
  assert.match(cartao, /\{Icone && <Icone className=/);
  const bloco = readFileSync("src/components/anuncio/bloco-opcional.tsx", "utf8");
  assert.match(bloco, /icone=\{Icone\}/);
  const regras = readFileSync("src/components/anuncio/regras-casa-campos.tsx", "utf8");
  assert.match(regras, /icone=\{ICONE_REGRA\[chave\]\}/);
  assert.doesNotMatch(readFileSync("src/components/anuncio/escolha-assistente.tsx", "utf8"), /-icone`/);
  const spec = readFileSync("tests/e2e/specs/t799-cadastro-regras-icones.spec.ts", "utf8");
  assert.doesNotMatch(spec, /\[data-testid\$='-icone'\]/, "testid -icone não existe mais no bloco");
  assert.match(spec, /:scope > \[data-cartao-assistente\] > svg/);
});
