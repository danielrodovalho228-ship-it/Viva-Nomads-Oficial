import { test } from "node:test";
import assert from "node:assert/strict";
import { corteRetencaoPushEnvios, resumoDoPush } from "./diagnostico-push.ts";

const agora = new Date("2026-10-23T12:00:00Z");
const dia = (n: number) => new Date(agora.getTime() - n * 86_400_000).toISOString();

test("aparelhos por plataforma, sem as contas de teste", () => {
  const r = resumoDoPush({
    aparelhos: [
      { user_id: "a", platform: "android" },
      { user_id: "a", platform: "ios" },
      { user_id: "b", platform: "android" },
      { user_id: "qa", platform: "android" },
      { user_id: "c", platform: "web" },
      { user_id: "d", platform: "outra" },
    ],
    envios: [],
    contasDeTeste: ["qa"],
    agora,
  });
  assert.deepEqual(r.aparelhos, { android: 2, ios: 1, web: 1 });
  assert.equal(r.totalAparelhos, 4);
  assert.equal(r.envios, 0);
  assert.equal(r.taxaFalha, null);
});

test("envios dos últimos 7 dias: entregues, falhas e tokens mortos; teste e antigos de fora", () => {
  const r = resumoDoPush({
    aparelhos: [],
    envios: [
      { user_id: "a", enviados: 2, falhas: 1, tokens_mortos: 1, criado_em: dia(1) },
      { user_id: null, enviados: 5, falhas: 0, tokens_mortos: 0, criado_em: dia(6.9) },
      { user_id: "qa", enviados: 1, falhas: 3, tokens_mortos: 3, criado_em: dia(1) },
      { user_id: "b", enviados: 1, falhas: 1, tokens_mortos: 0, criado_em: dia(8) },
      { user_id: "b", enviados: 0, falhas: 2, tokens_mortos: 2, criado_em: "data ruim" },
    ],
    contasDeTeste: new Set(["qa"]),
    agora,
  });
  assert.equal(r.envios, 2);
  assert.equal(r.entregues, 7);
  assert.equal(r.falhas, 1);
  assert.equal(r.tokensMortos, 1);
  assert.equal(r.taxaFalha, 13);
});

test("limpeza: corte em 30 dias", () => {
  assert.equal(corteRetencaoPushEnvios(agora), "2026-09-23T12:00:00.000Z");
});
