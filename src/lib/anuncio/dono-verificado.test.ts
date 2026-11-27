import test from "node:test";
import assert from "node:assert/strict";
import { seloDoDono, textoDoSeloDeIdentidade } from "./dono-verificado.ts";
import { estadoIdentidadeDe } from "../identidade/estado.ts";
import { readFileSync } from "node:fs";

/*
  Asserções alteradas (E1106, ORDEM-DUET-478): o selo "Dono verificado" lido de owner.verified (is_verified) saiu — o
  selo do dono vem só da fonte única da identidade (estadoIdentidade), onde a conferência da equipa é o estado
  `conferida_equipe`. Os casos de sempre continuam, agora pela fonte: com verificação real → selo; sem → nada;
  exemplo → nunca. A explicação "o que significa" saiu com o componente antigo.
*/
const AGORA = new Date("2026-10-19T12:00:00Z");
const real = (verified?: boolean) => ({ id: "ddf86c66-a214-463d-8563-66a5204010b5", owner: { name: "Ana", verified } });
const conferida = textoDoSeloDeIdentidade(estadoIdentidadeDe(null, false, AGORA, true));
const semNada = textoDoSeloDeIdentidade(estadoIdentidadeDe(null, false, AGORA));

test("verificação real registrada (pela fonte) mostra o selo", () => {
  assert.deepEqual(seloDoDono(real(true), conferida), { tipo: "identidade", texto: "Conferida pela equipe da Viva" });
});

test("sem verificação (pela fonte) não mostra o selo — e owner.verified sozinho já não conta", () => {
  assert.equal(seloDoDono(real(false), semNada), null);
  assert.equal(seloDoDono(real(true), semNada), null);
  assert.equal(seloDoDono({ id: "x" }, semNada), null);
  assert.equal(seloDoDono(null, conferida), null);
});

test("anúncio de exemplo nunca ostenta o selo, nem com verificação", () => {
  assert.equal(seloDoDono({ id: "ube-001" }, conferida), null);
});

test("dados de exemplo (properties.ts) não trazem owner.verified=true", () => {
  const src = readFileSync(new URL("../properties.ts", import.meta.url), "utf8");
  assert.ok(/owner: \{/.test(src));
  assert.doesNotMatch(src, /owner: \{[^}]*verified: true/);
});
