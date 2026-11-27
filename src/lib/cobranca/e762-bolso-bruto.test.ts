// E762: "O que vai para o seu bolso" mostrava o valor BRUTO (R$ 3.350 × 4 = R$ 13.400) ao lado da taxa (R$ 1.536) — o título prometia líquido e o
// número entregava bruto. O rótulo agora diz que os valores são brutos; a guarda de custódia do E51 (nada de subtrair a taxa do que o morador paga) segue.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AVISO_VALORES_BRUTOS, blocosBolsoPeriodo } from "./bolso.ts";
import { contaDoPeriodo } from "../precos.ts";

const tela = readFileSync("src/components/precos/simulador-bolso.tsx", "utf8");

test("E762: o simulador diz logo sob o título que os valores são brutos e que a taxa é cobrada à parte", () => {
  assert.match(AVISO_VALORES_BRUTOS, /^Valores brutos:/);
  assert.match(AVISO_VALORES_BRUTOS, /à parte/);
  assert.match(tela, /data-testid="bolso-aviso-brutos"/);
  assert.match(tela, /\{AVISO_VALORES_BRUTOS\}/);
});

test("E762: o exemplo do achado — R$ 3.350 × 4 = R$ 13.400 bruto, taxa à parte — continua dois fatos separados, sem subtração", () => {
  const c = contaDoPeriodo({ monthlyPrice: 3350, condoFee: 0, utilitiesMode: "real", utilitiesEstimate: 0 } as never, 4, 0.1147)!;
  const [recebe, taxa, ...resto] = blocosBolsoPeriodo(c);
  assert.equal(resto.length, 0, "dois fatos");
  assert.match(recebe.valor.replace(/\s/g, " "), /R\$ 13\.400/);
  assert.equal(recebe.rotulo, "Você recebe do morador");
  assert.match(taxa.rotulo, /Taxa de serviço/);
});

test("E762: o aviso não usa as palavras que a guarda de custódia proíbe", () => {
  for (const re of [/fica com você/i, /descontad/i, /retid/i, /repass/i, /do total/i, /seu resultado/i]) assert.doesNotMatch(AVISO_VALORES_BRUTOS, re);
});
