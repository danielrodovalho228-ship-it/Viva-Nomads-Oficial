/* Roda: node --test src/lib/visitas/horario-ocupado.test.ts — E500 + E547: duas visitas confirmadas no mesmo horário do mesmo imóvel. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_HORARIO_OCUPADO, horarioOcupado } from "./horario-ocupado.ts";

const H = "2026-11-03T13:00:00+00:00";

test("o 2º confirmar no mesmo instante do mesmo imóvel é recusado (o caso do QA: 03/11 10:00 de Brasília)", () => {
  const outras = [{ id: "a", status: "confirmado", horarioConfirmado: "2026-11-03 13:00:00+00" }];
  assert.equal(horarioOcupado(outras, "b", H), true);
  // Mesmo instante escrito em outro fuso também conta.
  assert.equal(horarioOcupado(outras, "b", "2026-11-03T10:00:00-03:00"), true);
});

test("não conta a própria visita, as que não estão confirmadas nem outro horário", () => {
  assert.equal(horarioOcupado([{ id: "a", status: "confirmado", horarioConfirmado: H }], "a", H), false);
  assert.equal(horarioOcupado([{ id: "a", status: "pedido", horarioConfirmado: null }], "b", H), false);
  assert.equal(horarioOcupado([{ id: "a", status: "cancelado", horarioConfirmado: H }], "b", H), false);
  assert.equal(horarioOcupado([{ id: "a", status: "confirmado", horarioConfirmado: "2026-11-03T14:00:00Z" }], "b", H), false);
  assert.equal(horarioOcupado([], "b", "lixo"), false);
});

test("servidor: responderVisita consulta as confirmadas do imóvel e recusa antes de gravar", () => {
  const s = readFileSync("src/lib/data/visitas-video-actions.ts", "utf8");
  const fn = s.slice(s.indexOf("export async function responderVisita"), s.indexOf("// E444: o dono respondeu"));
  const checa = fn.indexOf("horarioOcupado(");
  assert.ok(checa > 0, "responderVisita confere o horário ocupado");
  assert.ok(checa < fn.indexOf('.update(campos)'), "a conferência vem antes do update");
  assert.match(fn, /\.eq\("property_id", v\.property_id\)\s*\.eq\("status", "confirmado"\)/);
  assert.match(fn, /error: MSG_HORARIO_OCUPADO/);
  assert.equal(MSG_HORARIO_OCUPADO.includes("Proponha outro horário"), true);
});

test("lista do dono: diz quem vem depois da confirmação (dois moradores nunca viram dois cartões iguais)", () => {
  const s = readFileSync("src/lib/data/visitas-video-actions.ts", "utf8");
  const fn = s.slice(s.indexOf("export async function listVisitasDono"), s.indexOf("export async function listMinhasVisitas"));
  assert.match(fn, /nomeLiberadoNaVisita\(/);
  assert.match(fn, /pessoa:/);
});
