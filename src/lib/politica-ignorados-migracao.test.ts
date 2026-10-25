import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Laboratório verde: supabase/lab/conferir-banco.sql reprova política de role public que chama função interna
// (is_admin etc.: o anon não executa, 0084/2). A "dono gerencia seus ignorados" (0184) caía nisso e a suíte E2E
// nem chegava a rodar. A 0189 a restringe a authenticated.
const le = (p: string) => readFileSync(new URL(`../../supabase/${p}`, import.meta.url), "utf8");
const sql = (s: string) => s.replace(/--.*$/gm, "");

test("0189: restringe a política dos ignorados a authenticated, sem recriar nem apagar", () => {
  const mig = sql(le("migrations/0189_politica_ignorados_authenticated.sql"));
  assert.match(mig, /alter policy "dono gerencia seus ignorados" on public\.pedidos_ignorados to authenticated;/);
  assert.doesNotMatch(mig, /drop policy|create policy|disable row level security/i);
});

test("0189: aplicar-0189 é idempotente, registra a migração e o rollback desfaz", () => {
  const ap = le("producao/aplicar-0189.sql");
  assert.match(ap, /^begin;$/m);
  assert.match(ap, /^commit;$/m);
  assert.match(ap, /'0189_politica_ignorados_authenticated'/);
  assert.match(ap, /where not exists \(select 1 from supabase_migrations\.schema_migrations/);
  assert.ok(ap.includes("to authenticated;"));
  assert.match(le("producao/rollback/0189_rollback.sql"), /to public/);
});
