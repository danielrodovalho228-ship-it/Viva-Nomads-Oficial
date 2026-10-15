/*
  Câmera escondida (ordem f92bc582, item 4): o anúncio sai da busca só quando o
  chamado é de câmera E quem abriu é o inquilino do contrato.
  Roda: node --test src/lib/atendimento/camera-anuncio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { anuncioParaPausarPorCamera, AVISO_ANUNCIO_PAUSADO } from "./camera-anuncio.ts";

const ct = { tenant_id: "u1", property_id: "p1" };

test("inquilino do contrato + categoria camera: pausa o anúncio do contrato", () => {
  assert.equal(anuncioParaPausarPorCamera("camera", "u1", ct), "p1");
});

test("outra categoria não pausa", () => {
  for (const c of ["seguranca", "duvida", "manutencao", "acesso_imovel"]) assert.equal(anuncioParaPausarPorCamera(c, "u1", ct), null, c);
});

test("negativos: visitante, sem contrato, contrato alheio, contrato sem imóvel", () => {
  assert.equal(anuncioParaPausarPorCamera("camera", null, ct), null);
  assert.equal(anuncioParaPausarPorCamera("camera", "u1", null), null);
  assert.equal(anuncioParaPausarPorCamera("camera", "u2", ct), null);
  assert.equal(anuncioParaPausarPorCamera("camera", "u1", { tenant_id: "u1", property_id: null }), null);
});

test("aviso ao inquilino não usa 'vistoria' nem promete reembolso", () => {
  assert.doesNotMatch(AVISO_ANUNCIO_PAUSADO, /vistoria|reembols/i);
});
