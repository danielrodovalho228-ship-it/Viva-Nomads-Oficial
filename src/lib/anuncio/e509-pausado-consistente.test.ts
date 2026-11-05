/*
  E509 — "Pausado" inconsistente entre cartões (Meus imóveis do proprietario1): em 3 cartões o selo era texto sem menu,
  em 5 abria "Reativar". Produção (leitura, 05/11): os 5 têm pausa_motivo = 'dono'; os 3 são a massa da prova do E289
  (0268, "[TESTE QA] Automações E289 S/A/R"), INSERIDOS já pausados e SEM motivo — o gatilho de coerência da 0223 só
  rodava no UPDATE, e a tela lê motivo vazio como pausa da Viva (sem botão). Correção (0300): o gatilho roda também no
  INSERT (pausado sem motivo nunca mais) e os 3 anúncios da massa (do dono de teste, pausados por ele na prova) recebem
  'dono' — os 8 cartões passam a ter o mesmo comportamento.
  Roda: node --test src/lib/anuncio/e509-pausado-consistente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { donoPodeReativar } from "./pausa.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const IDS = ["a0268a00-0000-4000-8000-000000000001", "a0268b00-0000-4000-8000-000000000001", "a0268c00-0000-4000-8000-000000000001"];

test("a regra da tela: só a pausa do dono abre 'Reativar'; motivo vazio é pausa da Viva", () => {
  assert.equal(donoPodeReativar("dono"), true);
  assert.equal(donoPodeReativar(null), false);
});

test("0300: o gatilho de coerência roda no INSERT também (pausado nunca nasce sem motivo)", () => {
  for (const f of ["supabase/migrations/0300_pausa_motivo_no_insert_e509.sql", "supabase/producao/aplicar-0300.sql"]) {
    const s = ler(f);
    assert.match(s, /create trigger trg_properties_pausa_coerente before insert or update of status on public\.properties/, f);
    assert.match(s, /drop trigger if exists trg_properties_pausa_coerente on public\.properties;/, f);
    for (const id of IDS) assert.ok(s.includes(id), `${f} › ${id}`);
    assert.match(s, /set pausa_motivo = 'dono'[\s\S]*where status = 'paused' and pausa_motivo is null and id in \(/, f);
  }
});

test("aplicar-0300: idempotente, numa transação, registrada com o nome certo; rollback desfaz", () => {
  const a = ler("supabase/producao/aplicar-0300.sql");
  assert.match(a, /^begin;/m);
  assert.match(a, /^commit;/m);
  assert.match(a, /'20261105000300', '0300_pausa_motivo_no_insert_e509'/);
  assert.match(a, /where not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261105000300'\)/);
  const r = ler("supabase/producao/rollback/0300_rollback.sql");
  assert.match(r, /create trigger trg_properties_pausa_coerente before update of status on public\.properties/);
  assert.match(r, /delete from supabase_migrations\.schema_migrations where version = '20261105000300';/);
});
