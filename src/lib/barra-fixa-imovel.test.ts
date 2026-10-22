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

test("anúncio de exemplo mostra a barra em demonstração (ordem 4f8023d1)", () => {
  const b = barraFixaImovel({ monthlyPrice: 3200, exemplo: true, candidatouSe: false });
  assert.equal(b.visivel, true);
  assert.equal(b.demonstracao, true);
  assert.equal(barraFixaImovel({ monthlyPrice: 3200, exemplo: false, candidatouSe: false }).demonstracao, false);
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

test("barra fixa mostra o TOTAL do mês quando informado (ordem 1a555bfa), não só o valor mensal", () => {
  const b = barraFixaImovel({ monthlyPrice: 3000, totalMensal: 3760, exemplo: false, candidatouSe: false });
  assert.equal(b.valor, formatBRL(3760));
  assert.equal(barraFixaImovel({ monthlyPrice: 3000, exemplo: false, candidatouSe: false }).valor, formatBRL(3000));
});

test("Prompt 41: valor mensal + total pela duração escolhida; N = 1 mostra só /mês", () => {
  const b = barraFixaImovel({ monthlyPrice: 3000, totalMensal: 3130, meses: 3, exemplo: false, candidatouSe: false });
  assert.equal(b.mes, `${formatBRL(3130)}/mês`);
  assert.equal(b.estadia, `${formatBRL(9390)} em 3 meses`);
  const um = barraFixaImovel({ monthlyPrice: 3000, totalMensal: 3130, meses: 1, exemplo: false, candidatouSe: false });
  assert.equal(um.mes, `${formatBRL(3130)}/mês`);
  assert.equal(um.estadia, null);
  assert.equal(barraFixaImovel({ monthlyPrice: 3000, exemplo: false, candidatouSe: false }).estadia, null);
});
