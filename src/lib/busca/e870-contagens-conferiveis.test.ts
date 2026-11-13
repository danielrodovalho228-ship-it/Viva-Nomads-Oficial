/*
  E870 (Phoenix RELATORIO-020, A-95/A-96): (1) as contagens do "Mais filtros" são facetadas (recalculam dentro da seleção
  corrente) sem aviso — com pets marcado, "trabalhar de casa" cai de 10 para 4 e ninguém diz que a base mudou; (2) sem tempo de
  rota (linha reta), "até 10 min de carro" não excluía ninguém e a tela não dizia por quê — o limite só tira quem, nem na
  velocidade máxima do modo, chegaria (a 80 km/h, 10 min = 13,3 km em linha reta) e o cartão só mostra a distância.
  Regra: o painel diz quando os números já contam com o que está marcado; com destino + "até N min" sem rota, a lista diz,
  em km, o que o limite faz e que o cartão mostra a distância em linha reta (não o tempo).
  Roda: node --test src/lib/busca/e870-contagens-conferiveis.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_CONTAGEM_FACETADA, alcanceSemRotaKm, textoLimiteSemRota } from "./contagens-conferiveis.ts";
import { foraDoTempoPelaReta } from "../rotas/tempo.ts";

test("o alcance em km é a mesma conta do filtro (velocidade máxima do modo × minutos)", () => {
  assert.equal(alcanceSemRotaKm("carro", 10), 13.3);
  assert.equal(alcanceSemRotaKm("a_pe", 15), 1.5);
  // Coerência com o filtro: 13,2 km fica, 13,4 km sai.
  assert.equal(foraDoTempoPelaReta(13_200, "carro", 10), false);
  assert.equal(foraDoTempoPelaReta(13_400, "carro", 10), true);
});

test("o texto diz o limite em km e que o cartão mostra a distância em linha reta", () => {
  const t = textoLimiteSemRota("carro", 10);
  assert.match(t, /10 min de carro/);
  assert.match(t, /13,3 km em linha reta/);
  assert.match(t, /80 km\/h/);
  assert.match(t, /distância em linha reta, não o tempo/);
  assert.match(textoLimiteSemRota("a_pe", 15), /15 min a pé.*1,5 km/);
});

test("o painel avisa quando as contagens já contam com o que está marcado", () => {
  assert.match(TEXTO_CONTAGEM_FACETADA, /já contam com os filtros marcados/);
  const painel = readFileSync(new URL("../../components/busca/painel-filtros-celular.tsx", import.meta.url), "utf8");
  assert.match(painel, /data-testid="painel-contagem-facetada"/);
  assert.match(painel, /contarFiltrosPainel\(rascunho\) > 0/);
  const cli = readFileSync(new URL("../../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");
  assert.match(cli, /data-testid="busca-limite-sem-rota"/);
  assert.match(cli, /textoLimiteSemRota\(estadoDestino\.modo, estadoDestino\.ate\)/);
});
