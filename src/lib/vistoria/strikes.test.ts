/*
  Prompt 62-B2 — escada de strikes do proprietário (59.1 item 7). PURO.
  Roda: node --test src/lib/vistoria/strikes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  consequencias,
  degrauDoProprietario,
  expiraEm,
  geraStrike,
  imovelComStrike,
  proximaOrdem,
  strikesParaApagar,
  strikesVigentes,
  type Strike,
} from "./strikes.ts";

const AGORA = new Date("2026-10-23T12:00:00Z");
const st = (propertyId: string, criadoEm = "2026-06-01T12:00:00Z", extra: Partial<Strike> = {}): Strike => ({
  propertyId,
  ordem: 1,
  criadoEm,
  suspenso: false,
  expiraEm: expiraEm(criadoEm),
  ...extra,
});

test("1ª avaliação pedida pelo dono nunca gera strike; só verificação reprovada ou ressalva vencida", () => {
  assert.equal(geraStrike({ origem: "verificacao_reprovada", primeiraPedidaPeloDono: true }), false);
  assert.equal(geraStrike({ origem: "ressalva_vencida", primeiraPedidaPeloDono: true }), false);
  assert.equal(geraStrike({ origem: "avaliacao_pedida", primeiraPedidaPeloDono: false }), false);
  assert.equal(geraStrike({ origem: "seguranca_grave", primeiraPedidaPeloDono: false }), false); // fora da contagem
  assert.equal(geraStrike({ origem: "verificacao_reprovada", primeiraPedidaPeloDono: false }), true);
  assert.equal(geraStrike({ origem: "ressalva_vencida", primeiraPedidaPeloDono: false }), true);
});

test("escada 1/2/3 (carteira pequena) e consequências", () => {
  const base = { carteira: 3, imoveisReprovados12m: 0, agora: AGORA };
  assert.equal(degrauDoProprietario({ ...base, strikes: [] }), 0);
  assert.equal(degrauDoProprietario({ ...base, strikes: [st("a")] }), 1);
  assert.equal(degrauDoProprietario({ ...base, strikes: [st("a"), st("b")] }), 2);
  assert.equal(degrauDoProprietario({ ...base, strikes: [st("a"), st("b"), st("a")] }), 3);
  assert.equal(proximaOrdem(0), 1);
  assert.equal(proximaOrdem(2), 3);
  assert.equal(proximaOrdem(3), 3);
  assert.deepEqual(consequencias(1), { perdeVistoriado: true, avisoFormal: false, republicarSoComLaudo: false, todosForaDaBusca: false });
  assert.deepEqual(consequencias(2), { perdeVistoriado: true, avisoFormal: true, republicarSoComLaudo: true, todosForaDaBusca: false });
  assert.equal(consequencias(3).todosForaDaBusca, true);
  assert.equal(consequencias(0).perdeVistoriado, false);
});

test("carteira 10+: 3º passo só com 3 no MESMO imóvel OU reprovações em 20% da carteira", () => {
  const base = { carteira: 20, imoveisReprovados12m: 3, agora: AGORA };
  // 3 strikes em imóveis diferentes, reprovações em 15%: fica no 2º passo.
  assert.equal(degrauDoProprietario({ ...base, strikes: [st("a"), st("b"), st("c")] }), 2);
  // 3 no mesmo imóvel: 3º passo.
  assert.equal(degrauDoProprietario({ ...base, strikes: [st("a"), st("a"), st("a")] }), 3);
  // 20% da carteira (4 de 20) reprovados em 12 meses: 3º passo.
  assert.equal(degrauDoProprietario({ ...base, imoveisReprovados12m: 4, strikes: [st("a")] }), 3);
  // Sem strike vigente, nada (a reprovação sozinha não é strike).
  assert.equal(degrauDoProprietario({ ...base, imoveisReprovados12m: 10, strikes: [] }), 0);
});

test("strike contestado fica suspenso (não conta, não aparece)", () => {
  const s = [st("a"), st("b", undefined, { suspenso: true })];
  assert.equal(strikesVigentes(s, AGORA).length, 1);
  assert.equal(degrauDoProprietario({ strikes: s, carteira: 2, imoveisReprovados12m: 0, agora: AGORA }), 1);
  assert.equal(imovelComStrike(s, "b", AGORA), false);
  assert.equal(imovelComStrike(s, "a", AGORA), true);
});

test("strikes expiram e são apagados em 12 meses", () => {
  const velho = st("a", "2025-10-23T12:00:00Z");
  assert.equal(velho.expiraEm, "2026-10-23T12:00:00.000Z");
  assert.deepEqual(strikesVigentes([velho], AGORA), []);
  assert.deepEqual(strikesParaApagar([velho, st("b")], AGORA), [velho]);
  assert.equal(degrauDoProprietario({ strikes: [velho], carteira: 1, imoveisReprovados12m: 0, agora: AGORA }), 0);
});
