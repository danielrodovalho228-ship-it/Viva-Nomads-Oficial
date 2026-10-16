import { test } from "node:test";
import assert from "node:assert/strict";
import { ATALHOS_CATEGORIA } from "./atalhos-home";

test("alt dos cartões da home não usa 'apartamento' (regra: imóvel mobiliado)", () => {
  for (const a of ATALHOS_CATEGORIA) assert.doesNotMatch(a.alt, /apartamento/i, a.rotulo);
});
