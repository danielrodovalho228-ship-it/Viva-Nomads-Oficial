/* Roda: node --test tests/migracoes/avaliacoes-criterios-0322.test.ts — E679-B parte 1 (critérios por par, documento, fato falso × caução). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CRITERIOS, RE_ASSUNTO_CAUCAO } from "../../src/lib/avaliacoes-criterios.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const sem = (s: string) => s.replace(/--[^\n]*/g, "");
const mig = sem(ler("supabase/migrations/0322_avaliacoes_criterios_e679.sql"));
const apl = sem(ler("supabase/producao/aplicar-0322.sql"));
const rb = ler("supabase/producao/rollback/0322_rollback.sql");

test("as chaves de critério do banco são as mesmas do TypeScript", () => {
  const ts = (par: keyof typeof CRITERIOS) => CRITERIOS[par].map((c) => `'${c.chave}'`).join(", ");
  for (const s of [mig, apl]) {
    assert.ok(s.includes(`array[${ts("morador_avalia_dono")}]`));
    assert.ok(s.includes(`array[${ts("dono_avalia_morador")}]`));
  }
});

test("ao enviar exige os 3 critérios e 'recomendaria'; rascunho segue livre; documento vai para a moderação", () => {
  for (const s of [mig, apl]) {
    assert.match(s, /if new\.status <> 'rascunho' then[\s\S]*<> 3 then[\s\S]*recomendaria is null/);
    assert.match(s, /contem_documento\(new\.comentario_publico\)/);
    assert.match(s, /dado pessoal \(telefone, e-mail, rede social ou documento\)/);
  }
});

test("fato falso: o gatilho do banco usa a mesma lista de assuntos da caução do TypeScript", () => {
  const termos = ["caucao", "deposito", "garantia", "dano", "danific", "estrag", "quebr", "sujeir", "sujo", "suja", "limpeza", "conserto", "desconto", "descontad", "ressarc", "indeniza", "devolucao"];
  for (const s of [mig, apl]) {
    assert.match(s, new RegExp(`\\\\m\\(${termos.join("\\|")}\\)`));
    assert.match(s, /new\.motivo = 'fato_falso'/);
    assert.match(s, /before insert on public\.avaliacao_contestacoes/);
  }
  for (const t of termos) assert.ok(RE_ASSUNTO_CAUCAO.test(t === "caucao" ? "caução" : t === "deposito" ? "depósito" : t === "devolucao" ? "devolução" : t), t);
});

test("não mexe em dados nem em chaves; aplicar registra e o rollback desfaz", () => {
  for (const s of [mig, apl]) assert.doesNotMatch(s, /\bdelete from public|\btruncate|\bupdate public\.avaliacoes|AUTOMACOES_ATIVO|ORDEM_NOVA_ATIVA|VN-CT-D5D50247/i);
  assert.match(apl, /begin;[\s\S]*20261107000322[\s\S]*commit;/);
  assert.match(rb, /drop trigger if exists avaliacao_contestacao_assunto_caucao/);
  assert.match(rb, /create or replace function public\.avaliacao_valida\(\)/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261107000322'/);
});
