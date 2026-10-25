/* Roda: node --test src/lib/anuncio/requisitos-passo10.test.ts — E132-A, Parte C. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isEligible, temPendenciaConvencao } from "../qualification.ts";
import { tipoEmCondominio } from "../amenities.ts";
import { DECLARACOES_VAZIAS, declaracoesDoRascunho, elegibilidadeDoCadastro } from "./requisitos-passo10.ts";

const base = { mobiliado: true, minimoDias: 30, operacaoDeclarada: true, documentoEnviado: true, emCondominio: true };

test("convenção só nos tipos em condomínio; casa e chácara contam como Sim", () => {
  for (const t of ["apartamento", "studio", "casa_condominio", "flat", "quarto"]) assert.equal(tipoEmCondominio(t), true, t);
  for (const t of ["casa", "chacara"]) assert.equal(tipoEmCondominio(t), false, t);
  const casa = elegibilidadeDoCadastro({ ...base, emCondominio: false, declaracoes: { iptuOk: true, habitavel: true, convencao: "" } });
  assert.equal(casa.condoAllows, "yes");
  assert.equal(isEligible(casa), true);
});

test("'Não sei' publica com pendência; 'Não' bloqueia; sem resposta não publica", () => {
  const com = (convencao: "" | "yes" | "unknown" | "no") => elegibilidadeDoCadastro({ ...base, declaracoes: { iptuOk: true, habitavel: true, convencao } });
  assert.equal(isEligible(com("yes")), true);
  assert.equal(isEligible(com("unknown")), true);
  assert.equal(temPendenciaConvencao(com("unknown")), true);
  assert.equal(isEligible(com("no")), false);
  assert.equal(isEligible(com("")), false);
});

test("derivado do cadastro: mobiliado, 30 dias, quem opera, documento; IPTU e habitabilidade são declarações", () => {
  const e = elegibilidadeDoCadastro({ ...base, declaracoes: DECLARACOES_VAZIAS });
  assert.equal(e.accepts30days, true);
  assert.equal(isEligible(e), false, "sem IPTU e sem água/luz/gás não publica");
  assert.equal(elegibilidadeDoCadastro({ ...base, documentoEnviado: false, declaracoes: { iptuOk: true, habitavel: true, convencao: "yes" } }).hasDocument, false);
  assert.deepEqual(declaracoesDoRascunho({ iptuOk: true, convencao: "x" }), { iptuOk: true, habitavel: false, convencao: "" });
});
