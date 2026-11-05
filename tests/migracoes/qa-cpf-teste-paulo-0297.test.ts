/* Roda: node --test tests/migracoes/qa-cpf-teste-paulo-0297.test.ts — massa da reprova final do E562 (05/11 09:39). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cpfValido } from "../../src/lib/documento-pessoa.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const sql = (s: string) => s.replace(/--[^\n]*/g, "");
const mig = sql(ler("supabase/migrations/0297_qa_cpf_teste_proprietario2_e562.sql"));
const aplRaw = ler("supabase/producao/aplicar-0297.sql");
const apl = sql(aplRaw);
const rb = ler("supabase/producao/rollback/0297_rollback.sql");

test("o CPF de teste passa nos dígitos verificadores (o mesmo conferido no app e no banco)", () => {
  assert.equal(cpfValido("00000000191"), true);
});

test("0297 (arquivo e aplicar): só a conta de TESTE do Paulo, só se ainda sem CPF, PF, número livre", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /lower\(email\) = 'proprietario2@vivanomads\.com\.br' and is_teste/);
    assert.match(s, /c_cpf constant text := '00000000191'/);
    assert.match(s, /update public\.profiles set cpf = c_cpf where id = v_paulo and cpf is null and cnpj is null and coalesce\(person_type, 'pf'\) = 'pf';/);
    assert.match(s, /if exists \(select 1 from public\.profiles where cpf = c_cpf and id <> v_paulo\) then/);
    assert.equal((s.match(/\bupdate /g) ?? []).length, 1);
    assert.doesNotMatch(s, /insert into public\.|delete from public|VN-CT-D5D50247|AUTOMACOES|properties|contratos|leads|propostas/i);
  }
});

test("0297: aplicar entre begin/commit e registrado; rollback tira só o CPF de teste e o registro", () => {
  assert.match(aplRaw, /^-- [^\n]*\n-- [^\n]*\nbegin;/);
  assert.match(aplRaw, /commit;\s*$/);
  assert.match(aplRaw, /'20261105000297', '0297_qa_cpf_teste_proprietario2_e562'[\s\S]*where not exists/);
  assert.match(rb, /update public\.profiles set cpf = null where lower\(email\) = 'proprietario2@vivanomads\.com\.br' and is_teste and cpf = '00000000191';/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261105000297';/);
});
