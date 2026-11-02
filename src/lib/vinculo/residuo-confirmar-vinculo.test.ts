/*
  Resíduo da varredura de funções — confirmarVinculo (baixo): a confirmação do vínculo profissional lia o código
  pendente sem conferir o erro. Na falha, respondia "Peça um código primeiro." a quem acabou de receber o código; pedir
  outro manda outro e-mail e TROCA o código que a pessoa tem na mão. Agora a falha da leitura responde o erro geral
  ("tente de novo"), sem mexer em tentativas nem no código; "Peça um código" fica só para quem de fato não pediu.
  Roda: node --test src/lib/vinculo/residuo-confirmar-vinculo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export async function confirmarVinculo"), src.indexOf("\n}\n", src.indexOf("export async function confirmarVinculo")));

test("leitura do código que falha → 'tente de novo', nunca 'Peça um código primeiro'", () => {
  assert.match(fn, /const \{ data: p, error: erroLeitura \} = await admin/);
  const guarda = fn.indexOf("if (erroLeitura) return { ok: false, error: ERRO_GERAL };");
  assert.ok(guarda > 0 && guarda < fn.indexOf('"Peça um código primeiro."'), "a falha vem antes do 'sem código'");
  assert.ok(guarda < fn.indexOf(".update("), "nada é gravado na falha");
});
