// Frente "erros/estados vazios": na lista de candidaturas do morador, leitura que falha não vira "ninguém falou" nem "sem contrato".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./leads-actions.ts", import.meta.url), "utf8");

test("as leituras das mensagens do dono e dos contratos checam o erro como a leitura principal", () => {
  assert.match(src, /const \{ data: msgs, error: erroMsgs \} = await supabase/);
  assert.match(src, /if \(erroMsgs && opcoes\.exigir\) throw new Error\(MSG_CANDIDATURAS_NAO_CARREGARAM\)/);
  assert.match(src, /const \{ data: contratos, error: erroContratos \} = await supabase/);
  assert.match(src, /if \(erroContratos && opcoes\.exigir\) throw new Error\(MSG_CANDIDATURAS_NAO_CARREGARAM\)/);
  // O erro é checado ANTES de montar o conjunto e o mapa (não depois).
  assert.ok(src.indexOf("if (erroMsgs") < src.indexOf("const engajou"));
  assert.ok(src.indexOf("if (erroContratos") < src.indexOf("const contratoDoLead"));
});
