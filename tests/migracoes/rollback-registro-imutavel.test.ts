/*
  Rollbacks e o registro imutável: `documentos_registro` tem o gatilho documentos_registro_imutavel, que barra todo
  DELETE ("Documento registrado não pode ser apagado."). Os rollbacks 0260, 0261 e 0268 apagavam do registro e
  falhariam no meio se fossem rodados. Agora anulam (status 'anulado' com motivo), como 0247 e 0296.
  Roda: node --test tests/migracoes/rollback-registro-imutavel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const DIR = "supabase/producao/rollback/";
const semComentarios = (s: string) => s.replace(/--.*$/gm, "");

test("nenhum rollback apaga do registro imutável (documentos_registro)", () => {
  const culpados = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => /delete\s+from\s+public\.documentos_registro/i.test(semComentarios(readFileSync(DIR + f, "utf8"))));
  assert.deepEqual(culpados, []);
});

test("0260, 0261 e 0268 anulam o registro (só os válidos, com motivo)", () => {
  for (const n of ["0260", "0261", "0268"]) {
    const c = semComentarios(readFileSync(`${DIR}${n}_rollback.sql`, "utf8"));
    assert.match(c, /update public\.documentos_registro\s+set status = 'anulado', anulado_motivo = '[^']{10,}'/, n);
    assert.match(c, /where status = 'valido'/, n);
  }
});
