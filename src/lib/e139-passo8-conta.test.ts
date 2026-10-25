/*
  E139/E140/E151 — Passo 8 (preço): uma conta só para a prévia, o simulador e o comparador do Airbnb.
  Exemplo da reprodução do E139: valor mensal R$ 3.600 + condomínio R$ 350 + contas R$ 150, 4 meses, 12%.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcularTudoIncluido, contaDoPeriodo, parcelasDoMes, type CamposTotalMes } from "./precos.ts";
import { blocosBolsoPeriodo } from "./cobranca/bolso.ts";
import { comissaoSobreContrato } from "./cobranca/regra.ts";
import { precoSugerido, recebeAirbnb, recebeViva } from "./preco-justo.ts";

const nbsp = (s: string) => s.replace(/ /g, " ");
const E139 = { monthlyPrice: 3600, condoFee: 350, utilitiesMode: "fixed", utilitiesEstimate: 150 } as CamposTotalMes;
const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const semComentarios = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("E139: o morador paga o total do mês COM contas × meses (16.400), e a taxa é 12% do valor mensal × meses (1.728)", () => {
  const c = contaDoPeriodo(E139, 4, 0.12)!;
  assert.equal(c.mes.total, 4100);
  assert.equal(c.mes.total, calcularTudoIncluido(E139).total, "a mesma função do anúncio e da busca");
  assert.equal(c.totalMorador, 16400);
  assert.equal(c.baseTaxa, 14400);
  assert.equal(c.valorTaxa, 1728);
  assert.equal(c.valorTaxa, comissaoSobreContrato(3600, 4, 0.12), "a fórmula única da taxa");
});

test("E139: os 2 fatos do simulador trazem a conta aberta e a base da taxa escrita (sem 'valor total do contrato')", () => {
  const [recebe, taxa] = blocosBolsoPeriodo(contaDoPeriodo(E139, 4, 0.12)!);
  assert.equal(recebe.valor, "R$ 16.400");
  assert.equal(nbsp(recebe.detalhe!), "R$ 4.100/mês (valor mensal R$ 3.600 + condomínio R$ 350 + contas R$ 150) × 4, direto a você");
  assert.equal(taxa.valor, "R$ 1.728");
  assert.equal(taxa.detalhe, "12% sobre o valor mensal × meses (R$ 3.600 × 4 = R$ 14.400). Condomínio e contas não entram na taxa");
  for (const t of [recebe.detalhe!, taxa.detalhe!]) assert.doesNotMatch(t, /valor total do contrato|fica com você|descontad/i);
});

test("E139: sem condomínio e contas, a conta não inventa parcelas", () => {
  const [recebe, taxa] = blocosBolsoPeriodo(contaDoPeriodo({ monthlyPrice: 3000 } as CamposTotalMes, 4, 0.12)!);
  assert.equal(recebe.valor, "R$ 12.000");
  assert.equal(recebe.detalhe, "R$ 3.000/mês × 4, direto a você");
  assert.equal(taxa.detalhe, "12% sobre o valor mensal × meses (R$ 3.000 × 4 = R$ 12.000)");
  assert.equal(nbsp(parcelasDoMes(calcularTudoIncluido({ monthlyPrice: 3000, utilitiesMode: "real", utilitiesEstimate: 200 } as CamposTotalMes))), "valor mensal R$ 3.000");
});

test("E139: entrada inválida não monta conta", () => {
  assert.equal(contaDoPeriodo({ monthlyPrice: 0 } as CamposTotalMes, 4, 0.12), null);
  assert.equal(contaDoPeriodo(E139, 0, 0.12), null);
  assert.equal(contaDoPeriodo(E139, Number.NaN, 0.12), null);
});

test("E140: com o mesmo período dos dois lados, o equivalente iguala (ou passa) o líquido do Airbnb no período", () => {
  for (const meses of [2, 4, 6]) {
    const p = precoSugerido(4500 * (meses / 2), meses, 0.12)!;
    assert.ok(recebeViva(p, meses, 0.12) >= recebeAirbnb(4500 * (meses / 2)));
    assert.ok(recebeViva(p - 1, meses, 0.12) < recebeAirbnb(4500 * (meses / 2)), "é o MENOR valor mensal equivalente");
  }
});

test("E139/E151: o Passo 8 usa a conta única, sem a 'linha comparativa' e sem a regra pública repetida", () => {
  const preco = semComentarios(ler("../app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx"));
  assert.match(preco, /calcularTudoIncluido\(campos\)/);
  assert.match(preco, /taxaDoMeuNovoAnuncio\(\)/, "a taxa da faixa do dono vale para o simulador e o comparador");
  assert.doesNotMatch(preco, /LinhaComparativoAnuncio|TEXTO_REGRA_CURTO|aluguel \+ condo \+ consumoFixo/);
  assert.doesNotMatch(preco, /Você recebe o valor mensal direto/, "o dono recebe o total do mês, não só o valor mensal");
  assert.doesNotMatch(ler("../components/precos/comparativo-precos.tsx"), /LinhaComparativoAnuncio/);
});

test("E140: o comparador usa os meses recebidos (sem período fixo), conta aberta e o sugerido rotulado como equivalência", () => {
  const comp = semComentarios(ler("../components/precos/preco-sugerido.tsx"));
  assert.doesNotMatch(comp, /const MESES = /);
  assert.match(comp, /pelos mesmos \{periodo\}/);
  assert.match(comp, /é uma equivalência/);
  assert.match(comp, /data-testid="conta-airbnb"/);
  assert.match(comp, /data-testid="conta-viva"/);
  assert.doesNotMatch(comp, /valor total do contrato/, "a taxa é explicada pela base certa: valor mensal × meses");
});
