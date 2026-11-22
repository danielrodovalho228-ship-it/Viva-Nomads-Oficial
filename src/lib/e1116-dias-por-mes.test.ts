/*
  E1116 (ORDEM-DUET-503; achado R6 da auditoria dos relógios, ORDEM-502 §3): a conversão meses ↔ dias da estadia sai da
  regra única — DIAS_POR_MES (lib/contrato-blocos.ts) = REGRAS_CONTRATO.diasPorMes (config/planos.ts). Nas superfícies
  varridas não sobra nenhum "× 30" nem "÷ 30" de duração escrito à mão (no padrão da trava do E1111).
  Roda: node --test src/lib/e1116-dias-por-mes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGRAS_CONTRATO } from "../config/planos.ts";
import { DIAS_POR_MES } from "./contrato-blocos.ts";
import { comissaoSobreDias, rotuloTaxaServico } from "./cobranca/regra.ts";

const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ [^\n"`]*$/gm, "");
/** "× 30" / "÷ 30" de duração: `* 30`, `/ 30`, `÷ 30` (o 30 sozinho, não 300 nem 30_000). */
const LITERAL = /(?:[*/]|÷) ?30(?![\d_.])/g;

const SUPERFICIES = [
  "src/lib/data/propostas-servidor.ts",
  "src/lib/data/propostas-actions.ts",
  "src/lib/data/estadia-actions.ts",
  "src/lib/data/contrato-assinar-actions.ts",
  "src/lib/data/actions.ts",
  "src/lib/data/carteira-teste-actions.ts",
  "src/lib/calendario/importar-servidor.ts",
  "src/lib/cobranca/regra.ts",
];

test("E1116: nenhum '× 30' / '÷ 30' de duração escrito à mão nas superfícies varridas", () => {
  for (const f of SUPERFICIES) {
    const achados = semComentarios(readFileSync(f, "utf8")).match(LITERAL) ?? [];
    assert.deepEqual(achados, [], `${f}: ${achados.join(", ")}`);
  }
});

test("E1116: as superfícies leem a regra única (DIAS_POR_MES ou REGRAS_CONTRATO.diasPorMes)", () => {
  for (const f of SUPERFICIES) {
    const s = semComentarios(readFileSync(f, "utf8"));
    assert.match(s, /\bDIAS_POR_MES\b|REGRAS_CONTRATO\.diasPorMes/, f);
  }
});

test("E1116: os valores não mudam — 30 dias por mês, a mesma conta e o mesmo texto", () => {
  assert.equal(REGRAS_CONTRATO.diasPorMes, 30);
  assert.equal(DIAS_POR_MES, 30);
  assert.equal(comissaoSobreDias(2800, 43, 0.12), 481.6);
  assert.match(rotuloTaxaServico(0.12, 2800, 43 / 30), /sobre o valor mensal × dias ÷ 30 \(R\$ 2\.800(,00)? × 43 dias ÷ 30 = R\$ 4\.013,33\)/);
});
