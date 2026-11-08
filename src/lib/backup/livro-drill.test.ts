/*
  Prompt 58 — o teste de restauração reaplica o livro de eliminações: nada eliminado volta.
  Roda: node --test src/lib/backup/livro-drill.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SQL_COM_GATILHOS, SQL_SEM_GATILHOS, SQL_LIVRO_REAPLICAR, SQL_LIVRO_VOLTOU, conferirLivro, lerLivro, motivoDoDrill } from "./drill.ts";

test("lê o livro e descarta linha fora do formato (aspas, '..', origem que não é bucket)", () => {
  const saida = ["bucket:inquilino-docs|a/b/c.png", "bucket:property-docs|u/x.pdf", "", "bucket:x|a'b", "bucket:x|../etc", "public.leads|123"].join("\n");
  assert.deepEqual(lerLivro(saida), [
    { origem: "bucket:inquilino-docs", ref: "a/b/c.png" },
    { origem: "bucket:property-docs", ref: "u/x.pdf" },
  ]);
});

test("verde só quando nada do livro sobra depois de reaplicar; vermelho trava o drill", () => {
  assert.equal(conferirLivro(3, 7, 0, false).ok, true);
  const sobrou = conferirLivro(3, 7, 1, false);
  assert.equal(sobrou.ok, false);
  assert.match(motivoDoDrill([sobrou]) ?? "", /Livro de eliminações/);
  assert.equal(conferirLivro(0, null, null, false).ok, false, "falha ao reaplicar não passa calada");
  assert.equal(conferirLivro(0, 0, 0, true).ok, true, "dump anterior ao livro: nada a reaplicar");
});

test("a reaplicação cobre os arquivos e as colunas que apontam para eles (sem guardar conteúdo)", () => {
  for (const alvo of ["storage.objects", "documentos_inquilino", "qualification_checklists", "property_ownership_checks", "property_photos"]) {
    assert.ok(SQL_LIVRO_VOLTOU.includes(alvo), `conta ${alvo}`);
    assert.ok(SQL_LIVRO_REAPLICAR.includes(alvo), `reaplica ${alvo}`);
  }
});

test("E745: a reaplicação roda com os gatilhos desligados só na sessão do banco descartável, e a recusa na produção", () => {
  assert.match(SQL_SEM_GATILHOS, /session_replication_role = 'replica'/);
  assert.match(SQL_COM_GATILHOS, /reset session_replication_role/);
  const src = readFileSync("scripts/drill/conferir.ts", "utf8");
  const i = src.indexOf("SQL_LIVRO_VOLTOU, SQL_SEM_GATILHOS, SQL_LIVRO_REAPLICAR, SQL_COM_GATILHOS, SQL_LIVRO_VOLTOU");
  assert.ok(i > 0, "ordem: conta, desliga gatilhos, reaplica, religa, conta");
  assert.match(src, /SUPABASE_DB_URL.*=== url\) return conferirLivro\(0, null, null, false\)/, "recusa quando o banco do drill é a produção");
});
