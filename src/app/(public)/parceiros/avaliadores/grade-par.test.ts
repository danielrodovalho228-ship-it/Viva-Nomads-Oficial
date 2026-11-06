/**
 * /parceiros/avaliadores: os cartões de "como funciona" (hoje 4, depois que o E648 trocou o rodízio pela escolha do dono) ficam em
 * grade PAR — 2 colunas a partir de sm — e nunca com um cartão sozinho na última linha (a 1280 px eram 3 + 1). `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

test("a grade do 'como funciona' tem colunas que dividem a quantidade de cartões", () => {
  const n = (src.match(/^\s*\{ t: "/gm) ?? []).length;
  const m = /<ul className="mt-3 grid gap-3 sm:grid-cols-(\d)">/.exec(src);
  assert.ok(m, "a lista do como funciona existe");
  assert.ok(n >= 2);
  assert.equal(n % Number(m![1]), 0, `${n} cartões em ${m![1]} colunas deixam buraco`);
});
