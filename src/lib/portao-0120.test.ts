/*
  Migração 0120 (portão da publicação no banco). Roda: node --test src/lib/portao-0120.test.ts
  A prova de comportamento (antes falha, depois passa) está em supabase/testes/portao-0120-*.sql;
  aqui ficam as travas de desenho para ninguém desfazer sem querer.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const raiz = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const mig = raiz("supabase/migrations/0120_portao_publicacao.sql");
const aplicar = raiz("supabase/producao/aplicar-0120.sql");

test("#49: documento aprovado é conferido ANTES do retorno antecipado de service_role/admin", () => {
  const f = mig.slice(mig.indexOf("function public.properties_protege_campos"), mig.indexOf("-- 2) #81"));
  const portao = f.indexOf("Documentação do imóvel ainda não aprovada");
  const atalho = f.indexOf("if current_user in ('service_role'");
  assert.ok(portao > 0 && atalho > 0 && portao < atalho, "o portão tem de vir antes do atalho");
  assert.match(f, /tg_op = 'UPDATE'/);
  assert.match(f, /current_user not in \('supabase_admin', 'postgres'\)/);
});

test("#81: o gatilho das 8 fotos roda depois do que reescreve photo_count", () => {
  assert.match(mig, /create or replace trigger trg_properties_z_min_photos/);
  assert.ok("trg_properties_z_min_photos" > "trg_properties_protege_campos", "ordem alfabética = ordem de disparo");
  assert.match(mig, /tgname = 'properties_min_photos'/);
});

test("#120: visitante sem conta precisa de e-mail válido e nome de 2 a 60; código 23514", () => {
  assert.match(mig, /new\.usuario_id is null then/);
  assert.match(mig, /char_length\(btrim\(new\.visitante_nome\)\) not between 2 and 60/);
  assert.match(mig, /errcode = '23514'/);
  assert.doesNotMatch(mig, /add constraint .*chamados/i, "gatilho de INSERT, não CHECK (chamados antigos ficam sem dono)");
});

test("e-mail recebido sem nome no From usa o começo do endereço (não quebra a 0120)", () => {
  const rota = raiz("src/app/api/atendimento/email/route.ts");
  assert.match(rota, /visitante_nome: usuarioId \? null : nomeDoRemetente\(remetente\)/);
  assert.doesNotMatch(rota, /visitante_nome: usuarioId \? null : remetente\.nome/);
});

test("#26: backup do draft_data apagado só se existir; verificações não o citam mais", () => {
  assert.match(mig, /to_regclass\('public\._backup_p0_draft_data'\) is not null/);
  assert.doesNotMatch(raiz("supabase/producao/conferir-esquema.sql"), /_backup_p0_draft_data/);
  assert.doesNotMatch(raiz("supabase/producao/verificar-seguranca.sql"), /from public\._backup_p0_draft_data/);
});

test("sem comandos que gerem NOTICE e aplicar-0120 repete o corpo da migração", () => {
  assert.doesNotMatch(mig, /drop \w+ if exists/i);
  assert.match(aplicar, /0120_portao_publicacao/);
  assert.ok(aplicar.includes(mig.slice(mig.indexOf("-- 1) #49"))), "o corpo do aplicar tem de ser o da migração");
  assert.match(raiz("supabase/producao/rollback/0120_rollback.sql"), /20261014000120/);
});
