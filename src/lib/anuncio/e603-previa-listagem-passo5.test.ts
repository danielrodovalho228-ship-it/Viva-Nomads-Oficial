/*
  E603 — Prévia, listagem e Passo 5 diziam coisas diferentes: o chip "Mobiliado" aparecia sem comodidade marcada no Passo 5 e
  um rascunho de 2 quartos mostrava "0" (a cama) na listagem de Meus imóveis, porque o autosave não gravava os quartos.
  Roda: node --test src/lib/anuncio/e603-previa-listagem-passo5.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comodidadesComMobiliado } from "./mobiliado-fonte-unica.ts";
import { camposDeConteudoDoRascunho } from "../data/rascunho-campos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E603: a comodidade 'Mobiliado completo' do Passo 5 espelha o interruptor do Passo 6", () => {
  assert.equal(comodidadesComMobiliado({}, true).mobiliado, true);
  assert.equal(comodidadesComMobiliado({ mobiliado: true, tv: true }, false).mobiliado, false);
  assert.equal(comodidadesComMobiliado({ tv: true }, true).tv, true);
});

test("E603: o rascunho grava os quartos na coluna (a listagem lê a coluna)", () => {
  assert.equal(camposDeConteudoDoRascunho({ bedrooms: 2, bathrooms: 2, areaM2: 65 }).bedrooms, 2);
  assert.equal(camposDeConteudoDoRascunho({ bedrooms: Number.NaN }).bedrooms, 0);
  const pagina = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const i = pagina.indexOf("await saveDraftData({");
  assert.match(pagina.slice(i, i + 600), /bedrooms: Number\(bedrooms\) \|\| 0/);
});

test("E603: a página lê as comodidades já com o mobiliado da fonte única; o Passo 5 troca o mesmo estado", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(pagina, /const amenityKeys = comodidadesComMobiliado\(amenityKeysBase, furnished\);/);
  const etapa = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx");
  assert.match(etapa, /k === "mobiliado" \? p\.setFurnished/);
});

test("E603: a 0303 repara só rascunhos com coluna em 0 e draft_data inteiro positivo; aplicar embrulha o mesmo corpo", () => {
  const mig = ler("supabase/migrations/0303_rascunho_quartos_da_coluna_e603.sql");
  assert.match(mig, /where status = 'draft'/);
  assert.match(mig, /coalesce\(bedrooms, 0\) = 0/);
  assert.match(mig, /~ '\^\[0-9\]\{1,2\}\$'/);
  const ap = ler("supabase/producao/aplicar-0303.sql");
  assert.ok(ap.includes(mig.trim()));
  assert.match(ap, /'20261105000303', '0303_rascunho_quartos_da_coluna_e603'/);
  assert.match(ler("supabase/producao/rollback/0303_rollback.sql"), /version = '20261105000303'/);
});
