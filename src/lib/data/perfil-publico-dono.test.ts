import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { primeiroPerfilPublico } from "./perfil-publico-dono.ts";

const linha = { nome: "Ana", avatar_url: null, desde: "2026-01-01", taxa_resposta: 90, verificado: true };

test("devolve a primeira linha com nome", () => {
  assert.deepEqual(primeiroPerfilPublico([linha]), linha);
});

test("sem linha, nulo ou sem nome: não há bloco Proprietário", () => {
  assert.equal(primeiroPerfilPublico([]), null);
  assert.equal(primeiroPerfilPublico(null), null);
  assert.equal(primeiroPerfilPublico([{ ...linha, nome: "" }]), null);
});

test("migração 0133 tira o execute de anon/authenticated e só dá ao service_role", () => {
  for (const f of ["supabase/migrations/0133_perfil_publico_dono_so_servidor.sql", "supabase/producao/aplicar-0133.sql"]) {
    const sql = readFileSync(f, "utf8").replace(/--.*$/gm, "");
    assert.match(sql, /revoke all on function public\.perfil_publico_dono\(uuid\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.perfil_publico_dono\(uuid\) to service_role/);
    assert.doesNotMatch(sql, /grant execute[^;]*\b(anon|authenticated)\b/);
  }
});

test("properties.ts não chama a função pelo cliente do visitante", () => {
  const src = readFileSync("src/lib/data/properties.ts", "utf8");
  assert.doesNotMatch(src, /supabase\.rpc\("perfil_publico_dono"/);
  assert.match(src, /admin\.rpc\("perfil_publico_dono"/);
});
