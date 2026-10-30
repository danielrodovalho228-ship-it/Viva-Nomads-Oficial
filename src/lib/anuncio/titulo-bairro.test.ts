/* Roda: node --test src/lib/anuncio/titulo-bairro.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bairroCitadoNoTitulo, avisoTituloBairro } from "./titulo-bairro.ts";

test("título que cita outro bairro conhecido avisa", () => {
  assert.equal(bairroCitadoNoTitulo("Studio mobiliado no Umuarama", "Santa Mônica"), "Umuarama");
  assert.match(avisoTituloBairro("Studio mobiliado no Umuarama", "Santa Mônica") ?? "", /Umuarama.*Santa Mônica/);
});

test("título com o bairro cadastrado (com ou sem acento/caixa) não avisa", () => {
  assert.equal(avisoTituloBairro("Studio em santa monica", "Santa Mônica"), null);
  assert.equal(avisoTituloBairro("Apto no Umuarama", "Umuarama"), null);
});

test("título sem bairro, ou bairro ainda vazio, não avisa", () => {
  assert.equal(avisoTituloBairro("Studio mobiliado perto da UFU", "Martins"), null);
  assert.equal(avisoTituloBairro("Studio no Umuarama", ""), null);
  assert.equal(avisoTituloBairro("", "Martins"), null);
});

test("não confunde palavra parcial (Centro x Centrolândia)", () => {
  assert.equal(avisoTituloBairro("Casa em Centrolândia", "Martins"), null);
  assert.equal(avisoTituloBairro("Studio no Centro", "Martins") !== null, true);
});

test("se cita o cadastrado e outro, não avisa (decisão do dono)", () => {
  assert.equal(avisoTituloBairro("Entre o Centro e o Martins", "Martins"), null);
});

import { avisosConsistenciaTitulo, quartosCitados } from "./titulo-bairro.ts";
test("E150 — título × tipo e quartos: avisa sem travar", () => {
  assert.equal(quartosCitados("Studio com 2 quartos vem morar aqui"), 2);
  assert.equal(quartosCitados("Apartamento de dois quartos"), 2);
  assert.equal(quartosCitados("Studio mobiliado"), null);
  const a = avisosConsistenciaTitulo("Studio com 2 quartos vem morar aqui", { bairro: "Centro", tipo: "studio", quartos: "3" });
  assert.deepEqual(a, ["O título diz 2 quartos, mas o anúncio tem 3 quartos. Confira se está certo (você pode manter)."]);
  assert.deepEqual(avisosConsistenciaTitulo("Casa ampla no Centro", { bairro: "Centro", tipo: "apartamento", quartos: 2 }), [
    "O título diz casa, mas o tipo do anúncio é apartamento. Confira se está certo (você pode manter).",
  ]);
  assert.deepEqual(avisosConsistenciaTitulo("Apartamento com 2 quartos", { bairro: "Centro", tipo: "apartamento", quartos: 2 }), []);
  assert.deepEqual(avisosConsistenciaTitulo("Casa no condomínio", { tipo: "casa_condominio", quartos: 3 }), []);
});

test("E261: o editor do anúncio publicado roda as MESMAS checagens do Passo 7 (bairro, tipo, quartos), sem travar", () => {
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const editor = ler("app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  const passo7 = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx");
  for (const tela of [editor, passo7]) assert.match(tela, /<AvisosConsistenciaTitulo titulo=/);
  assert.match(editor, /<AvisosConsistenciaTitulo titulo=\{title\} bairro=\{property\.neighborhood \?\? ""\} tipo=\{property\.propertyType\} quartos=\{bedrooms\} \/>/);
  // O tipo gravado no banco pode vir com caixa/acento ("Studio"): não vira aviso falso.
  assert.deepEqual(avisosConsistenciaTitulo("Studio mobiliado no Centro", { tipo: "Studio", quartos: 1 }), []);
  assert.deepEqual(avisosConsistenciaTitulo("Chácara com piscina", { tipo: "Chácara" }), []);
  const avisos = avisosConsistenciaTitulo("Casa com 3 quartos no Centro", { bairro: "Centro", tipo: "apartamento", quartos: "1" });
  assert.equal(avisos.length, 2);
  for (const a of avisos) assert.match(a, /Confira se está certo \(você pode manter\)\.$/);
});
