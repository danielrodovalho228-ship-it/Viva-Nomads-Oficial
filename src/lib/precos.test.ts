/*
  Testes da fonte única do preço "tudo incluído" (corrige a divergência do E2E).
  Roda com: node --experimental-strip-types --test src/lib/precos.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import { calcularTudoIncluido, totalPeriodo } from "./precos.ts";

// Objeto mínimo compatível com o que a função usa (evita depender do tipo cheio).
function imovel(over: Record<string, unknown>) {
  return {
    monthlyPrice: 3000,
    condoFee: 0,
    utilitiesMode: "fixed",
    utilitiesEstimate: 0,
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

test("tudo incluído = aluguel + condomínio + consumo fixo", () => {
  const r = calcularTudoIncluido(imovel({ monthlyPrice: 3000, condoFee: 480, utilitiesEstimate: 480 }));
  assert.equal(r.total, 3960); // 3000 + 480 + 480
  assert.equal(r.condominio, 480);
  assert.equal(r.consumoFixo, 480);
  assert.equal(r.temExtras, true);
});

test("regime medido: consumo não entra no número exibido", () => {
  const r = calcularTudoIncluido(imovel({ utilitiesMode: "medido", utilitiesEstimate: 999, condoFee: 200 }));
  assert.equal(r.consumoFixo, 0);
  assert.equal(r.total, 3200); // 3000 + 200 (condomínio) + 0
});

test("sem extras: total = aluguel e temExtras = false", () => {
  const r = calcularTudoIncluido(imovel({ condoFee: 0, utilitiesEstimate: 0 }));
  assert.equal(r.total, 3000);
  assert.equal(r.temExtras, false);
});

test("total do período = tudo incluído × meses", () => {
  const im = imovel({ monthlyPrice: 3000, condoFee: 480, utilitiesEstimate: 480 });
  assert.equal(totalPeriodo(im, 4), 15840); // 3960 × 4
});

// ---- Custo total do mês (ordem 1a555bfa): uma função só para página, cartão e barra ----
import { calcularTotalMensal, textosTotalMensal } from "./precos.ts";

test("total mensal: valor + condomínio + contas fixas (estimadas); Taxa Viva R$ 0", () => {
  const t = calcularTotalMensal(imovel({ monthlyPrice: 3000, condoFee: 480, utilitiesEstimate: 280 }));
  assert.equal(t.total, 3760);
  assert.deepEqual(t.linhas.map((l) => l.chave), ["mensal", "condominio", "contas", "viva"]);
  assert.equal(t.linhas.find((l) => l.chave === "contas")!.estimativa, true);
  assert.equal(t.linhas.find((l) => l.chave === "viva")!.valor, 0);
  assert.equal(t.iptuNaoIncluso, true);
});

test("total mensal: sem condomínio e sem contas, só valor mensal e Taxa Viva", () => {
  const t = calcularTotalMensal(imovel({ monthlyPrice: 2500 }));
  assert.equal(t.total, 2500);
  assert.deepEqual(t.linhas.map((l) => l.chave), ["mensal", "viva"]);
});

test("total mensal: contas medidas (regime real) ficam fora do total", () => {
  const t = calcularTotalMensal(imovel({ monthlyPrice: 3000, condoFee: 200, utilitiesMode: "real", utilitiesEstimate: 999 }));
  assert.equal(t.total, 3200);
  assert.equal(t.linhas.some((l) => l.chave === "contas"), false);
  assert.equal(t.contasMedidas, true);
});

test("total mensal: pagamentos únicos ficam FORA do total e vão numa lista à parte", () => {
  const sem = calcularTotalMensal(imovel({ monthlyPrice: 3000 }));
  const com = calcularTotalMensal(imovel({ monthlyPrice: 3000, prepFee: 450, checkoutCleaningEnabled: true, checkoutCleaningFee: 250 }));
  assert.equal(com.total, sem.total);
  assert.deepEqual(com.unicos.map((u) => u.chave), ["preparacao", "saida"]);
  assert.equal(com.unicos[0].valor, 450);
  // limpeza de saída desligada não aparece
  const off = calcularTotalMensal(imovel({ monthlyPrice: 3000, checkoutCleaningEnabled: false, checkoutCleaningFee: 250 }));
  assert.deepEqual(off.unicos, []);
});

test("total mensal bate com calcularTudoIncluido (mesmo número em toda tela)", () => {
  const im = imovel({ monthlyPrice: 3100, condoFee: 350, utilitiesEstimate: 200 });
  assert.equal(calcularTotalMensal(im).total, calcularTudoIncluido(im).total);
});

test("textos do cartão: total em destaque e detalhe menor", () => {
  const a = textosTotalMensal(imovel({ monthlyPrice: 3000, condoFee: 480, utilitiesEstimate: 280 }));
  assert.match(a.destaque, /^R\$\s?3\.760.*\/mês total$/);
  assert.match(a.detalhe, /Valor mensal R\$\s?3\.000 \+ condomínio e contas$/);
  const b = textosTotalMensal(imovel({ monthlyPrice: 3000, condoFee: 480 }));
  assert.match(b.detalhe, /\+ condomínio$/);
  const c = textosTotalMensal(imovel({ monthlyPrice: 3000, utilitiesMode: "real" }));
  assert.match(c.detalhe, /\+ consumo medido$/);
  const d = textosTotalMensal(imovel({ monthlyPrice: 3000 }));
  assert.match(d.detalhe, /^Valor mensal R\$\s?3\.000$/);
  for (const x of [a, b, c, d]) assert.doesNotMatch(x.destaque + x.detalhe, /aluguel|comiss/i);
});

// ── Pacote de limpeza durante a estadia no total do mês (ordem 87aabd61) ──
test("pacote PAGO entra na linha e no total (ube-001: sem pacote segue 3.960)", () => {
  const sem = calcularTotalMensal(imovel({ monthlyPrice: 3200, condoFee: 480, utilitiesMode: "fixed", utilitiesEstimate: 280 }));
  assert.equal(sem.total, 3960);
  assert.ok(!sem.linhas.some((l) => l.chave === "limpeza"));
  const com = calcularTotalMensal(imovel({ monthlyPrice: 2400, condoFee: 350, utilitiesMode: "fixed", utilitiesEstimate: 200, limpezaEstadia: { porMes: 2, inclui: "pisos", valorMes: 180 } }));
  assert.equal(com.total, 3130);
  const l = com.linhas.find((x) => x.chave === "limpeza")!;
  assert.equal(l.valor, 180);
  assert.match(l.rotulo, /Limpeza durante a estadia \(2 por mês\)/);
  assert.equal(com.total, com.linhas.reduce((s, x) => s + x.valor, 0));
  assert.equal(calcularTudoIncluido(imovel({ monthlyPrice: 2400, limpezaEstadia: { porMes: 2, inclui: "", valorMes: 180 } })).total, 2580);
  assert.match(textosTotalMensal(imovel({ monthlyPrice: 2400, limpezaEstadia: { porMes: 2, inclui: "", valorMes: 180 } })).detalhe, /limpeza/);
});

test("pacote incluído (valor 0): linha diz incluída e soma 0", () => {
  const t = calcularTotalMensal(imovel({ monthlyPrice: 2500, limpezaEstadia: { porMes: 1, inclui: "", valorMes: 0 } }));
  assert.equal(t.total, 2500);
  const l = t.linhas.find((x) => x.chave === "limpeza")!;
  assert.equal(l.valor, 0);
  assert.equal(l.incluida, true);
  assert.match(l.rotulo, /incluída no valor mensal/);
});
