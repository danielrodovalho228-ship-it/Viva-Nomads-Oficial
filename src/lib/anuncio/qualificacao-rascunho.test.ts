/*
  Ordem 1cfccb8f (F8) — rascunho retomado (?draft=) NÃO nasce "qualificado":
  a qualificação é POR IMÓVEL e vem do servidor.
  Roda: node --test src/lib/anuncio/qualificacao-rascunho.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { qualificadoDoServidor } from "./qualificacao-rascunho.ts";
import type { EligibilityState } from "../qualification.ts";

const ok: EligibilityState = {
  furnished: true, accepts30days: true, iptuOk: true, habitable: true,
  isOwnerOrAgent: true, hasDocument: true, condoAllows: "yes",
};

test("sem qualificação salva no servidor: não está qualificado", () => {
  assert.equal(qualificadoDoServidor(null), false);
});

test("qualificação incompleta ou convenção que proíbe: não está qualificado", () => {
  assert.equal(qualificadoDoServidor({ elig: { ...ok, iptuOk: false } }), false);
  assert.equal(qualificadoDoServidor({ elig: { ...ok, condoAllows: "no" } }), false);
  assert.equal(qualificadoDoServidor({ elig: { ...ok, condoAllows: "" } }), false);
});

test("qualificação elegível do imóvel: está qualificado", () => {
  assert.equal(qualificadoDoServidor({ elig: ok }), true);
});

test("a tela lê a qualificação do imóvel do servidor ao retomar rascunho", () => {
  const pagina = readFileSync(join(process.cwd(), "src/app/(dashboard)/dashboard/imoveis/novo/page.tsx"), "utf8");
  assert.match(pagina, /carregarQualificacao\(draftParam\)/);
  assert.match(pagina, /setQualificado\(qualificadoDoServidor\(/);
});
