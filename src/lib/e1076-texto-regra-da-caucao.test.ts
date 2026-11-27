/*
  E1076 (ORDEM-DUET-362) — o TEXTO-REGRA da caução diz a regra decidida no E1061, de uma fonte só.
  A prova ao vivo de 21/11 fechou o E1061 (os valores da caução saem todos da mesma conta) e achou o resíduo: a frase que
  explica a regra ainda dizia a regra antiga — "50% do valor de cada bloco". A regra decidida (Daniel, 20/11/2026) é
  metade do aluguel da estadia toda, no máximo 3 vezes o valor mensal.
  Uma fonte de texto (src/lib/caucao-regra.ts) para: o rótulo da linha da proposta, a nota da linha "Caução" do anúncio
  (página do imóvel e cadastro), a explicação da página Caução do painel e o resumo público para robôs (llms.txt).
  Roda: node --test src/lib/e1076-texto-regra-da-caucao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGRA_CAUCAO, REGRA_CAUCAO_BASE } from "./caucao-regra.ts";
import { NOTA_CAUCAO, linhasDeTaxas } from "./reserva-imovel.ts";
import { rotuloCaucaoDaProposta } from "./propostas/caucao-da-proposta.ts";
import { resumoContratoEmDias } from "./contrato-blocos.ts";
import { llmsFullTxt } from "./seo/llms.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("a regra em palavras: 50% do aluguel da estadia, no máximo 3 vezes o valor mensal", () => {
  assert.equal(REGRA_CAUCAO_BASE, "50% do aluguel da estadia");
  assert.equal(REGRA_CAUCAO, "50% do aluguel da estadia, no máximo 3 vezes o valor mensal");
});

test("a frase diz o que a conta faz: 31 dias → metade do aluguel da estadia; estadia longa → o teto de 3 valores mensais", () => {
  // 31 dias a R$ 2.500: aluguel da estadia 2.583,33 → caução 1.292 (o caso provado ao vivo).
  assert.equal(resumoContratoEmDias(31, 2500, 0).caucaoTotal, 1292);
  // 180 dias a R$ 2.500: metade seriam 7.500 = exatamente 3 valores mensais; 270 dias não passa disso.
  assert.equal(resumoContratoEmDias(180, 2500, 0).caucaoTotal, 7500);
  assert.equal(resumoContratoEmDias(270, 2500, 0).caucaoTotal, 7500);
});

test("a nota da linha 'Caução' do anúncio diz a regra decidida, não '50% do valor de cada bloco'", () => {
  assert.equal(
    NOTA_CAUCAO,
    "50% do aluguel da estadia, no máximo 3 vezes o valor mensal no contrato. Paga direto ao proprietário e devolvida no fim, após a conferência de saída. A Viva não recebe nem segura esse dinheiro.",
  );
  assert.ok(NOTA_CAUCAO.startsWith(REGRA_CAUCAO));
  assert.doesNotMatch(NOTA_CAUCAO, /de cada bloco/);
  const caucao = linhasDeTaxas({ monthlyPrice: 2500 }).find((x) => x.chave === "caucao")!;
  assert.equal(caucao.nota, NOTA_CAUCAO);
});

test("o rótulo da proposta lê a mesma fonte (o texto não mudou)", () => {
  assert.equal(rotuloCaucaoDaProposta({ dias: 31 }), "Caução (50% do aluguel da estadia, 31 dias)");
  assert.match(ler("src/lib/propostas/caucao-da-proposta.ts"), /`Caução \(\$\{REGRA_CAUCAO_BASE\}, \$\{c\.dias\} dias\)`/);
});

test("a página Caução do painel e o llms.txt dizem a mesma regra, da mesma fonte", () => {
  const painel = ler("src/app/(dashboard)/dashboard/garantias/garantias-client.tsx");
  assert.match(painel, /\{REGRA_CAUCAO_FRASE\}/);
  assert.doesNotMatch(painel, /% de cada bloco/);
  const llms = llmsFullTxt("https://exemplo.test");
  assert.ok(llms.includes(`- Caução: ${REGRA_CAUCAO}; volta no fim, depois da conferência de saída.`));
  assert.doesNotMatch(llms, /de cada bloco/);
});

test("nenhuma frase de tela ou pública volta a dizer a regra antiga", () => {
  for (const arq of ["src/lib/reserva-imovel.ts", "src/lib/seo/llms.ts", "src/app/(dashboard)/dashboard/garantias/garantias-client.tsx"]) {
    // Só o texto entre aspas/crases conta: os comentários do código podem falar do cálculo por bloco.
    const textos = [...ler(arq).matchAll(/(["`])((?:\\.|(?!\1).)*)\1/g)].map((m) => m[2]).join("\n");
    assert.doesNotMatch(textos, /% do valor de cada bloco|% de cada bloco/, arq);
  }
});
