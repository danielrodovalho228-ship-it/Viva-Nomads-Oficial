/*
  Estático: a migração 0129 e as ações de resposta/revisão seguem as regras de negócio.
  Roda: node --experimental-strip-types --test src/lib/avaliacoes-resposta-migracao.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const mig = ler("supabase/migrations/0129_avaliacoes_resposta_revisao.sql");
const acoes = ler("src/lib/data/avaliacoes-resposta-actions.ts");

test("0129: RLS ligada, sem UPDATE/DELETE do usuário, motivos objetivos e uma revisão aberta por avaliação", () => {
  assert.match(mig, /alter table public\.avaliacao_respostas enable row level security/);
  assert.match(mig, /alter table public\.avaliacao_contestacoes enable row level security/);
  assert.match(mig, /motivo in \('ofensa', 'dado_pessoal', 'fato_falso'\)/);
  assert.match(mig, /create unique index if not exists avaliacao_contestacoes_uma_aberta[\s\S]*where status = 'aberta'/);
  assert.doesNotMatch(mig, /grant (update|delete)[^;]*to authenticated/);
  assert.match(mig, /Só a pessoa avaliada responde/);
});

test("0129: aplicar-0129 idempotente, com begin/commit, registro e rollback", () => {
  const ap = ler("supabase/producao/aplicar-0129.sql");
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'0129_avaliacoes_resposta_revisao'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.doesNotMatch(ap, /create table public\./); // sempre "if not exists"
  assert.match(ler("supabase/producao/rollback/0129_rollback.sql"), /drop table if exists public\.avaliacao_respostas/);
});

test("ações: validam entrada no servidor; decisão só do admin com AAL2", () => {
  assert.match(acoes, /validarResposta\(texto\)/);
  assert.match(acoes, /validarContestacao\(motivo, detalhe\)/);
  assert.match(acoes, /ehAdmin\(supabase, user\.id\)/);
  assert.match(acoes, /Sem permissão/);
});

test("0129: anônimo lê a resposta sem autor_id (grant por coluna) nas duas cópias da migração", () => {
  for (const sql of [mig, ler("supabase/producao/aplicar-0129.sql")]) {
    assert.match(sql, /grant select \(avaliacao_id, texto, criada_em\) on public\.avaliacao_respostas to anon, authenticated/);
    assert.doesNotMatch(sql, /grant select on public\.avaliacao_respostas/);
  }
});

test("tela do avaliado e anúncio: botões Responder/Pedir revisão chamam as ações e a resposta aparece no anúncio", () => {
  const acoesUi = ler("src/app/(dashboard)/dashboard/avaliacoes/acoes.tsx");
  assert.match(acoesUi, /responderAvaliacao\(avaliacaoId, texto\)/);
  assert.match(acoesUi, /pedirRevisaoAvaliacao\(avaliacaoId, motivo, texto\)/);
  assert.match(ler("src/components/property/reviews.tsx"), /Resposta do proprietário/);
  assert.match(ler("src/lib/data/properties.ts"), /from\("avaliacao_respostas"\)/);
  assert.match(ler("src/config/menu-painel.ts"), /\/dashboard\/avaliacoes/);
});

test("responder e pedir revisão revalidam a tela do avaliado na própria ação (a resposta aparece sem depender só do router.refresh)", () => {
  const corpo = (nome: string) => acoes.slice(acoes.indexOf(`export async function ${nome}`), acoes.indexOf("\n}\n", acoes.indexOf(`export async function ${nome}`)));
  assert.match(corpo("responderAvaliacao"), /revalidatePath\("\/dashboard\/avaliacoes"\);\s*return \{ ok: true \};/);
  assert.match(corpo("pedirRevisaoAvaliacao"), /revalidatePath\("\/dashboard\/avaliacoes"\);\s*return \{ ok: true \};/);
});
