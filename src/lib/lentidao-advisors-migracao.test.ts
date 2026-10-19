import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 0f66a754, item 3: a 0188 zera os avisos que sobraram no advisor (3 políticas + 4 FKs sem índice).
const le = (p: string) => readFileSync(new URL(`../../supabase/${p}`, import.meta.url), "utf8");
const sql = (s: string) => s.replace(/--.*$/gm, "");

test("0188: embrulha auth.uid() nas 3 políticas e NÃO mexe em messages (recursão da 0146)", () => {
  const mig = sql(le("migrations/0188_lentidao_advisors.sql"));
  for (const t of ["public.faixa_dono", "public.pedidos_ignorados", "public.pagamentos_bloco"]) {
    assert.match(mig, new RegExp(`alter policy "[^"]+" on ${t.replace(".", "\\.")}`));
  }
  assert.doesNotMatch(mig, /public\.messages/);
  assert.doesNotMatch(mig, /drop policy|create policy|disable row level security/i);
  assert.doesNotMatch(mig, /(?<!select )auth\.uid\(\)/, "todo auth.uid() está dentro de (select ...)");
  assert.equal((mig.match(/\(select auth\.uid\(\)\)/g) ?? []).length, 5);
});

test("0188: cria os 4 índices de FK de forma idempotente", () => {
  const mig = sql(le("migrations/0188_lentidao_advisors.sql"));
  const esperados: [string, string][] = [
    ["documentos_falhas", "documento_id"],
    ["pedidos_ignorados", "proprietario_id"],
    ["servicos_pedidos", "property_id"],
    ["servicos_pedidos", "servico_id"],
  ];
  for (const [tab, col] of esperados) {
    assert.match(mig, new RegExp(`create index if not exists idx_${tab}_${col} on public\\.${tab} \\(${col}\\)`));
  }
});

test("0188: aplicar-0188 tem o mesmo conteúdo, begin/commit, registra e o rollback desfaz", () => {
  const mig = le("migrations/0188_lentidao_advisors.sql");
  const ap = le("producao/aplicar-0188.sql");
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'0188_lentidao_advisors'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.ok(ap.includes(mig.slice(mig.indexOf("alter policy \"faixa"))), "o bloco do aplicar é o da migração");
  const rb = le("producao/rollback/0188_rollback.sql");
  assert.equal((rb.match(/drop index if exists/g) ?? []).length, 4);
  assert.match(rb, /using \(owner_id = auth\.uid\(\) or is_admin\(\)\)/);
  assert.match(rb, /delete from supabase_migrations\.schema_migrations where version = '20261019000188'/);
});
