/* Roda: node --test src/lib/e899-cartao-enxuto.test.ts
   E899 (Daniel, 13/11, uso real): o cartão de imóvel tinha texto demais (~9 linhas). Fica só o essencial; a composição do
   valor (do mês e da estadia) sai do cartão e mora na página do imóvel. Lei E777: os números do cartão vêm da mesma fonte
   única da página. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { AVISO_CARTAO_CONTAS_A_PARTE, AVISO_CARTAO_TUDO_INCLUIDO, avisoDoCartao, calcularTudoIncluido, estadiaDoImovel, precoDoImovel } from "./precos.ts";
import { formatBRL } from "./utils.ts";
import { modeloDoCartao } from "./cartao-modelo.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const imovel = (id: string) => SAMPLE_PROPERTIES.find((p) => p.id === id)!;
const ube001 = imovel("ube-001");
// Fixtures obrigatórias: ube-001; contas fixas; contas medidas; com as duas limpezas; sem nenhuma limpeza.
const FIXTURES = {
  "ube-001": ube001,
  "contas fixas (ube-002)": imovel("ube-002"),
  "contas medidas (ube-003)": imovel("ube-003"),
  "com limpeza de preparação e de saída (ube-004)": imovel("ube-004"),
  "sem nenhuma limpeza": { ...ube001, id: "sem-limpeza", prepFee: 0, checkoutCleaningEnabled: false, checkoutCleaningFee: 0, limpezaEstadia: undefined },
};

test("fixtures: as condições que o T1 pede valem de fato", () => {
  assert.equal(FIXTURES["contas fixas (ube-002)"].utilitiesMode, "fixed");
  assert.notEqual(FIXTURES["contas medidas (ube-003)"].utilitiesMode, "fixed");
  assert.deepEqual(precoDoImovel(FIXTURES["com limpeza de preparação e de saída (ube-004)"], 2).unicos.map((u) => u.rotulo), ["Limpeza de preparação", "Limpeza de saída"]);
  assert.deepEqual(precoDoImovel(FIXTURES["sem nenhuma limpeza"], 2).unicos, []);
});

test("T1 (lei E777): precoMes = total do mês da fonte única; totalEstadia = estadiaDoImovel(p, N).total, com 1 e N > 1 meses", () => {
  for (const [nome, p] of Object.entries(FIXTURES)) {
    for (const meses of [1, 2, 6]) {
      const m = modeloDoCartao(p, meses);
      assert.equal(m.precoMes, formatBRL(calcularTudoIncluido(p).total), `${nome}, ${meses}: /mês`);
      const pagina = estadiaDoImovel(p, meses)!;
      assert.equal(m.totalEstadia.total, pagina.total, `${nome}, ${meses}: total da estadia = página`);
      assert.equal(m.totalEstadia.meses, meses, `${nome}, ${meses}: meses`);
      assert.match(m.totalEstadia.texto, new RegExp(`em ${meses} ${meses === 1 ? "mês" : "meses"}$`), `${nome}, ${meses}: texto`);
      assert.ok(m.totalEstadia.texto.startsWith(formatBRL(pagina.total)), `${nome}, ${meses}: o número do texto é o da página`);
    }
  }
  // O número que a prova ao vivo do E756 mediu: ube-001, 1 mês = 1 × R$ 3.960 + R$ 450 + R$ 250.
  assert.equal(modeloDoCartao(ube001, 1).totalEstadia.total, 4660);
  // Sem limpeza nenhuma, o total da estadia é só N × total do mês.
  assert.equal(modeloDoCartao(FIXTURES["sem nenhuma limpeza"], 2).totalEstadia.total, 2 * calcularTudoIncluido(ube001).total);
});

test("T1: o modelo traz também a síntese (sem o nível, que é selo da foto) e o disponível", () => {
  const m = modeloDoCartao({ ...ube001, availableFrom: "2099-03-15" }, 1, new Date("2026-11-13T12:00:00Z"));
  assert.ok(m.sintese.length > 0);
  assert.ok(m.sintese.every((i) => i.chave !== "nivel"));
  assert.equal(m.disponivel, "Disponível a partir de 15/03/2099");
});

test("T2 (honestidade do aviso): 'tudo incluído' se, e somente se, as contas são fixas", () => {
  assert.equal(AVISO_CARTAO_TUDO_INCLUIDO, "tudo incluído");
  assert.equal(AVISO_CARTAO_CONTAS_A_PARTE, "água, luz e gás à parte");
  for (const modo of ["fixed", "real", undefined, null, "", "outro"]) {
    const p = { ...ube001, utilitiesMode: modo } as typeof ube001;
    const aviso = modeloDoCartao(p, 1).aviso;
    assert.equal(aviso, avisoDoCartao(p));
    if (modo === "fixed") assert.equal(aviso, AVISO_CARTAO_TUDO_INCLUIDO, String(modo));
    else assert.equal(aviso, AVISO_CARTAO_CONTAS_A_PARTE, String(modo));
    // Nunca os dois, nunca nenhum.
    assert.ok(aviso.length > 0);
    assert.ok(!(aviso.includes("tudo incluído") && aviso.includes("à parte")), String(modo));
  }
  for (const p of SAMPLE_PROPERTIES) {
    const aviso = modeloDoCartao(p, 1).aviso;
    assert.equal(aviso.includes("tudo incluído"), p.utilitiesMode === "fixed", p.id);
  }
});

test("T3 (estático): o PropertyCard desenha do modelo e não reintroduz composição nem o rótulo antigo", () => {
  const card = ler("components/property-card.tsx");
  assert.match(card, /modeloDoCartao\(/);
  assert.doesNotMatch(card, /composicaoDoMes/);
  assert.doesNotMatch(card, /estadiaNoCartao/);
  for (const id of ["cartao-mes-composicao", "cartao-total-composicao", "cartao-total-rotulo"]) assert.ok(!card.includes(id), id);
  assert.match(card, /data-testid="cartao-aviso"/);
  // Local e título em 1 linha cada.
  assert.match(card, /line-clamp-1[^"]*"[^>]*data-testid="cartao-local"/);
  assert.match(card, /line-clamp-1[^"]*"[^>]*data-testid="cartao-titulo"/);
  // Nada de "Detalhes do valor" clicável dentro do cartão (o cartão inteiro é um link).
  assert.doesNotMatch(card, /<details|Detalhes do valor/);
});

test("T3: a constante duplicada do cartão saiu; o rótulo do total do mês é um só (precos.ts)", async () => {
  const cartaoPreco = await import("./cartao-preco.ts");
  assert.equal("ROTULO_TOTAL_MES" in cartaoPreco, false);
  const { ROTULO_TOTAL_MES } = await import("./precos.ts");
  assert.equal(ROTULO_TOTAL_MES, "Total por mês (com contas)");
});

test("página do imóvel: mostra as duas composições pelas MESMAS funções que o cartão usava", () => {
  const painel = ler("components/property/price-card.tsx");
  assert.match(painel, /composicaoDoMes\(property\)/);
  assert.match(painel, /data-testid="cartao-lateral-mes-composicao"/);
  assert.match(painel, /estadiaDoImovel\(property, Math\.max\(1, meses\)\)/);
  assert.match(painel, /<FormulaDoTotal conta=\{estadia\.conta\}/);
});
