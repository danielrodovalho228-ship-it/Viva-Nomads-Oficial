/*
  E661 (apoio da Pista B) — a estrutura do CONDOMÍNIO (Wi-Fi, recepção, fechadura) ganha campos próprios nas instruções
  de chegada, separados do Wi-Fi do apartamento. A Pista A agrupa no bloco "Estrutura do condomínio".
  Roda: node --test src/lib/estadia/estrutura-condominio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { CAMPOS_INSTRUCOES, CAMPOS_CONDOMINIO, instrucoesPreenchidas, normalizarInstrucoes } from "./instrucoes.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (p: string) => readFileSync(new URL(p, raiz), "utf8");

test("os campos do condomínio existem, com rótulo próprio e limite, sem tocar no Wi-Fi do apartamento", () => {
  assert.deepEqual([...CAMPOS_CONDOMINIO], ["condominio_wifi_rede", "condominio_wifi_senha", "condominio_recepcao", "condominio_fechadura"]);
  const chaves = CAMPOS_INSTRUCOES.map((c) => c.chave as string);
  for (const c of CAMPOS_CONDOMINIO) assert.ok(chaves.includes(c), c);
  assert.ok(chaves.includes("wifi_rede") && chaves.includes("wifi_senha"), "o Wi-Fi do apartamento continua");
  const rot = new Set(CAMPOS_INSTRUCOES.map((c) => c.rotulo));
  assert.equal(rot.size, CAMPOS_INSTRUCOES.length, "rótulos não repetem");
});

test("normalizar corta no limite e só devolve campos conhecidos; só o condomínio preenchido já conta como preenchido", () => {
  const n = normalizarInstrucoes({ condominio_wifi_rede: "  Rede do prédio  ", condominio_recepcao: "x".repeat(900), qualquer: "y" });
  assert.equal(n.condominio_wifi_rede, "Rede do prédio");
  assert.equal((n.condominio_recepcao ?? "").length, 500);
  assert.equal(n.condominio_fechadura, null);
  assert.ok(!("qualquer" in n));
  assert.ok(instrucoesPreenchidas({ condominio_fechadura: "Biometria na eclusa" }));
});

test("migração 0317 aditiva, idempotente, registrada, com rollback", () => {
  const mig = ler("supabase/migrations/0317_estrutura_condominio_e661.sql");
  const ap = ler("supabase/producao/aplicar-0317.sql");
  assert.ok(existsSync(new URL("supabase/producao/rollback/0317_rollback.sql", raiz)));
  for (const col of ["condominio_wifi_rede", "condominio_wifi_senha", "condominio_recepcao", "condominio_fechadura"]) {
    assert.match(mig, new RegExp(`add column if not exists ${col} text`));
    assert.match(ap, new RegExp(`add column if not exists ${col} text`));
  }
  assert.match(ap, /^begin;/m);
  assert.match(ap, /commit;\s*$/);
  assert.match(ap, /insert into supabase_migrations\.schema_migrations[\s\S]*0317_estrutura_condominio_e661[\s\S]*where not exists/);
  assert.doesNotMatch(mig + ap, /drop |delete from|truncate/i);
});
