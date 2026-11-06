/* Roda: node --test src/lib/anuncio/carga-sessao.test.ts — E398 (resíduo): o cartão do anúncio não segura os botões à espera da conferência da sessão de quem já está logado. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aguardandoPerfilDeTeste, carregandoDasVisitas } from "./carga-sessao.ts";

test("E398: visitas — usuário conhecido espera só as visitas dele, não a conferência da sessão", () => {
  assert.equal(carregandoDasVisitas({ exemplo: false, authChecked: false, usuarioId: "u1", visitasPara: "u1" }), false, "logado, sessão ainda não conferida, visitas já chegaram");
  assert.equal(carregandoDasVisitas({ exemplo: false, authChecked: false, usuarioId: "u1", visitasPara: null }), true, "logado, visitas ainda não chegaram");
  assert.equal(carregandoDasVisitas({ exemplo: false, authChecked: true, usuarioId: "u1", visitasPara: "u2" }), true, "visitas são de outro usuário");
});

test("E398: visitas — sem usuário conhecido espera a conferência; exemplo nunca espera", () => {
  assert.equal(carregandoDasVisitas({ exemplo: false, authChecked: false, usuarioId: null, visitasPara: null }), true);
  assert.equal(carregandoDasVisitas({ exemplo: false, authChecked: true, usuarioId: null, visitasPara: null }), false);
  assert.equal(carregandoDasVisitas({ exemplo: true, authChecked: false, usuarioId: null, visitasPara: null }), false);
});

test("E398: anúncio de teste — com usuário espera só o perfil (is_teste); sem usuário, a conferência; fora do modo visitante, nada", () => {
  assert.equal(aguardandoPerfilDeTeste({ modoVisitante: true, authChecked: false, temUsuario: true, isTeste: true }), false);
  assert.equal(aguardandoPerfilDeTeste({ modoVisitante: true, authChecked: false, temUsuario: true, isTeste: undefined }), true);
  assert.equal(aguardandoPerfilDeTeste({ modoVisitante: true, authChecked: false, temUsuario: false, isTeste: undefined }), true);
  assert.equal(aguardandoPerfilDeTeste({ modoVisitante: true, authChecked: true, temUsuario: false, isTeste: undefined }), false);
  assert.equal(aguardandoPerfilDeTeste({ modoVisitante: false, authChecked: false, temUsuario: false, isTeste: undefined }), false);
});

test("E398: a página do anúncio usa as duas regras", () => {
  const d = readFileSync("src/app/(public)/imoveis/[id]/property-detail.tsx", "utf8");
  assert.match(d, /aguardandoPerfilDeTeste\(\{ modoVisitante: modoTeste === "visitante", authChecked, temUsuario: !!usuario, isTeste: usuario\?\.isTeste \}\)/);
  assert.match(d, /carregandoDasVisitas\(\{ exemplo, authChecked, usuarioId, visitasPara: visitasDe\.para \}\)/);
});
