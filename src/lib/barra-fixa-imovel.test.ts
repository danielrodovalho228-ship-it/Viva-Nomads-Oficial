import { test } from "node:test";
import assert from "node:assert/strict";
import { barraFixaImovel } from "./barra-fixa-imovel.ts";
import { formatBRL } from "./utils.ts";

test("barra fixa mostra o mesmo valor por mês do cartão de preço", () => {
  const b = barraFixaImovel({ monthlyPrice: 3200, exemplo: false, candidatouSe: false });
  assert.equal(b.visivel, true);
  assert.equal(b.estado, "candidatar");
  assert.equal(b.valor, formatBRL(3200));
  assert.equal(b.linha, "Caução e taxas no detalhe");
});

test("anúncio de exemplo não mostra a barra (ninguém recebe candidatura)", () => {
  const b = barraFixaImovel({ monthlyPrice: 3200, exemplo: true, candidatouSe: false });
  assert.equal(b.visivel, false);
});

test("depois de candidatar, a barra mostra o estado e não o botão de enviar", () => {
  const b = barraFixaImovel({ monthlyPrice: 3200, exemplo: false, candidatouSe: true });
  assert.equal(b.visivel, true);
  assert.equal(b.estado, "candidatou");
});

test("sem preço válido a barra não aparece (não inventa número)", () => {
  assert.equal(barraFixaImovel({ monthlyPrice: 0, exemplo: false, candidatouSe: false }).visivel, false);
  assert.equal(barraFixaImovel({ monthlyPrice: Number.NaN, exemplo: false, candidatouSe: false }).visivel, false);
});

test("barra mostra o status de disponibilidade (ordem d943f893)", () => {
  const b = barraFixaImovel({ monthlyPrice: 3200, exemplo: false, candidatouSe: false, availableFrom: "2026-12-05", hoje: "2026-10-15" });
  assert.equal(b.status, "Disponível a partir de 05/12");
  assert.equal(barraFixaImovel({ monthlyPrice: 3200, exemplo: false, candidatouSe: false, hoje: "2026-10-15" }).status, "Disponível agora");
});
