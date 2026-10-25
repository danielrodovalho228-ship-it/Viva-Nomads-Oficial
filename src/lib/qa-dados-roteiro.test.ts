import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizarLimpezaEstadia } from "./anuncio/limpeza-estadia.ts";

// Ordem ee7d27b8, item 4: dados do roteiro de QA (imóvel com pacote de limpeza e outro sem), só em conta is_teste.
const ler = (p: string) => readFileSync(p, "utf8");
const mig = ler("supabase/migrations/0245_dados_qa_roteiro.sql");
const prod = ler("supabase/producao/aplicar-0245.sql");

test("0245: só mexe em dono is_teste e em imóveis dele", () => {
  assert.match(mig, /p\.is_teste/);
  assert.match(mig, /owner_id = v_dono/g);
  assert.ok(!/delete from/i.test(mig));
});

test("0245: pacote de limpeza no formato que o app aceita", () => {
  const json = /limpeza_estadia = '(\{[^']+\})'::jsonb/.exec(mig)?.[1];
  assert.ok(json, "pacote presente");
  assert.ok(normalizarLimpezaEstadia(JSON.parse(json)), "formato válido para o servidor");
  assert.match(mig, /limpeza_estadia = null/, "o segundo imóvel fica sem pacote");
});

test("aplicar-0245: idempotente, em begin/commit e registrada em schema_migrations", () => {
  assert.match(prod, /^begin;/m);
  assert.match(prod, /^commit;/m);
  assert.match(prod, /not exists \(select 1 from supabase_migrations\.schema_migrations where version = '20261024000245'\)/);
  assert.match(prod, /'0245_dados_qa_roteiro'/);
  assert.ok(ler("supabase/producao/rollback/0245_rollback.sql").includes("20261024000245"));
});
