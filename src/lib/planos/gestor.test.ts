/**
 * Testes da conta de administradora e da taxa por carteira (antes: da elegibilidade do plano Gestor, regra 1 da escada de planos).
 *
 * Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): o Plano Gestor de 4% deixou de ser oferta pública, e as funções de
 * elegibilidade (gestorElegivel, faltamParaGestor, GESTOR_MIN_IMOVEIS_VALIDADOS) saíram de ./gestor.ts. Os quatro casos foram
 * reescritos para cobrar o comportamento que ficou no lugar: administradora paga a faixa dos imóveis que tem; 20 ou mais imóveis
 * pagam a última faixa (6%), sem degrau em 20; condição abaixo da escada só pela taxa fixada pelo admin; e o "quanto falta" é o da
 * próxima faixa da escada (proximaFaixa).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as gestor from "./gestor.ts";
import { CARTEIRAS_MINIMO_IMOVEIS } from "../../config/planos.ts";
import { faixaPorImoveisAtivos, proximaFaixa, taxaNaAssinatura } from "../cobranca/regra.ts";

const em = new Date("2026-11-16T12:00:00Z");
const DIA = 86_400_000;

test("account_type='gestor' (administradora) → paga a faixa dos imóveis que tem, não 4% (078: não é mais 'elegível ao Gestor')", () => {
  // 078 (Daniel, 16/11/2026): antes gestorElegivel({ accountType: "gestor", imoveisValidados: 0 }) === true (4% com qualquer carteira).
  // A elegibilidade saiu; o tipo da conta não escolhe faixa — mesmo que alguém mande `administradora`, a regra ignora.
  assert.equal("gestorElegivel" in gestor, false);
  const administradora = (imoveisAtivos: number) => taxaNaAssinatura({ ...{ administradora: true }, tipo: "novo" as const, imoveisAtivos, assinadoEm: em });
  assert.deepEqual([administradora(0).taxa, administradora(0).origem], [0.12, "faixa"]);
  assert.deepEqual([administradora(1).taxa, administradora(1).origem], [0.12, "faixa"]);
  assert.deepEqual([administradora(3).taxa, administradora(3).origem], [0.1, "faixa"]);
  for (const n of [0, 1, 3, 10, 16, 40]) assert.equal(administradora(n).taxa, taxaNaAssinatura({ tipo: "novo", imoveisAtivos: n, assinadoEm: em }).taxa, `${n} imóveis`);
  assert.equal(gestor.ROTULO_TIPO_CONTA.gestor, "administradora", "o tipo de conta fica (só identifica)");
});

test("20+ imóveis ativos → a última faixa da escada (6%), a mesma de 16 a 19; menos → a faixa de cada um (078: sem degrau em 20)", () => {
  // 078 (Daniel, 16/11/2026): antes GESTOR_MIN_IMOVEIS_VALIDADOS === 20 (o limiar do Gestor); o 20 que ficou é o mínimo das carteiras
  // ("fale com a Viva"), que não muda a taxa.
  assert.equal("GESTOR_MIN_IMOVEIS_VALIDADOS" in gestor, false);
  assert.equal(CARTEIRAS_MINIMO_IMOVEIS, 20);
  // 078 (Daniel, 16/11/2026): antes gestorElegivel com 20 e 25 imóveis === true (4%); agora 6%, a última faixa.
  assert.equal(faixaPorImoveisAtivos(20).taxa, 0.06);
  assert.equal(faixaPorImoveisAtivos(25).taxa, 0.06);
  // 078 (Daniel, 16/11/2026): antes 19 imóveis === não elegível (ficava nos 6%, abaixo do Gestor); 19 e 20 pagam a MESMA taxa.
  assert.equal(faixaPorImoveisAtivos(19).taxa, 0.06);
  assert.equal(faixaPorImoveisAtivos(19), faixaPorImoveisAtivos(20));
  // 078 (Daniel, 16/11/2026): antes 5 e 0 imóveis === não elegível; cada um paga a sua faixa.
  assert.equal(faixaPorImoveisAtivos(5).taxa, 0.1);
  assert.equal(faixaPorImoveisAtivos(0).taxa, 0.12);
});

test("conta comum com 3 imóveis NÃO tem taxa abaixo da escada; só a taxa fixada pelo admin, com motivo e validade, dá condição especial (barreira)", () => {
  // 078 (Daniel, 16/11/2026): antes gestorElegivel({ accountType: null, imoveisValidados: 3 }) === false. A barreira agora é a da regra:
  // 3 imóveis = 10%, e os 4% só existem como taxa fixada pelo admin (válida, com motivo); sem motivo ou vencida, volta a faixa.
  const comum = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: em });
  assert.deepEqual([comum.taxa, comum.origem], [0.1, "faixa"]);
  const fixada = { taxa: 0.04, motivo: "Condição combinada com a Viva", validoAte: new Date(em.getTime() + 30 * DIA) };
  const combinada = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: em, fixadaPeloAdmin: fixada });
  assert.deepEqual([combinada.taxa, combinada.origem], [0.04, "admin"]);
  assert.equal(taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: em, fixadaPeloAdmin: { ...fixada, motivo: " " } }).taxa, 0.1);
  assert.equal(taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: em, fixadaPeloAdmin: { ...fixada, validoAte: new Date(em.getTime() - DIA) } }).taxa, 0.1);
});

test("o que resta até a próxima faixa (078: no lugar de faltamParaGestor, que contava até o limiar do Gestor)", () => {
  // 078 (Daniel, 16/11/2026): antes faltamParaGestor(0) === 20, (3) === 17, (20) === 0, (30) === 0 — a meta era o Plano Gestor. A meta
  // que existe é a próxima faixa da escada; na última (16 ou mais) não há próxima — nem aos 20, nem aos 30.
  assert.equal("faltamParaGestor" in gestor, false);
  assert.deepEqual(proximaFaixa(0), { faltam: 2, taxa: 0.1 });
  assert.deepEqual(proximaFaixa(3), { faltam: 3, taxa: 0.08 });
  assert.deepEqual(proximaFaixa(15), { faltam: 1, taxa: 0.06 });
  assert.equal(proximaFaixa(16), null);
  assert.equal(proximaFaixa(20), null);
  assert.equal(proximaFaixa(30), null);
});
