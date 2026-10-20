/*
  properties tem SELECT por coluna (0053): coluna lida pelo anúncio sem "grant select" volta NULL em silêncio.
  Foi o que escondeu as regras de pets e as câmeras/acesso (T74). Roda: node --test src/lib/grants-properties.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

const DIR = "supabase/migrations";
const sql = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .map((f) => readFileSync(`${DIR}/${f}`, "utf8"))
  .join("\n");

function concedidas(): Set<string> {
  const s = new Set<string>();
  for (const m of sql.matchAll(/grant\s+select\s*\(([^)]*)\)\s*on\s+public\.properties\s+to\s+anon/gi))
    for (const c of m[1].split(",")) s.add(c.trim());
  return s;
}

test("colunas de pets, câmeras e acesso lidas pelo anúncio têm SELECT para anon e authenticated", () => {
  const g = concedidas();
  for (const c of ["pets_regras", "sem_cameras_interior", "cameras_externas", "tipo_acesso", "senha_trocada_estadia"])
    assert.ok(g.has(c), `falta "grant select (${c}) on public.properties to anon, authenticated"`);
});

test("pacote de limpeza (0144) lido pelo anúncio tem SELECT para anon e authenticated", () => {
  assert.ok(concedidas().has("limpeza_estadia"), 'falta "grant select (limpeza_estadia) on public.properties to anon, authenticated"');
});

test("endereço exato e coordenadas exatas continuam sem SELECT público", () => {
  const g = concedidas();
  for (const c of ["exact_address", "lat_exata", "lng_exata"]) assert.ok(!g.has(c), `${c} não pode ser público`);
});
