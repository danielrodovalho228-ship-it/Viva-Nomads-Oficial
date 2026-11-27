/*
  E582 (resíduo): o ramo "sem CPF" do portão do CPF estava BLOQUEADO POR DADOS — faltava um morador de teste sem CPF com uma candidatura em
  andamento. A 0307 grava UMA candidatura para um morador de teste que já existia e estava parado, sem tocar em conta nenhuma das rodadas.
  A prova ao vivo do ramo é do QA do chat principal; esta pista só cria e reporta a fixture.
  Roda: node --test src/lib/qa/massa-e582-morador-sem-cpf.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0307_qa_morador_sem_cpf_candidatura_e582.sql");
const codigo = mig.replace(/--.*$/gm, "");

test("E582: a fixture é UMA candidatura nova (id fixo) de um morador de teste sem CPF, num anúncio do dono de teste que tem CPF", () => {
  assert.equal((codigo.match(/insert into public\.leads/g) ?? []).length, 1);
  assert.match(codigo, /c_lead constant uuid := 'a0307000-0000-4000-8000-000000000001'/);
  assert.match(codigo, /values \(c_lead, c_dono, c_morador, c_anuncio, 'new'/);
  // o morador: conta de teste, tenant, SEM CPF e SEM CNPJ
  assert.match(codigo, /id = c_morador and is_teste and role = 'tenant' and cpf is null and cnpj is null/);
  // o dono: conta de teste COM CPF (para o aceite passar e o Fechamento esbarrar no morador)
  assert.match(codigo, /id = c_dono and is_teste and cpf is not null/);
  assert.match(codigo, /owner_id = c_dono and status::text = 'active'/);
});

test("E582: só inclui — nada de update/delete, perfil, CPF, anúncio, contrato ou chave; idempotente e com guardas", () => {
  assert.doesNotMatch(codigo, /\b(update|delete|alter|drop|truncate)\b/i);
  assert.doesNotMatch(codigo, /insert into public\.(profiles|properties|contratos|propostas)/);
  assert.doesNotMatch(mig.replace(/--.*$/gm, ""), /AUTOMACOES_ATIVO|d5d50247|app_config|chaves/i);
  assert.match(codigo, /if exists \(select 1 from public\.leads where id = c_lead\)/); // idempotente
  assert.match(codigo, /where tenant_id = c_morador\) or exists \(select 1 from public\.contratos where tenant_id = c_morador\)/); // morador parado
});

test("E582: não usa as contas nem os anúncios das rodadas em andamento", () => {
  // morador e anúncio da fixture vs. as contas de QA das rodadas (inquilino1/2, cadastro*, qa-muse-*, avaliador1) e seus ids
  const usados = new Set(codigo.match(/'[0-9a-f]{8}-[0-9a-f-]{27}'/g) ?? []);
  for (const id of ["671f2146", "3555816b", "5a7e6b54", "dec5f8b6", "76050170", "c1700e69", "bb31a41e", "2982eee5", "d7a065c7", "5a9a23cd", "330ebf37", "ddf86c66", "126b23ed"]) {
    assert.ok(![...usados].some((u) => u.includes(id)), id);
  }
  assert.match(codigo, /c_morador constant uuid := '22eccf89-2bae-4be8-97af-239c0e34f1aa'/);
  assert.match(codigo, /c_anuncio constant uuid := 'a0259000-0000-4000-8000-000000000001'/);
});

test("E582: aplicar embrulha o mesmo corpo, se registra e o rollback apaga só a candidatura da fixture", () => {
  const ap = ler("supabase/producao/aplicar-0307.sql");
  assert.ok(ap.includes(mig.trim()));
  assert.match(ap, /'20261105000307', '0307_qa_morador_sem_cpf_candidatura_e582'/);
  const rb = ler("supabase/producao/rollback/0307_rollback.sql");
  assert.match(rb, /delete from public\.leads where id = 'a0307000-0000-4000-8000-000000000001'/);
  assert.equal((rb.replace(/--.*$/gm, "").match(/delete from public\./g) ?? []).length, 1);
});
