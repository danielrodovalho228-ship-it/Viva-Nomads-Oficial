import { test } from "node:test";
import assert from "node:assert/strict";
import { AVISO_DESCER_PLANO, ficaAcimaDoLimite } from "./descer-plano.ts";

test("acima do limite: avisa; dentro, no limite ou ilimitado: não avisa", () => {
  assert.equal(ficaAcimaDoLimite(6, 1), true);
  assert.equal(ficaAcimaDoLimite(2, 1), true);
  assert.equal(ficaAcimaDoLimite(1, 1), false);
  assert.equal(ficaAcimaDoLimite(0, 1), false);
  assert.equal(ficaAcimaDoLimite(50, Infinity), false);
  assert.equal(ficaAcimaDoLimite(50, null), false);
  assert.equal(ficaAcimaDoLimite(50, undefined), false);
});

test("texto do aviso é o combinado pelo Daniel", () => {
  assert.equal(
    AVISO_DESCER_PLANO,
    "Seus anúncios acima do limite do novo plano continuam no ar, mas você não poderá publicar novos até ficar dentro do limite."
  );
});
