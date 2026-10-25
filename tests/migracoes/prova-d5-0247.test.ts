import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 0247 — dados de teste da prova do disparo D-5 (Onda 2 / Prompt 38). Só contas is_teste e o anúncio [TESTE QA]
// 330ebf37; ids fixos d5d50247-… para o desfazer; nada de conta, anúncio ou contrato real.
const sql = readFileSync("supabase/migrations/0247_dados_teste_prova_d5.sql", "utf8");
const aplicar = readFileSync("supabase/producao/aplicar-0247.sql", "utf8");
const rollback = readFileSync("supabase/producao/rollback/0247_rollback.sql", "utf8");
const semComentarios = (s: string) => s.replace(/--.*$/gm, "");
const corpo = (s: string) => semComentarios(s).slice(semComentarios(s).indexOf("do $$"), semComentarios(s).indexOf("end;\n$$;") + 8);

test("0247: o aplicar repete o corpo da migração e se registra com o nome dela", () => {
  assert.equal(corpo(aplicar), corpo(sql));
  assert.match(aplicar, /^begin;$/m);
  assert.match(aplicar, /^commit;$/m);
  assert.match(aplicar, /select '20261025000247', '0247_dados_teste_prova_d5',/);
  assert.match(aplicar, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261025000247'\)/);
});

test("0247: só contas de teste (e-mail E is_teste) e o anúncio [TESTE QA] ativo do dono de teste; senão, nada", () => {
  const c = semComentarios(sql);
  for (const email of ["proprietario1@vivanomads.com.br", "inquilino2@vivanomads.com.br", "proprietario3cnpj@vivanomads.com.br"]) {
    assert.match(c, new RegExp(`where lower\\(email\\) = '${email.replace(/\./g, "\\.")}' and is_teste;`));
  }
  assert.match(c, /if v_dono is null or v_morador is null or v_parceiro_user is null then[\s\S]*?return;/);
  assert.match(c, /where id = c_imovel and owner_id = v_dono and status = 'active' and title like '\[TESTE QA%'/);
  // Não é o ddf86c66 (jornada 11281a61) e não sobrepõe contrato ativo.
  assert.doesNotMatch(c, /ddf86c66/);
  assert.match(c, /if exists \(select 1 from public\.contratos where property_id = c_imovel and status = 'ativo'\) then[\s\S]*?return;/);
  // Só insere (nada de update/delete em dado existente), com uma exceção: devolver o status dos pedidos da Ana.
  assert.doesNotMatch(c, /\bdelete\b/i);
  const updates = [...c.matchAll(/\bupdate public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(updates, ["pedidos_moradia"]);
  assert.match(c, /where pm\.id = antes\.id and pm\.status is distinct from antes\.status;/);
});

test("0247: a estadia sai em 31/10/2026, ativa e assinada; o vínculo de limpeza é ativo e automático; o parceiro, publicado", () => {
  const c = semComentarios(sql);
  assert.match(c, /values \(c_bloco, c_contrato, 1, '2026-10-01', '2026-10-31', 1, 3200, 3200, 'ativo'\);/);
  assert.match(c, /'ativo', 'caucao',\s+'2026-09-30 15:00:00\+00', '2026-09-30 15:30:00\+00'\);/);
  assert.match(c, /values \(c_vinculo, c_imovel, 'limpeza', c_parceiro, c_servico, 'automatico', 'ativo', now\(\)\);/);
  assert.match(c, /'teste-qa-limpeza-d5',\s+array\['limpeza'\], array\['Uberlândia'\], '[^']+', 'publicado', now\(\)\);/);
  assert.match(c, /'ativada', now\(\), 'suporte'\);/);
});

test("0247: o desfazer remove pelos ids fixos, na ordem das chaves, e anula (não apaga) o registro do documento", () => {
  const c = semComentarios(rollback);
  const ids = new Set([...semComentarios(sql).matchAll(/'(d5d50247-[0-9a-f-]{27})'/g)].map((m) => m[1]));
  assert.equal(ids.size, 6);
  const ordem = [
    "delete from public.messages",
    "update public.documentos_registro",
    "delete from public.parceiro_pedidos",
    "delete from public.automacoes_envios",
    "delete from public.imovel_parceiros",
    "delete from public.parceiro_servicos",
    "delete from public.parceiros",
    "delete from public.parceiro_solicitacoes",
    "delete from public.contratos",
    "delete from supabase_migrations.schema_migrations where version = '20261025000247'",
  ].map((s) => c.indexOf(s));
  assert.ok(ordem.every((i) => i >= 0), "todos os passos presentes");
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem, "na ordem");
  assert.doesNotMatch(c, /delete from public\.documentos_registro/);
  assert.match(c, /set status = 'anulado', anulado_motivo = '[^']{5,}'/);
  // Todo delete é por um dos ids da prova (nenhum delete solto).
  for (const linha of c.split(";").filter((s) => /\bdelete from public\./.test(s))) {
    assert.ok([...ids].some((id) => linha.includes(id)), `delete sem id da prova: ${linha.trim().slice(0, 80)}`);
  }
  assert.doesNotMatch(c, /\b(profiles|properties|pedidos_moradia)\b/);
});
