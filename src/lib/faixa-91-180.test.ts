/*
  TRAVA FAIXA_91_180 (preparação do coordenador, 05/11): a chave NEXT_PUBLIC_FAIXA_91_180_ATIVA nasce LIGADA — 91 a 180
  dias continuam permitidos e nada muda hoje. Só o valor "off" desliga; desligada, propostas e contratos NOVOS ficam em
  30–90 dias. Ninguém desliga agora.
  Roda: node --test src/lib/faixa-91-180.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXA_91_180_ATIVA } from "./flags.ts";
import { diasMaxEstadiaVigente, diasValidos } from "./estadia-em-dias.ts";
import { diasDoAnuncio, mesesDoAnuncio, validarTermos, type TermosProposta } from "./propostas/regras.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("a chave nasce LIGADA (posição atual): 91–180 permitido, o comportamento de hoje não muda", () => {
  assert.equal(FAIXA_91_180_ATIVA, true);
  assert.match(ler("lib/flags.ts"), /export const FAIXA_91_180_ATIVA = process\.env\.NEXT_PUBLIC_FAIXA_91_180_ATIVA !== "off";/);
  assert.equal(diasMaxEstadiaVigente(), 180);
  assert.equal(diasValidos(120), true);
  assert.equal(diasValidos(180), true);
  assert.deepEqual(diasDoAnuncio(30, 180), { min: 30, max: 180 });
  assert.deepEqual(mesesDoAnuncio(30, 180), { min: 1, max: 6 });
});

test("desligada: estadias novas de 30 a 90 dias", () => {
  assert.equal(diasMaxEstadiaVigente(false), 90);
  assert.equal(diasValidos(90, false), true);
  assert.equal(diasValidos(91, false), false);
  assert.equal(diasValidos(180, false), false);
  assert.deepEqual(diasDoAnuncio(30, 180, false), { min: 30, max: 90 });
  assert.deepEqual(diasDoAnuncio(120, 180, false), { min: 90, max: 90 });
  assert.deepEqual(mesesDoAnuncio(30, 180, false), { min: 1, max: 3 });
});

test("proposta: com a chave ligada, 120 dias passam na validação (como hoje)", () => {
  const t: TermosProposta = {
    valorBase: 3000, descontoPct: 0, descontoValor: 0, motivoDesconto: null, descontoEstadiaPct: 0, meses: 4, dias: 120,
    dataEntrada: "2027-01-10", condominio: 0, consumo: 0, limpezasMes: 0, valorLimpeza: 0, taxaPet: 0, limpezaUnica: 0,
  };
  assert.equal(validarTermos(t, { mesesMin: 1, mesesMax: 6, diasMin: 30, diasMax: 180, capacidade: null }, "2026-11-05"), null);
});

test("contrato novo e montagem da proposta usam o teto vigente", () => {
  const acoes = ler("lib/data/actions.ts");
  assert.match(acoes, /const tetoDias = diasMaxEstadiaVigente\(\);/);
  assert.match(acoes, /prazo <= tetoMeses/);
  assert.match(ler("app/(dashboard)/dashboard/orcamentos/nova/montagem-proposta.tsx"), /Math\.min\(diasMaxEstadiaVigente\(\), dados\.limites\.diasMax/);
  assert.match(ler("lib/propostas/regras.ts"), /Math\.min\(diasMaxEstadiaVigente\(\), lim\.diasMax/);
});
