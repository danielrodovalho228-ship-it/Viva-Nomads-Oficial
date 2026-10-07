/*
  G1 — garantia ÚNICA por contrato (Lei 8.245/91, art. 37): caução OU seguro-fiança.
  Roda: node --test src/lib/garantia-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { faixaFianca, garantiaDoContrato, validarGarantia } from "./guarantees.ts";
import { resumoContrato } from "./contrato-blocos.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("faixa do seguro-fiança é configurável (padrão 90 a 180; Chubb: até 90)", () => {
  assert.deepEqual(faixaFianca(), { minDias: 90, maxDias: 180 });
  assert.deepEqual(faixaFianca({ min: "1", max: "90" }), { minDias: 1, maxDias: 90 });
  // inválido volta ao padrão: fora de 1..180, texto, ou mínimo acima do máximo
  assert.deepEqual(faixaFianca({ min: "0", max: "200" }), { minDias: 90, maxDias: 180 });
  assert.deepEqual(faixaFianca({ min: "abc" }), { minDias: 90, maxDias: 180 });
  assert.deepEqual(faixaFianca({ min: "120", max: "60" }), { minDias: 90, maxDias: 180 });
  assert.match(ler("lib/guarantees.ts"), /NEXT_PUBLIC_FIANCA_PRAZO_MIN_DIAS[\s\S]*NEXT_PUBLIC_FIANCA_PRAZO_MAX_DIAS/);
});

test("servidor: fiança só com a flag ligada e dentro da faixa; caução sempre", () => {
  const faixa = { minDias: 90, maxDias: 180 };
  assert.deepEqual(validarGarantia("caucao", 30, { fiancaAtiva: false, faixa }), { ok: true });
  assert.equal(validarGarantia("seguro_fianca", 120, { fiancaAtiva: false, faixa }).ok, false); // desligada
  assert.equal(validarGarantia("seguro_fianca", 60, { fiancaAtiva: true, faixa }).ok, false); // fora da faixa
  assert.deepEqual(validarGarantia("seguro_fianca", 120, { fiancaAtiva: true, faixa }), { ok: true });
  // Chubb: até 90 dias
  assert.deepEqual(validarGarantia("seguro_fianca", 60, { fiancaAtiva: true, faixa: { minDias: 1, maxDias: 90 } }), { ok: true });
  assert.equal(garantiaDoContrato("garantidor_digital"), "seguro_fianca");
  assert.equal(garantiaDoContrato("caucao"), "caucao");
  assert.equal(garantiaDoContrato(null), "caucao");
});

test("caução continua 50% de cada bloco com a soma limitada a 3 aluguéis", () => {
  // 6 meses de R$ 2.000 em blocos de 3 meses: 3.000 + 3.000 = 6.000 (= 3 aluguéis)
  assert.equal(resumoContrato(6, 2000, 0.12, 3).caucaoTotal, 6000);
  // 6 meses de R$ 2.000 em blocos de 2: 2.000 + 2.000 + 2.000 = 6.000 (teto)
  assert.equal(resumoContrato(6, 2000, 0.12, 2).caucaoTotal, 6000);
  // a conta antiga sem teto saiu do código
  assert.doesNotMatch(ler("lib/caucao.ts"), /export function calcularCaucao50/);
});

test("registrarContrato grava a garantia e zera a caução dos blocos com seguro-fiança (também na renovação)", () => {
  const a = ler("lib/data/actions.ts");
  assert.match(a, /validarGarantia\(garantia, resumo\.prazoTotalMeses \* DIAS_POR_MES\)/);
  assert.match(a, /capacidade_snapshot: input\.capacidadeSnapshot \?\? null,\s*garantia,/);
  assert.match(a, /caucao: garantia === "seguro_fianca" \? 0 : b\.caucao/);
  assert.match(a, /caucao: contrato\.garantia === "seguro_fianca" \? 0 : caucaoDoBloco/);
});

test("fechamento: 'Sua proteção' com as duas frases e 'Li e entendi' obrigatório; garantia enviada ao servidor", () => {
  const f = ler("app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.match(f, /Em qualquer opção, você responde pelos danos que causar\./);
  assert.match(f, /Desgaste normal e defeitos são do proprietário\./);
  assert.match(f, /Li e entendi\./);
  assert.match(f, /\(step === 1 && !!guaranteeId && cienteProtecao\)/);
  assert.match(f, /if \(!guaranteeId \|\| !cienteProtecao\) return 1;/);
  assert.match(f, /garantia: garantiaDoContrato\(guaranteeId\)/);
  assert.match(f, /valor de cotação da seguradora/);
  // nunca "garantia de verdade / cobre o aluguel" vendido como da plataforma
  assert.doesNotMatch(f, /Garantia de verdade/);
});

test("banco (0076): uma garantia só — caução zero com fiança, pagamento de caução recusado", () => {
  const sql = ler("../supabase/migrations/0076_garantia_unica.sql");
  assert.match(sql, /garantia text not null default 'caucao'/);
  assert.match(sql, /garantia_contrato = 'seguro_fianca' and coalesce\(new\.caucao, 0\) > 0/);
  assert.match(sql, /new\.tipo = 'caucao'[\s\S]*c\.garantia = 'seguro_fianca'/);
  assert.match(sql, /caucao_total > aluguel \* 3/);
});
