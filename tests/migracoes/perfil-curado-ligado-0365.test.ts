/*
  Roda: node --test tests/migracoes/perfil-curado-ligado-0365.test.ts
  E1208 (ORDENS-DUET 986, 989 e 1020): a 0365 liga a linha curada do perfil público do avaliador
  (avaliadores_perfil_publico, 0349) ao credenciamento do MESMO número, só onde credenciamento_id está vazio e nunca o
  mesmo credenciamento a duas linhas. Só dados: não muda esquema, não cria nem apaga linhas, não toca no conteúdo curado.
  A prova executada (a 0365 corrida no banco do laboratório: liga e, reaplicada, não muda nada) está no caso 2 da t1793,
  que corre no lab-critico.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const MIG = "supabase/migrations/0365_avaliador_perfil_curado_ligado_e1208.sql";
const APLICAR = "supabase/producao/aplicar-0365.sql";
const ROLLBACK = "supabase/producao/rollback/0365_rollback.sql";
const LIGA =
  /update public\.avaliadores_perfil_publico p\s+set credenciamento_id = c\.id\s+from public\.avaliadores_credenciamento c\s+where p\.credenciamento_id is null\s+and c\.numero_credenciado = p\.numero\s+and not exists \(select 1 from public\.avaliadores_perfil_publico o where o\.credenciamento_id = c\.id\);/;

test("0365: liga a linha curada ao credenciamento do mesmo número, só onde está vazio, uma instrução só", () => {
  const m = sql(readFileSync(MIG, "utf8")).trim();
  assert.match(m, LIGA);
  assert.equal(m.split(";").filter((x) => x.trim()).length, 1, "uma instrução só");
  assert.doesNotMatch(m, /\b(insert|delete|truncate|drop|alter|create)\b/i, "só dados: nada criado, apagado ou mudado no esquema");
  assert.doesNotMatch(m, /set (nome_publico|cidade|selo|publicado|numero)\b/i, "o conteúdo curado não muda");
});

test("aplicar-0365: a mesma ligação, numa transação curta, e regista-se com o nome da migração", () => {
  const a = sql(readFileSync(APLICAR, "utf8"));
  assert.match(a.trim(), /^begin;[\s\S]*commit;$/);
  assert.match(a, /set local lock_timeout = '5s';/);
  assert.match(a, LIGA);
  assert.match(a, /insert into supabase_migrations\.schema_migrations \(version, name\)\s+select '20261126000365', '0365_avaliador_perfil_curado_ligado_e1208'\s+where not exists/);
  assert.doesNotMatch(a, /\bdelete\s+from\s+public\./i);
});

test("rollback da 0365: desliga só as linhas ligadas ao credenciamento do mesmo número e apaga o registo", () => {
  assert.ok(existsSync(ROLLBACK));
  const r = sql(readFileSync(ROLLBACK, "utf8"));
  assert.match(r.trim(), /^begin;[\s\S]*commit;$/);
  assert.match(r, /update public\.avaliadores_perfil_publico p\s+set credenciamento_id = null\s+from public\.avaliadores_credenciamento c\s+where p\.credenciamento_id = c\.id\s+and c\.numero_credenciado = p\.numero;/);
  assert.match(r, /delete from supabase_migrations\.schema_migrations where version = '20261126000365';/);
  // Caso 5 do coordenador (ORDEM-DUET-1024): o rollback só mexe na ligação — nome, cidade, selo e publicação ficam.
  assert.doesNotMatch(r, /set\s+(nome_publico|cidade|selo|publicado)\b|,\s*(nome_publico|cidade|selo|publicado)\s*=/i, "o rollback não toca nome, cidade, selo nem publicação");
  assert.doesNotMatch(r, /delete from public\./i, "o rollback não apaga linhas curadas");
});

test("a prova executada dos cinco casos corre no portão (t1793, caso 2), pelos próprios arquivos da 0365 e do rollback", () => {
  const t = readFileSync("tests/e2e/specs/t1793-e1208-perfil-curado-ligado.spec.ts", "utf8");
  assert.match(t, /readFileSync\("supabase\/migrations\/0365_avaliador_perfil_curado_ligado_e1208\.sql", "utf8"\)/);
  assert.match(t, /provarA0365\(sql, MIGRACAO_0365, ROLLBACK_0365\)/);
  assert.match(t, /readFileSync\("supabase\/producao\/rollback\/0365_rollback\.sql", "utf8"\)/);
  const f = readFileSync("tests/e2e/fixtures/prova-0365.ts", "utf8");
  assert.match(f, /create table \$\{ESQUEMA\}\.\$\{t\} \(like public\.\$\{t\} including all\)/, "as cópias levam as mesmas chaves únicas");
  assert.match(f, /await cred\("UDI-303"\); \/\/ o 3\.º credenciamento, livre/);
  assert.match(f, /await cred\("UDI-403"\); \/\/ o 3\.º credenciamento, livre/);
  for (const caso of ["caso 1: ligada", "caso 2: reaplicada", "caso 3: número sem", "caso 4: a 0365 corre sem erro", "caso 4: a 2.ª linha", "caso 5: o rollback corre sem erro", "caso 5: o rollback desliga", "caso 5: o conteúdo curado fica", "caso 5: a ligação que não é por número fica"]) {
    assert.ok(t.includes(caso), `a t1793 confere "${caso}"`);
  }
});
