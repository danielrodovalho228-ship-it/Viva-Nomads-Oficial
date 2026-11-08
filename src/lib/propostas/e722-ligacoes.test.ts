/*
  E722 — as ligações da pré-aceitação de 72 h: tudo atrás da chave PRE_ACEITACAO_72H_ATIVA (desligada), a taxa congelada nunca é
  recalculada, migração só com colunas novas. Roda: node --test src/lib/propostas/e722-ligacoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const semComentario = (s: string) => s.replace(/^\s*--.*$/gm, "");

test("a chave PRE_ACEITACAO_72H_ATIVA nasce desligada e está no painel de chaves", () => {
  assert.match(ler("src/lib/flags.ts"), /export const PRE_ACEITACAO_72H_ATIVA = process\.env\.NEXT_PUBLIC_PRE_ACEITACAO_72H_ATIVA === "on";/);
  assert.match(ler("src/config/chaves-ambiente.ts"), /nome: "PRE_ACEITACAO_72H_ATIVA"/);
});

test("o cron e o aceite só agem com a chave ligada", () => {
  assert.match(ler("src/app/api/cron/pre-aceitacao/route.ts"), /if \(!PRE_ACEITACAO_72H_ATIVA\) return NextResponse\.json\(\{ ok: true, ativa: false \}\)/);
  assert.match(ler("src/lib/propostas/pre-aceitacao-servidor.ts"), /if \(!PRE_ACEITACAO_72H_ATIVA\) return \{ ativa: false/);
  const acoes = ler("src/lib/data/propostas-actions.ts");
  assert.match(acoes, /\.\.\.\(PRE_ACEITACAO_72H_ATIVA \? \{ pre_aceitacao_ate:/);
  assert.match(acoes, /if \(!PRE_ACEITACAO_72H_ATIVA\) return \{ ok: false, error: "A pré-aceitação de 72 horas ainda não está ativa\./);
});

test("a reabertura e o cron nunca escrevem a taxa: a taxa congelada continua valendo", () => {
  const srv = ler("src/lib/propostas/pre-aceitacao-servidor.ts");
  assert.doesNotMatch(srv, /\.update\(\{[^}]*taxa/); // nenhum update escreve taxa (só leitura via select)
  assert.doesNotMatch(srv, /taxaDoDonoAgora|taxaEfetivaDaProposta|taxa_no_envio/);
  assert.match(srv, /taxa_congelada fica como está/);
});

test("a migração 0334 só acrescenta colunas opcionais, limita as reaberturas a 2 e tem aplicar e rollback", () => {
  for (const f of ["supabase/migrations/0334_propostas_pre_aceitacao_e722.sql", "supabase/producao/aplicar-0334.sql"]) {
    const sql = semComentario(ler(f));
    for (const c of ["pre_aceitacao_ate timestamptz", "pre_aceitacao_reaberturas smallint not null default 0", "pre_aceitacao_lembrete_24h_em", "pre_aceitacao_lembrete_6h_em", "pre_aceitacao_expirou_em"]) {
      assert.match(sql, new RegExp(`add column if not exists ${c.split(" ")[0]}`));
    }
    assert.match(sql, /check \(pre_aceitacao_reaberturas between 0 and 2\)/);
    assert.doesNotMatch(sql, /\b(update|delete)\s+(from\s+)?public\./i); // propostas antigas ficam sem prazo
    assert.doesNotMatch(sql, /AUTOMACOES_ATIVO/);
  }
  assert.match(ler("supabase/producao/aplicar-0334.sql"), /'20261107000334', '0334_propostas_pre_aceitacao_e722'/);
  assert.match(ler("supabase/producao/rollback/0334_rollback.sql"), /drop column if exists pre_aceitacao_ate/);
});

test("a tela mostra a data e a hora exatas, a regra de corrida, a ausência de punição e a taxa que continua", () => {
  const tela = ler("src/app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  for (const id of ["pre-aceitacao-prazo", "pre-aceitacao-corrida", "pre-aceitacao-sem-punicao", "pre-aceitacao-taxa"]) assert.match(tela, new RegExp(`data-testid="${id}"`));
});
