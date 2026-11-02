/*
  E399-C, pacote 3 — a FICHA do anúncio mostra a comparação do selo "Preço justo" (chave desligada em produção).
   - só quando o anúncio TEM o selo (o aviso de preço acima é só do dono, nunca público);
   - diz quanto o total por mês da Viva fica abaixo de 30 noites do mesmo imóvel no Airbnb e a data da consulta;
   - marca "valores simulados" enquanto a fonte é a simulada; nunca mostra o link nem o número do anúncio.
  Roda: node --test src/lib/comparador-airbnb/pacote3.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { comparacaoParaFicha, textoComparacaoFicha } from "./comparacao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const agora = new Date("2026-11-10T12:00:00Z");

test("ficha: só com selo; diferença = 30 noites − total da Viva; data da consulta; simulado marcado", () => {
  const base = { totalViva: 2500, total30: 2907, consultadoEm: "2026-11-08T12:00:00Z", conferencia: "confere" as const, fonte: "simulada" };
  assert.deepEqual(comparacaoParaFicha(base, agora), { totalAirbnb30: 2907, diferenca: 407, consultadoEm: "2026-11-08T12:00:00Z", simulado: true });
  assert.equal(comparacaoParaFicha({ ...base, fonte: "airroi" }, agora)?.simulado, false);
  // Sem selo (igual, acima, suspenso, sem link, diverge): nada na ficha.
  assert.equal(comparacaoParaFicha({ ...base, totalViva: 2907 }, agora), null);
  assert.equal(comparacaoParaFicha({ ...base, totalViva: 3500 }, agora), null);
  assert.equal(comparacaoParaFicha({ ...base, consultadoEm: "2026-10-20T12:00:00Z" }, agora), null);
  assert.equal(comparacaoParaFicha({ ...base, conferencia: "diverge" }, agora), null);
  assert.equal(comparacaoParaFicha(null, agora), null);
});

test("texto da ficha: valores em reais, data dd/mm e o aviso de simulação", () => {
  const t = textoComparacaoFicha({ totalAirbnb30: 2907, diferenca: 407, consultadoEm: "2026-11-08T12:00:00Z", simulado: true });
  assert.match(t.principal, /R\$\s?407,00 a menos que 30 noites do mesmo imóvel no Airbnb/);
  assert.match(t.detalhe, /30 noites no Airbnb: R\$\s?2\.907,00/);
  assert.match(t.detalhe, /consulta de 08\/11/);
  assert.equal(t.simulado, "Valores simulados enquanto a consulta real não está ligada.");
  assert.equal(textoComparacaoFicha({ totalAirbnb30: 2907, diferenca: 407, consultadoEm: "2026-11-08T12:00:00Z", simulado: false }).simulado, null);
});

test("tela e dados: a ficha mostra o bloco só com a comparação; a leitura pública não traz o número do anúncio", () => {
  const ficha = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.match(ficha, /\{property\.precoJusto && property\.comparacaoAirbnb && <ComparacaoAirbnbFicha comparacao=\{property\.comparacaoAirbnb\} \/>\}/);
  const dados = ler("src/lib/data/properties.ts");
  assert.match(dados, /p\.comparacaoAirbnb = comparacaoParaFicha\(/);
  assert.doesNotMatch(dados, /airbnb_id|linkAirbnb/);
  const bloco = ler("src/components/precos/comparacao-airbnb-ficha.tsx");
  assert.match(bloco, /data-testid="ficha-comparacao-airbnb"/);
  assert.doesNotMatch(bloco, /airbnbId|airbnb\.com/);
});
