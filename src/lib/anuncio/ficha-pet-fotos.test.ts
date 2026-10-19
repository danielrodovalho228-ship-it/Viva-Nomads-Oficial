import test from "node:test";
import assert from "node:assert/strict";
import { MAX_FOTOS_PET, caminhoFotoPetValido, novoCaminhoFotoPet, podeAdicionarFotoPet, validarEnvioFotoPet } from "./ficha-pet-fotos.ts";

const UID = "11111111-1111-4111-8111-111111111111";
const PET = "22222222-2222-4222-8222-222222222222";

test("até 3 fotos do pet; a carteira de vacina é uma só", () => {
  assert.equal(MAX_FOTOS_PET, 3);
  assert.equal(podeAdicionarFotoPet("foto", 2), true);
  assert.equal(podeAdicionarFotoPet("foto", 3), false);
  assert.equal(podeAdicionarFotoPet("carteira", 0), true);
  assert.equal(podeAdicionarFotoPet("carteira", 1), false);
});

test("envio: recusa pet inválido, tipo desconhecido e arquivo ausente", () => {
  assert.equal(validarEnvioFotoPet({ petId: PET, tipo: "foto" }).ok, true);
  assert.equal(validarEnvioFotoPet({ petId: "x", tipo: "foto" }).ok, false);
  assert.equal(validarEnvioFotoPet({ petId: PET, tipo: "video" }).ok, false);
  assert.equal(validarEnvioFotoPet({ petId: PET, tipo: "carteira" }).ok, true);
  assert.equal(validarEnvioFotoPet(null).ok, false);
});

test("caminho: só da pasta da própria pessoa e em WebP (nada de ../ nem de outra conta)", () => {
  const ok = novoCaminhoFotoPet(UID, "33333333-3333-4333-8333-333333333333");
  assert.equal(ok, `${UID}/33333333-3333-4333-8333-333333333333.webp`);
  assert.equal(caminhoFotoPetValido(ok, UID), true);
  assert.equal(caminhoFotoPetValido(ok, PET), false, "pasta de outra conta");
  assert.equal(caminhoFotoPetValido(`${UID}/../${PET}/a.webp`, UID), false);
  assert.equal(caminhoFotoPetValido(`${UID}/a.svg`, UID), false);
  assert.equal(caminhoFotoPetValido(42 as unknown as string, UID), false);
});
