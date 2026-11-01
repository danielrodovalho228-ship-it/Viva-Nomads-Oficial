/* Roda: node --test src/lib/anuncio/icones-unicos.test.ts — conformidade do cadastro (Passo 5, 01/11): um ícone por
   comodidade. Nenhuma comodidade do catálogo divide o ícone com outra (antes 3 pares dividiam). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ICONE_POR_CHAVE } from "./comodidades-icones.ts";

test("cada chave do catálogo tem um ícone só dela", () => {
  const vistos = new Map<unknown, string>();
  for (const [chave, icone] of Object.entries(ICONE_POR_CHAVE)) {
    assert.ok(!vistos.has(icone), `${chave} repete o ícone de ${vistos.get(icone)}`);
    vistos.set(icone, chave);
  }
});
