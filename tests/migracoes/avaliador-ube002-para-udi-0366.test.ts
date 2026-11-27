/*
  Roda: node --test tests/migracoes/avaliador-ube002-para-udi-0366.test.ts
  0366 (E1223, ORDEM-DUET-1075): o credenciamento UBE-002 passa ao próximo UDI do contador, avançando-o — só em_teste,
  sem pedidos de vistoria e com o número novo livre; senão nada muda (raise notice). Não mexe no status, na cidade nem no
  perfil. O rollback devolve UBE-002 sob as mesmas condições.
  Esta trava só LÊ o texto: é o complemento barato contra os mutantes de forma. A prova que afirma o comportamento é a
  EXECUTADA (regra da casa, ORDEM-DUET-1078): a t1797, com a fixture tests/e2e/fixtures/prova-0366.ts, os casos do coordenador corridos sobre a
  0366 e o rollback de verdade num esquema de rascunho desfeito.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const sql = (s: string) => s.replace(/--[^\n]*/g, "").replace(/\s+/g, " ").trim();
const MIG = sql(readFileSync("supabase/migrations/0366_avaliador_ube002_para_udi_e1223.sql", "utf8"));
const APLICAR = sql(readFileSync("supabase/producao/aplicar-0366.sql", "utf8"));
const ROLLBACK = sql(readFileSync("supabase/producao/rollback/0366_rollback.sql", "utf8"));

test("0366: as três condições guardam a troca, e cada uma sai sem mudar nada", () => {
  for (const [nome, s] of Object.entries({ "migração": MIG, "aplicar-0366": APLICAR })) {
    assert.match(s, /where numero_credenciado = 'UBE-002'/, `${nome}: acha o UBE-002`);
    assert.match(s, /if v_status is distinct from 'em_teste' then raise notice '[^']*'(, [^;]*)?; return; end if;/, `${nome}: só em_teste`);
    assert.match(s, /select count\(\*\) into v_pedidos from public\.vistoria_pedidos where avaliador_id = v_cred; if v_pedidos > 0 then raise notice '[^']*'(, [^;]*)?; return; end if;/, `${nome}: sem pedidos`);
    assert.match(s, /if exists \(select 1 from public\.avaliadores_credenciamento where numero_credenciado = v_novo\) or exists \(select 1 from public\.avaliadores_perfil_publico where numero = v_novo\) then raise notice '[^']*'(, [^;]*)?; return; end if;/, `${nome}: o número novo livre`);
  }
});

test("0366: o próximo UDI do contador, o contador avança, e só o número muda", () => {
  for (const [nome, s] of Object.entries({ "migração": MIG, "aplicar-0366": APLICAR })) {
    assert.match(s, /select coalesce\(\(select ultimo from public\.avaliadores_contador where sigla = 'UDI' for update\), 0\) \+ 1 into v_seguinte;/, nome);
    assert.match(s, /v_novo := 'UDI-' \|\| lpad\(v_seguinte::text, 3, '0'\);/, nome);
    assert.match(s, /insert into public\.avaliadores_contador as c \(sigla, ultimo\) values \('UDI', v_seguinte\) on conflict \(sigla\) do update set ultimo = excluded\.ultimo;/, nome);
    assert.match(s, /update public\.avaliadores_credenciamento set numero_credenciado = v_novo where id = v_cred;/, nome);
    assert.doesNotMatch(s, /set [^;]*\b(status|cidade)\s*=/, `${nome}: o status e a cidade não mudam`);
    assert.doesNotMatch(s, /update public\.avaliadores_perfil_publico|insert into public\.avaliadores_perfil_publico/, `${nome}: o perfil não muda`);
  }
});

test("aplicar-0366: numa transação curta, regista-se com o nome da migração", () => {
  assert.match(APLICAR, /^begin; set local lock_timeout = '5s';[\s\S]*commit;$/);
  assert.match(APLICAR, /insert into supabase_migrations\.schema_migrations \(version, name\) select '20261126000366', '0366_avaliador_ube002_para_udi_e1223' where not exists/);
});

test("rollback da 0366: devolve UBE-002 sob as mesmas condições, pelo registo da troca", () => {
  assert.ok(existsSync("supabase/producao/rollback/0366_rollback.sql"));
  assert.match(ROLLBACK, /^begin;[\s\S]*commit;$/);
  assert.match(ROLLBACK, /from public\.avaliadores_numero_trocas t where t\.migracao = '0366' and t\.numero_antes = 'UBE-002';/);
  assert.match(ROLLBACK, /if v_status is distinct from 'em_teste' then raise notice '[^']*'(, [^;]*)?; return; end if;/);
  assert.match(ROLLBACK, /if v_pedidos > 0 then raise notice '[^']*'(, [^;]*)?; return; end if;/);
  assert.match(ROLLBACK, /numero_credenciado = 'UBE-002'\) or exists \(select 1 from public\.avaliadores_perfil_publico where numero = 'UBE-002'\) then raise notice '[^']*'(, [^;]*)?; return; end if;/);
  assert.match(ROLLBACK, /update public\.avaliadores_credenciamento set numero_credenciado = 'UBE-002' where id = v_troca\.credenciamento_id;/);
  assert.doesNotMatch(ROLLBACK, /avaliadores_contador/, "o contador não volta atrás");
});
