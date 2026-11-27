/*
  E646 — seletor de duração da estadia no simulador dos sócios (/simulacao e /roi, o mesmo ModeloFinanceiro): 1 a 6 meses,
  e o ponto de equilíbrio (contratos/mês) recalculado na hora nos DOIS regimes (Simples e Presumido), mantidas as premissas
  oficiais do modelo v3. A conta é UMA função pura; a tela só a desenha.
  Roda: node --test src/lib/financeiro/e646-duracao-equilibrio.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DURACOES_SIMULADOR, equilibrioPorDuracao, custoFixoDe, porContrato } from "./projecao.ts";
import { MESES_MEDIOS_CONTRATO, REGIMES } from "../../config/premissas-financeiras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("as durações oferecidas são 1, 2, 3, 4, 5 e 6 meses, e a premissa oficial (3) é uma delas", () => {
  assert.deepEqual([...DURACOES_SIMULADOR], [1, 2, 3, 4, 5, 6]);
  assert.ok(DURACOES_SIMULADOR.includes(MESES_MEDIOS_CONTRATO));
});

test("com as premissas oficiais, a duração oficial (3 meses) dá o mesmo equilíbrio de hoje: Simples 10, Presumido 13", () => {
  const l = equilibrioPorDuracao({ operador: 0 }).find((x) => x.meses === 3)!;
  assert.deepEqual([l.simples, l.presumido], [10, 13]);
});

test("cada linha é a conta do próprio modelo: custo fixo do regime ÷ margem do contrato daquela duração", () => {
  for (const l of equilibrioPorDuracao({ operador: 0 })) {
    for (const r of REGIMES) {
      const op = { operador: 0, regime: r.id, mesesContrato: l.meses };
      const esperado = Math.ceil(custoFixoDe(op) / porContrato(op).margem);
      assert.equal(l[r.id], esperado, `${l.meses} meses · ${r.id}`);
    }
  }
});

test("duração maior = mais receita por contrato = menos contratos para empatar (nunca mais), e o Presumido nunca empata antes do Simples", () => {
  const linhas = equilibrioPorDuracao({ operador: 0 });
  for (let i = 1; i < linhas.length; i++) {
    assert.ok(linhas[i].simples! <= linhas[i - 1].simples!, `simples ${linhas[i].meses}`);
    assert.ok(linhas[i].presumido! <= linhas[i - 1].presumido!, `presumido ${linhas[i].meses}`);
  }
  for (const l of linhas) assert.ok(l.presumido! >= l.simples!, `${l.meses} meses`);
});

test("respeita as demais escolhas da tela (faixa de taxa e custo fixo) e ignora o regime/duração que vieram nelas", () => {
  const base = equilibrioPorDuracao({ operador: 0 });
  const taxaBaixa = equilibrioPorDuracao({ operador: 0, taxa: 0.06 });
  assert.ok(taxaBaixa.every((l, i) => l.simples! >= base[i].simples!));
  assert.deepEqual(equilibrioPorDuracao({ operador: 0, regime: "presumido", mesesContrato: 6 }), base, "regime e duração são o eixo da tabela");
});

test("a tela: seletor 1–6 com a duração ligada ao estado, e a tabela dos dois regimes ao lado", () => {
  const t = ler("src/components/financeiro/modelo-financeiro.tsx");
  assert.match(t, /data-testid="seletor-duracao"/);
  assert.match(t, /DURACOES_SIMULADOR\.map\(/);
  assert.match(t, /data-testid=\{`duracao-\$\{m\}`\}/);
  assert.match(t, /onClick=\{\(\) => setMesesContrato\(m\)\}/);
  assert.match(t, /equilibrioPorDuracao\(op\)/);
  assert.match(t, /data-testid="equilibrio-duracao"/);
  assert.match(t, /data-testid="equilibrio-selecionado-simples"/);
  assert.match(t, /data-testid="equilibrio-selecionado-presumido"/);
  // as duas páginas usam o mesmo componente
  assert.match(ler("src/app/simulacao/page.tsx"), /<ModeloFinanceiro pagina="simulacao"/);
  assert.match(ler("src/app/roi/page.tsx"), /<ModeloFinanceiro pagina="roi"/);
});
