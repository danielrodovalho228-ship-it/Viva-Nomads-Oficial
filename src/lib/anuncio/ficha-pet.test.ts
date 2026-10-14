import test from "node:test";
import assert from "node:assert/strict";
import { podeAdicionarPet, validarFichaPet } from "./ficha-pet.ts";

const base = { nome: "  Thor ", especie: "cao", porte: "M", idadeAnos: 3, raca: "", castrado: true, vacinasEmDia: true, observacoes: "" };

test("ficha válida volta limpa", () => {
  const r = validarFichaPet(base);
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.ficha.nome, "Thor");
});

test("recusa espécie, porte, idade e booleanos fora do formato", () => {
  for (const ruim of [
    { ...base, especie: "dragao" },
    { ...base, porte: "GG" },
    { ...base, idadeAnos: -1 },
    { ...base, idadeAnos: 2.5 },
    { ...base, castrado: "sim" },
    { ...base, nome: "" },
    { ...base, observacoes: "x".repeat(201) },
  ]) assert.equal(validarFichaPet(ruim).ok, false);
  assert.equal(validarFichaPet(null).ok, false);
});

test("limite de 3 pets por conta", () => {
  assert.equal(podeAdicionarPet(2), true);
  assert.equal(podeAdicionarPet(3), false);
});
