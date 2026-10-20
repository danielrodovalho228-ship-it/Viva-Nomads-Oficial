import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { blocosBolso, calcularBolso, NOTA_BOLSO } from "./bolso.ts";
import { comissaoSobreContrato } from "./regra.ts";

// Ordem 6696611c: cada faixa usa comissaoSobreContrato (3.000 × 6 = 18.000).
const FAIXAS: [number, number, string][] = [
  [1, 0.12, "12%"],
  [2, 0.12, "12%"],
  [3, 0.1, "10%"],
  [5, 0.1, "10%"],
  [6, 0.08, "8%"],
  [15, 0.08, "8%"],
  [16, 0.06, "6%"],
  [30, 0.06, "6%"],
];

for (const [imoveis, taxa, texto] of FAIXAS) {
  test(`${imoveis} imóvel(is): taxa ${texto} sobre o total do contrato`, () => {
    const b = calcularBolso(3000, 6, imoveis);
    assert.equal(b.estado, "ok");
    if (b.estado !== "ok") return;
    assert.equal(b.recebe, 18000);
    assert.equal(b.taxa, taxa);
    assert.equal(b.taxaTexto, texto);
    assert.equal(b.valorTaxa, comissaoSobreContrato(3000, 6, taxa));
    assert.equal(b.resultado, 18000 - b.valorTaxa);
  });
}

test("31+ imóveis é Plano Gestor: sem valor de taxa", () => {
  for (const n of [31, 80]) {
    const b = calcularBolso(3000, 6, n);
    assert.deepEqual(b, { estado: "gestor", recebe: 18000 });
  }
});

test("entrada inválida não calcula", () => {
  for (const [v, m, i] of [[0, 6, 1], [-1, 6, 1], [NaN, 6, 1], [3000, 0, 1], [3000, NaN, 1], [3000, 6, 0], [3000, 6, NaN]]) {
    assert.deepEqual(calcularBolso(v, m, i), { estado: "invalido" });
  }
});

test("meses fracionados valem o inteiro abaixo; centavos preservados", () => {
  const b = calcularBolso(2500.5, 3.9, 1);
  assert.equal(b.estado, "ok");
  if (b.estado === "ok") assert.equal(b.recebe, 7501.5);
});

test("a nota pública não usa termos proibidos", () => {
  assert.match(NOTA_BOLSO, /Anúncio grátis/);
  assert.doesNotMatch(NOTA_BOLSO, /comiss|corretagem|intermedia|aluguel/i);
});

// Adendo do #851: 3 blocos separados (a Viva só intermedia, não segura pagamentos). Exemplo aprovado pelo Muse.
test("3 blocos com o exemplo aprovado: R$ 3.000 × 4 → R$ 12.000 / R$ 1.440 / R$ 10.560", () => {
  const b = calcularBolso(3000, 4, 1);
  assert.equal(b.estado, "ok");
  if (b.estado !== "ok") return;
  assert.deepEqual([b.recebe, b.valorTaxa, b.resultado], [12000, 1440, 10560]);
  assert.deepEqual(blocosBolso(b, 3000, 4), [
    { rotulo: "Você recebe do morador", valor: "R$ 12.000", detalhe: "integral, direto a você" },
    {
      rotulo: "Taxa de serviço da Viva",
      valor: "R$ 1.440",
      detalhe: "12% sobre o valor mensal × meses (R$ 3.000 × 4). Cobrada à parte, só com contrato fechado",
    },
    { rotulo: "Seu resultado no período", valor: "R$ 10.560", detalhe: null },
  ]);
  assert.ok(!("fica" in b), "o campo interno 'fica' virou 'resultado'");
});

// Guarda de custódia estendida ao simulador: nada que sugira que a Viva retém, desconta ou repassa dinheiro.
const PROIBIDO_CUSTODIA = [/fica com você/i, /descontad/i, /retid/i, /repass/i, /do total/i];
const semComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("guarda de custódia: textos do simulador sem 'fica com você', 'descontad*', 'retid*', 'repass*', 'do total'", () => {
  const textos: string[] = [NOTA_BOLSO];
  for (const [v, m, i] of [[3000, 4, 1], [2500, 6, 3], [4200, 12, 16]] as const) {
    const b = calcularBolso(v, m, i);
    if (b.estado === "ok") for (const x of blocosBolso(b, v, m)) textos.push(x.rotulo, x.valor, x.detalhe ?? "");
  }
  const tela = semComentarios(readFileSync(fileURLToPath(new URL("../../components/precos/simulador-bolso.tsx", import.meta.url)), "utf8"));
  for (const t of [...textos, tela]) for (const re of PROIBIDO_CUSTODIA) assert.doesNotMatch(t, re, `${re} em: ${t.slice(0, 80)}`);
});

test("guarda de custódia cobre a frase do guia do proprietário (guias.ts): nada de 'fica com você'", async () => {
  const { readFileSync } = await import("node:fs");
  const guias = readFileSync(new URL("../guias/guias.ts", import.meta.url), "utf8");
  assert.doesNotMatch(guias, /fica com você/i);
  assert.match(guias, /para saber o seu resultado depois da taxa\./);
});

test("guarda de custódia: sem sinal de menos aplicado à taxa", () => {
  for (const [v, m, i] of [[3000, 4, 1], [2500, 6, 3]] as const) {
    const b = calcularBolso(v, m, i);
    if (b.estado !== "ok") continue;
    for (const x of blocosBolso(b, v, m)) assert.doesNotMatch(x.valor, /^[-−–]/);
  }
  const tela = semComentarios(readFileSync(fileURLToPath(new URL("../../components/precos/simulador-bolso.tsx", import.meta.url)), "utf8"));
  assert.doesNotMatch(tela, /[−–]\s*\$\{|`-\s*\$\{|"−|"-\s*R\$/, "nenhum '− R$' montado na tela");
  assert.match(tela, /testid="bolso-seu-resultado"/);
  assert.doesNotMatch(tela, /bolso-fica/);
});
