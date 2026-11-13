/*
  E842 (Phoenix RELATORIO-016, A-02): os cartões de /buscar e dos carrosséis diziam "Total por mês, tudo incluído", mas o IPTU fica
  à parte em TODOS os anúncios (a página diz "IPTU não incluso no total") e, com as contas medidas, a linha de baixo dizia "água,
  luz e gás medidos à parte, fora do total" — a mesma frase se contradizia. O rótulo agora diz o que o preço é sem prometer "tudo":
  "Total por mês · IPTU à parte"; a composição embaixo segue dizendo o que entra e o que fica fora.
  Roda: node --test src/lib/e842-cartao-sem-tudo-incluido.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULO_TOTAL_MES } from "./cartao-preco.ts";
import { composicaoDoMes } from "./cartao-estadia.ts";

test("o rótulo do cartão não promete 'tudo incluído' e avisa o IPTU, como a página do imóvel", () => {
  assert.doesNotMatch(ROTULO_TOTAL_MES, /tudo inclu/i);
  assert.match(ROTULO_TOTAL_MES, /IPTU à parte/);
  assert.match(readFileSync(new URL("../components/property/price-card.tsx", import.meta.url), "utf8"), /IPTU não incluso no total\./);
});

test("com as contas medidas, rótulo + composição não se contradizem (nada de 'tudo incluído' ao lado de 'fora do total')", () => {
  const p = { monthlyRent: 3200, condoFee: 480, utilitiesMode: "measured", utilitiesEstimate: 0 } as unknown as Parameters<typeof composicaoDoMes>[0];
  const frase = `${ROTULO_TOTAL_MES} ${composicaoDoMes(p)}`;
  assert.match(frase, /fora do total/);
  assert.doesNotMatch(frase, /tudo inclu/i);
});

test("o cartão desenha o rótulo da fonte única (sem texto solto)", () => {
  const cartao = readFileSync(new URL("../components/property-card.tsx", import.meta.url), "utf8");
  assert.match(cartao, /\{ROTULO_TOTAL_MES\}/);
  assert.doesNotMatch(cartao, /tudo incluído/);
});
