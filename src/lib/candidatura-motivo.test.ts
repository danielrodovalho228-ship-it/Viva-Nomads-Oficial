/*
  Ordem a8bb8cfa / 9a723929: o motivo da estadia vai do perfil à candidatura e chega ao proprietário
  como categoria (saúde sem diagnóstico), sem nome/contato.
  Roda: node --test src/lib/candidatura-motivo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MOTIVOS, motivoParaDono } from "./pedidos/pedidos.ts";
import { leadSummary, type Lead } from "./data/lead-types.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("proprietário vê 'Saúde' para tratamento médico e o rótulo público nos demais", () => {
  assert.equal(motivoParaDono("tratamento_medico"), "Saúde");
  for (const m of MOTIVOS.filter((x) => x.key !== "tratamento_medico")) assert.equal(motivoParaDono(m.key), m.publico, m.key);
  assert.doesNotMatch(motivoParaDono("tratamento_medico"), /tratamento|médic|diagn/i);
});

test("valor inválido, vazio ou nulo não vira rótulo", () => {
  assert.equal(motivoParaDono("quero ligar 34 99999-0000"), "");
  assert.equal(motivoParaDono(""), "");
  assert.equal(motivoParaDono(null), "");
  assert.equal(motivoParaDono(undefined), "");
});

test("resumo do candidato inclui o motivo só quando existe", () => {
  const base: Lead = { id: "1", name: "Ana", property: "X", category: "Médica", riskCategories: [], light: "green", verified: true };
  assert.match(leadSummary({ ...base, motivo: "Saúde" }), /motivo: Saúde/);
  assert.doesNotMatch(leadSummary(base), /motivo/);
});

test("servidor da candidatura valida o motivo, cai no perfil e grava só em candidatura", () => {
  const a = ler("src/lib/data/actions.ts");
  assert.match(a, /kind === "candidatura"[\s\S]{0,200}validarMotivoEstadia\(motivoEstadia/);
  assert.match(a, /from\("profiles"\)\.select\("motivo_estadia"\)\.eq\("id", user\.id\)/);
  assert.match(a, /\.\.\.\(motivoLead \? \{ motivo_estadia: motivoLead \} : \{\}\)/);
});

test("lista do proprietário lê o motivo pelo servidor e nunca expõe a chave crua", () => {
  const l = ler("src/lib/data/leads.ts");
  assert.match(l, /admin\.from\("leads"\)\.select\("id, motivo_estadia(, inicio_desejado)?(, qtd_ocupantes)?"\)/);
  assert.match(l, /motivoParaDono\(m\.motivo_estadia\)/);
});

test("tela do anúncio pré-preenche do perfil e usa a lista única", () => {
  const p = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(p, /getMeusDados/);
  assert.match(p, /data-testid="candidatura-motivo"/);
  assert.match(p, /MOTIVOS\.map/);
  assert.match(p, /setMotivoEstadia\(\(atual\) => atual \|\| d\.motivoEstadia\)/);
});

test("migração 0142: coluna com a mesma lista, aplicar idempotente e rollback", () => {
  const m = ler("supabase/migrations/0142_leads_motivo_estadia.sql");
  assert.match(m, /add column if not exists motivo_estadia/i);
  for (const k of MOTIVOS.map((x) => x.key)) assert.ok(m.includes(`'${k}'`), k);
  const ap = ler("supabase/producao/aplicar-0142.sql");
  assert.match(ap, /^begin;/m);
  assert.match(ap, /commit;\s*$/);
  assert.match(ap, /0142_leads_motivo_estadia/);
  assert.match(ler("supabase/producao/rollback/0142_rollback.sql"), /drop column if exists motivo_estadia/i);
});
