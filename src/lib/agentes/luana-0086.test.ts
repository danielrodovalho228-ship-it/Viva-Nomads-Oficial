/*
  0086: Luana com SEO de conteúdo. A Central continua achando a próxima ronda
  dela no texto novo da rotina. Roda: node --test src/lib/agentes/luana-0086.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { proximaRonda } from "./central.ts";

const sql = readFileSync(new URL("../../../supabase/migrations/0086_agente_luana_seo.sql", import.meta.url), "utf8");
const rotina = sql.match(/rotina_texto = '([^']+)'/)![1];

test("0086: cargo, rotina e briefing da Luana; só ela é alterada; sem NOTICE", () => {
  assert.match(sql, /cargo = 'Marketing e SEO de conteúdo'/);
  assert.match(sql, /where slug = 'luana';/);
  assert.equal((sql.match(/^\s*update\b/gim) ?? []).length, 1);
  assert.doesNotMatch(sql, /raise notice|drop |delete /i);
  assert.match(sql, /QuintoAndar, OLX, ZAP/);
  assert.match(sql, /Nunca publica sem aprovação do Daniel/);
});

test("a próxima ronda da Luana continua calculada (segunda 07:47 Brasília)", () => {
  // Quarta 07/10/2026 21:00 UTC → próxima é segunda 12/10 07:47.
  assert.equal(proximaRonda(rotina, new Date("2026-10-07T21:00:00Z")), "segunda 07:47 Brasília");
});
