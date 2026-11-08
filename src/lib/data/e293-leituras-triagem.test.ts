// Frente "erros/estados vazios": na triagem do comprovante de vínculo, leitura que falha não vira "nenhum comprovante",
// "não encontrado" nem "já foi decidido".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./triagem-actions.ts", import.meta.url), "utf8");

test("as três leituras checam o erro antes de concluir 'vazio'", () => {
  assert.match(src, /const MSG_TRIAGEM_SEM_LEITURA = "Não foi possível conferir o comprovante agora/);
  assert.equal((src.match(/if \(erroLeitura\) return \{ ok: false, error: MSG_TRIAGEM_SEM_LEITURA \}/g) ?? []).length, 2);
  assert.ok(src.indexOf("if (erroLeitura)") < src.indexOf('"Nenhum comprovante enviado."'));
  assert.match(src, /if \(error\) return \{ ok: false, error: MSG_TRIAGEM_SEM_LEITURA \};\s*if \(!data\?\.length\) return \{ ok: false, error: "Este envio já foi decidido/);
  assert.doesNotMatch(src, /if \(error \|\| !data\?\.length\)/);
});
