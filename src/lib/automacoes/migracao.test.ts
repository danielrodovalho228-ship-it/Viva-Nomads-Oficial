import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mig = readFileSync("supabase/migrations/0140_automacoes_envios.sql", "utf8");
const aplicar = readFileSync("supabase/producao/aplicar-0140.sql", "utf8");
const rollback = readFileSync("supabase/producao/rollback/0140_rollback.sql", "utf8");
const rota = readFileSync("src/app/api/cron/automacoes/route.ts", "utf8");
const vercel = readFileSync("vercel.json", "utf8");

test("0140: tabela só do servidor, idempotente, com aplicar e rollback", () => {
  assert.match(mig, /to_regclass\('public\.automacoes_envios'\) is null/);
  assert.match(mig, /enable row level security/);
  assert.match(mig, /revoke all on public\.automacoes_envios from anon, authenticated/);
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /20261016000140[\s\S]*0140_automacoes_envios/);
  assert.match(aplicar, /where not exists/);
  assert.match(rollback, /drop table if exists public\.automacoes_envios/);
});

test("cron: exige segredo, marca antes de enviar, respeita notif_email e tem modo simular", () => {
  assert.match(rota, /CRON_SECRET/);
  assert.match(rota, /Bearer \$\{segredo\}/);
  assert.ok(rota.indexOf("automacoes_envios") < rota.indexOf("await notify("), "marca o envio antes de notify");
  assert.match(rota, /podeReceber/);
  assert.match(rota, /simular/);
  assert.match(vercel, /"\/api\/cron\/automacoes"/);
});
