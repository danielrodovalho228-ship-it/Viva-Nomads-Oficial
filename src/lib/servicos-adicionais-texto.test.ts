/*
  Serviços adicionais (ordem 3e2b7030): a Viva não toca em dinheiro, então o texto público não pode dizer
  que a plataforma "intermedeia"/"roteia o pagamento". Vale para o catálogo (guarantees.ts), a tela de
  fechamento e a migração que atualiza a tabela servicos_adicionais.
  Roda: node --test src/lib/servicos-adicionais-texto.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { SERVICOS_ADICIONAIS } from "./guarantees.ts";

const PROIBIDO = /intermedei|intermedia[cç]|roteia o pagamento/i;

test("catálogo de serviços adicionais: sem 'intermedeia', 'intermediação' nem 'roteia o pagamento'", () => {
  for (const s of SERVICOS_ADICIONAIS) {
    assert.doesNotMatch(s.descricao, PROIBIDO, s.id);
    assert.match(s.descricao, /paga direto ao prestador/, s.id);
    assert.match(s.descricao, /a Viva não recebe esse valor/, s.id);
  }
});

test("Assistência 24h, sem parceiro real, fica 'Em breve'", () => {
  const a = SERVICOS_ADICIONAIS.find((s) => s.id === "assistencia_24h")!;
  assert.equal(a.status, "em_breve");
});

test("tela de fechamento (texto da etapa de serviços) sem 'intermedeia' e sem 'roteia o pagamento'", () => {
  const src = readFileSync("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx", "utf8");
  assert.doesNotMatch(src, PROIBIDO);
  assert.match(src, /paga direto ao prestador/);
});

test("guarantees.ts: nem o comentário do catálogo fala em 'intermedeia'", () => {
  assert.doesNotMatch(readFileSync("src/lib/guarantees.ts", "utf8"), PROIBIDO);
});

test("migração 0139: atualiza a descrição e deixa a Assistência 24h 'em_breve'", () => {
  const sql = readFileSync("supabase/migrations/0139_servicos_adicionais_texto.sql", "utf8");
  const apl = readFileSync("supabase/producao/aplicar-0139.sql", "utf8");
  for (const t of [sql, apl]) {
    assert.match(t, /em_breve/);
    assert.match(t, /paga direto ao prestador/);
  }
  assert.doesNotMatch(sql.replace(/--[^\n]*/g, ""), PROIBIDO);
  assert.match(apl, /begin;[\s\S]*20261016000139[\s\S]*commit;/);
  assert.match(apl, /0139_servicos_adicionais_texto/);
});
