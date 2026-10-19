import { test } from "node:test";
import assert from "node:assert/strict";
import { avaliarTentativaLogin, type Limitar, type SituacaoLimite } from "./limite-login.ts";

/** Limitador em memória com a mesma semântica do banco: conta por chave e estoura acima do máximo. */
function memoria(): Limitar {
  const n = new Map<string, number>();
  return async (chave, maximo) => {
    const v = (n.get(chave) ?? 0) + 1;
    n.set(chave, v);
    return v > maximo ? "estourou" : "ok";
  };
}

test("até 5 tentativas por minuto passam; a 6ª leva espera de 60 s", async () => {
  const l = memoria();
  for (let i = 0; i < 5; i++) assert.equal((await avaliarTentativaLogin("a", "ip", l)).permitido, true);
  const r = await avaliarTentativaLogin("a", "ip", l);
  assert.deepEqual(r, { permitido: false, esperaSegundos: 60 });
});

test("o atraso cresce: passou de 10 tentativas → 10 min; de 20 → 1 h", async () => {
  const l = memoria();
  let r = { permitido: true, esperaSegundos: 0 };
  for (let i = 0; i < 11; i++) r = await avaliarTentativaLogin("b", "ip", l);
  assert.equal(r.esperaSegundos, 600);
  for (let i = 0; i < 10; i++) r = await avaliarTentativaLogin("b", "ip", l);
  assert.equal(r.esperaSegundos, 3600);
});

test("outro e-mail não é afetado (caso negativo)", async () => {
  const l = memoria();
  for (let i = 0; i < 8; i++) await avaliarTentativaLogin("c", "ip1", l);
  assert.equal((await avaliarTentativaLogin("d", "ip2", l)).permitido, true);
});

test("limitador fora do ar não tranca ninguém", async () => {
  const caido: Limitar = async (): Promise<SituacaoLimite> => "erro";
  assert.equal((await avaliarTentativaLogin("e", "ip", caido)).permitido, true);
});

test("muitas tentativas do mesmo IP também travam", async () => {
  const l = memoria();
  let r = { permitido: true, esperaSegundos: 0 };
  for (let i = 0; i < 41; i++) r = await avaliarTentativaLogin(`x${i}`, "mesmo-ip", l);
  assert.deepEqual(r, { permitido: false, esperaSegundos: 900 });
});
