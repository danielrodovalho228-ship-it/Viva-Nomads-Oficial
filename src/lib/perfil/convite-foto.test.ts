/* Roda: node --test src/lib/perfil/convite-foto.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deveMostrarConviteFoto, CONVITE_FOTO_TEXTO } from "./convite-foto.ts";

const AGORA = Date.parse("2026-10-22T12:00:00Z");
const diasAtras = (n: number) => String(AGORA - n * 24 * 60 * 60 * 1000);

test("sem foto e nunca dispensado: mostra", () => {
  assert.equal(deveMostrarConviteFoto({ temFoto: false, dispensadoEm: null, agora: AGORA }), true);
});
test("com foto: some, mesmo nunca dispensado (caso negativo)", () => {
  assert.equal(deveMostrarConviteFoto({ temFoto: true, dispensadoEm: null, agora: AGORA }), false);
});
test("dispensado há 3 dias: continua escondido; há 7 dias: volta", () => {
  assert.equal(deveMostrarConviteFoto({ temFoto: false, dispensadoEm: diasAtras(3), agora: AGORA }), false);
  assert.equal(deveMostrarConviteFoto({ temFoto: false, dispensadoEm: diasAtras(7), agora: AGORA }), true);
});
test("aceita data ISO; valor inválido ou no futuro não esconde para sempre", () => {
  assert.equal(deveMostrarConviteFoto({ temFoto: false, dispensadoEm: "2026-10-21T12:00:00Z", agora: AGORA }), false);
  assert.equal(deveMostrarConviteFoto({ temFoto: false, dispensadoEm: "lixo", agora: AGORA }), true);
  assert.equal(deveMostrarConviteFoto({ temFoto: false, dispensadoEm: String(AGORA + 9e9), agora: AGORA }), true);
});
test("texto do convite não promete verificação", () => {
  assert.match(CONVITE_FOTO_TEXTO, /passam mais confiança/);
  assert.doesNotMatch(CONVITE_FOTO_TEXTO, /verific/i);
});
