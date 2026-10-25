/* Roda: node --test src/lib/perfil/convite-foto.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deveMostrarConviteFoto, CONVITE_FOTO_TEXTO, CONVITE_FOTO_CANDIDATURA_TEXTO, CONVITE_FOTO_ANUNCIO_TEXTO } from "./convite-foto.ts";

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
test("convite da candidatura: diz que a foto só aparece depois do aceite e não promete verificação", () => {
  assert.match(CONVITE_FOTO_CANDIDATURA_TEXTO, /depois do aceite/);
  assert.doesNotMatch(CONVITE_FOTO_CANDIDATURA_TEXTO, /verific|obrigat/i);
});
test("convite do anúncio: opcional, fala do cartão do anfitrião e não promete verificação", () => {
  assert.match(CONVITE_FOTO_ANUNCIO_TEXTO, /Anúncios com foto do anfitrião passam mais confiança/);
  assert.doesNotMatch(CONVITE_FOTO_ANUNCIO_TEXTO, /verific|obrigat/i);
});
test("convite do anúncio nunca bloqueia: a revisão não condiciona publicar à foto", () => {
  const fonte = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/etapa-revisar.tsx", "utf8");
  assert.match(fonte, /<ConviteFotoCandidatura[^>]*CONVITE_FOTO_ANUNCIO_TEXTO/);
  assert.doesNotMatch(fonte, /podePublicar[^\n]*temFoto|temFoto[^\n]*podePublicar/);
});
