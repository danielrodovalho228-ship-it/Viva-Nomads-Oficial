// Frente "erros/estados vazios": leitura que falha em estadia-actions não vira "só o proprietário", "contrato" ou "proposta não encontrada".
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./estadia-actions.ts", import.meta.url), "utf8");

test("o erro de leitura do imóvel, do contrato e do aditivo tem mensagem própria, antes da recusa", () => {
  assert.match(src, /const MSG_ESTADIA_SEM_LEITURA = "Não foi possível conferir os dados da estadia agora/);
  assert.equal((src.match(/if \(erroImovel\) return \{ ok: false, erro: MSG_ESTADIA_SEM_LEITURA \}/g) ?? []).length, 2);
  assert.ok(src.indexOf("if (erroImovel)") < src.indexOf('"Só o proprietário edita as instruções."'));
  assert.ok(src.indexOf("if (erroK)") < src.indexOf('"Contrato não encontrado."'));
  assert.ok(src.indexOf("if (erroAditivo) return { erro: MSG_ESTADIA_SEM_LEITURA }") < src.indexOf('if (!a) return { erro: "Proposta não encontrada." }'));
});
