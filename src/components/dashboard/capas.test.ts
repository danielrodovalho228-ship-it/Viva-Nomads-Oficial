import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { CAPAS, CAPA_MORADOR, capaDoMorador } from "./capas.ts";

// Ordem b36ca0ee (D1): a capa do morador aponta para painel-morador-capa.webp; enquanto o arquivo não chega, a tela usa a
// capa de buscas e o pedido da imagem fica registrado ("falta imagem").
test("D1: capa do morador aponta para o arquivo combinado e registra 'falta imagem'", () => {
  assert.equal(CAPA_MORADOR.src, "/images/unicas/painel-morador-capa.webp");
  assert.equal(CAPA_MORADOR.pronta, existsSync(`public${CAPA_MORADOR.src}`), "marcar pronta só junto com o arquivo");
  assert.ok(CAPA_MORADOR.pronta || CAPA_MORADOR.pendencia === "falta imagem");
});

test("D1: sem a imagem, o morador usa a capa existente (nunca imagem quebrada)", () => {
  const capa = capaDoMorador();
  if (CAPA_MORADOR.pronta) assert.equal(capa, "morador");
  else assert.equal(capa, "buscas");
  assert.ok(capa in CAPAS);
});

test("D1: o painel do morador (onboarding do inquilino) usa capaDoMorador()", () => {
  const src = readFileSync(new URL("./tenant-onboarding.tsx", import.meta.url), "utf8");
  assert.match(src, /capa=\{capaDoMorador\(\)\}/);
  assert.doesNotMatch(src, /capa="buscas"/);
});

test("D6: spec t59 confere que o botão flutuante não cobre o último card no painel a 390 px", () => {
  const spec = readFileSync(new URL("../../../tests/e2e/specs/t59-flutuante-nao-tampa.spec.ts", import.meta.url), "utf8");
  assert.match(spec, /último card/);
  assert.match(spec, /b36ca0ee/);
});
