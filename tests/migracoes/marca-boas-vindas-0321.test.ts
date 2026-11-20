/* Roda: node --test tests/migracoes/marca-boas-vindas-0321.test.ts — E287: marca de boas-vindas nas duas contas reais (sem e-mail). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const mig = sql(ler("supabase/migrations/0321_marca_boas_vindas_pioneiras_e287.sql"));
const aplRaw = ler("supabase/producao/aplicar-0321.sql");
const apl = sql(aplRaw);
const rb = ler("supabase/producao/rollback/0321_rollback.sql");

test("a chave gravada é a MESMA que enviarBoasVindas usa", () => {
  const fonte = ler("src/lib/notifications/boas-vindas-servidor.ts");
  assert.match(fonte, /CHAVE_BOAS_VINDAS = \(usuarioId: string\) => `boas_vindas:\$\{usuarioId\}`/);
  assert.match(fonte, /insert\(\{ chave: CHAVE_BOAS_VINDAS\(usuarioId\), tipo: "boas_vindas", usuario_id: usuarioId \}\)/);
  for (const s of [mig, apl]) {
    assert.match(s, /'boas_vindas:' \|\| p\.id::text, 'boas_vindas', p\.id/);
    assert.match(s, /insert into public\.automacoes_envios \(chave, tipo, usuario_id\)/);
  }
});

test("só as duas contas reais, achadas por e-mail E papel; para (exceção) se não forem exatamente duas", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /lower\(p\.email\) = 'fatima\.alves\.campanha@gmail\.com' and p\.role = 'owner'/);
    assert.match(s, /lower\(p\.email\) = 'lyamercaldi@gmail\.com' and p\.role = 'tenant'/);
    assert.match(s, /p\.is_teste is not true/);
    assert.match(s, /if achadas <> 2 then\s+raise exception/);
    assert.match(s, /on conflict \(chave\) do nothing/);
    assert.equal((s.match(/\binsert into public\./g) ?? []).length, 1);
    assert.doesNotMatch(s, /\bupdate |\bdelete |\bdrop |\btruncate |sendEmail|enviarBoasVindas|VN-CT-D5D50247|AUTOMACOES_ATIVO/i);
  }
});

test("banco sem as duas contas (laboratório, CI, banco novo): avisa e segue sem gravar; se alguma existir e não conferir, para", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /select count\(\*\) into existentes\s+from public\.profiles p\s+where lower\(p\.email\) in \('fatima\.alves\.campanha@gmail\.com', 'lyamercaldi@gmail\.com'\);/);
    assert.match(s, /if existentes = 0 then\s+raise notice 'E287:[^']*';\s+return;\s+end if;/);
    // a parada por divergência vem DEPOIS do atalho do banco sem as contas
    assert.ok(s.indexOf("if existentes = 0") < s.indexOf("if achadas <> 2"));
  }
});

test("0321: aplicar entre begin/commit e registrado; rollback tira só as duas marcas e o registro", () => {
  assert.match(aplRaw, /^-- [^\n]*\n-- [^\n]*\n-- [^\n]*\nbegin;/);
  assert.match(aplRaw, /commit;\s*$/);
  assert.match(aplRaw, /'0321_marca_boas_vindas_pioneiras_e287'/);
  assert.match(aplRaw, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261107000321'\)/);
  assert.match(rb, /delete from public\.automacoes_envios a\s+using public\.profiles p/);
  assert.match(rb, /a\.tipo = 'boas_vindas'/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261107000321'/);
});
