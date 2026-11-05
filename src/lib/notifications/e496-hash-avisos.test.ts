/* Roda: node --test src/lib/notifications/e496-hash-avisos.test.ts — E496: "#avisos" duplicado não deixa a página em estado errado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deveIrParaAvisos, hashAvisosNormalizado } from "./ir-para-avisos.ts";

test("E496: a âncora repetida (#avisos#avisos, build de produção) ainda leva à lista", () => {
  assert.equal(deveIrParaAvisos("#avisos"), true);
  assert.equal(deveIrParaAvisos("#avisos#avisos"), true);
  assert.equal(deveIrParaAvisos("#avisos#avisos#avisos"), true);
  assert.equal(deveIrParaAvisos(""), false);
  assert.equal(deveIrParaAvisos("#preferencias"), false);
  assert.equal(deveIrParaAvisos("#avisos#outra"), false);
});

test("E496: só a âncora repetida pede correção do endereço (para a forma única)", () => {
  assert.equal(hashAvisosNormalizado("#avisos#avisos"), "#avisos");
  assert.equal(hashAvisosNormalizado("#avisos"), null);
  assert.equal(hashAvisosNormalizado(""), null);
  assert.equal(hashAvisosNormalizado("#avisos#outra"), null);
});

test("E496: a tela acerta o endereço sem perder o estado do roteador", () => {
  const c = readFileSync(new URL("../../components/account/ir-para-avisos.tsx", import.meta.url), "utf8");
  assert.match(c, /const certo = hashAvisosNormalizado\(window\.location\.hash\);/);
  assert.match(c, /window\.history\.replaceState\(window\.history\.state, "", `\$\{window\.location\.pathname\}\$\{window\.location\.search\}\$\{certo\}`\)/);
});
