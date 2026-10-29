import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planoEfetivo } from "../fundador.ts";
import { COMISSAO_POR_PLANO, taxaDoContrato } from "../../config/planos.ts";

const agora = new Date("2026-10-07T12:00:00Z");

test("assinatura Gestor ativa vale Gestor (também para Fundador no período grátis)", () => {
  assert.equal(planoEfetivo("gestor", false, null, agora), "gestor");
  assert.equal(planoEfetivo("gestor", true, "2026-05-01T00:00:00Z", agora), "gestor");
});

test("Gestor: comissão zero", () => {
  assert.equal(COMISSAO_POR_PLANO.gestor, 0);
  // Contrato aceito no Gestor congela 0; sem taxa gravada, o plano do aceite decide.
  assert.equal(taxaDoContrato(0, "gestor"), 0);
  assert.equal(taxaDoContrato(null, "gestor"), 0);
});

test("plano desconhecido nunca vira plano", () => {
  assert.equal(planoEfetivo("vip", false, null, agora), "free");
  assert.equal(planoEfetivo("GESTOR", false, null, agora), "free");
  assert.equal(planoEfetivo("vip", true, "2026-05-01T00:00:00Z", agora), "pro");
});

test("0079 põe 'gestor' no enum plan_type sem gerar NOTICE", () => {
  const sql = readFileSync(new URL("../../../supabase/migrations/0079_plano_gestor.sql", import.meta.url), "utf8");
  assert.match(sql, /alter type public\.plan_type add value 'gestor'/);
  assert.doesNotMatch(sql, /add value if not exists|if exists\s+public|raise notice/i, "a ferramenta do Supabase trava com NOTICE");
});
