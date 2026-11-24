/*
  E1039 (ORDEM-DUET-213, peça 36 da Pista 3): a confirmação da visita tem de trazer o que a véspera traria
  (condição do coordenador). Comparando destinatário a destinatário com vesperaTexto (emails-e205b.ts):
  1. Dono, presencial (o morador aceitou o horário): a véspera diz COM QUEM é a visita ("a visita presencial com Ana" +
     linha "Morador: Ana"); a confirmação não dizia.
  2. Por vídeo (qualquer dos dois): a véspera diz COMO ENTRAR ("Na hora, entre pela página da visita na plataforma.");
     a confirmação só dizia "Os detalhes ficam em Visitas".
  (Morador, presencial: a confirmação já leva o endereço e "Abrir no mapa" — avisarVisita; sem lacuna.)
  Roda: node --test src/lib/visitas/e1039-confirmacao-como-vespera.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpoVisitaConfirmada } from "./emails-visita.ts";
import { vesperaTexto } from "../notifications/emails-e205b.ts";

const IMOVEL = { id: "3f9a2c11-0000-4000-8000-000000000001", titulo: "Apto Santa Mônica" };
const H = "2026-11-05T13:00:00Z";

test("E1039 — ao dono, presencial: a confirmação diz com quem é a visita, como a véspera", () => {
  const vespera = vesperaTexto({ modalidade: "presencial", paraMorador: false, horario: "05/11 10:00", imovel: IMOVEL.titulo, nomeMorador: "Ana Souza" });
  assert.ok(vespera.linhas.some((l) => l.rotulo === "Morador" && l.valor === "Ana"), "a véspera traz o morador");
  const c = corpoVisitaConfirmada({ imovel: IMOVEL, modalidade: "presencial", horario: H, quemConfirmou: "morador", nomeMorador: "Ana Souza" });
  assert.deepEqual(c.linhas.find((l) => l.rotulo === "Morador"), { rotulo: "Morador", valor: "Ana" });
  assert.match(c.body("Daniel"), /^Olá Daniel, o interessado confirmou a visita presencial com Ana a Apto Santa Mônica/);
  // só o primeiro nome (E328), nunca o sobrenome
  assert.doesNotMatch(JSON.stringify(c.linhas) + c.body("Daniel"), /Souza/);
});

test("E1039 — por vídeo: a confirmação diz como entrar na chamada, como a véspera", () => {
  const vespera = vesperaTexto({ modalidade: "video", paraMorador: true, horario: "05/11 10:00", imovel: IMOVEL.titulo });
  assert.match(vespera.abertura("Lara"), /Na hora, entre pela página da visita na plataforma\./);
  for (const quemConfirmou of ["proprietario", "morador"] as const) {
    const c = corpoVisitaConfirmada({ imovel: IMOVEL, modalidade: "video", horario: H, quemConfirmou });
    assert.match(c.body("Lara"), /Na hora, entre pela página da visita na plataforma\./, quemConfirmou);
  }
});

test("E1039 — o que já estava igual continua: morador presencial sem linha de morador; sem nome, nada inventado", () => {
  const aoMorador = corpoVisitaConfirmada({ imovel: IMOVEL, modalidade: "presencial", horario: H, quemConfirmou: "proprietario", nomeMorador: "Ana Souza" });
  assert.equal(aoMorador.linhas.some((l) => l.rotulo === "Morador"), false, "o morador não recebe o próprio nome");
  const semNome = corpoVisitaConfirmada({ imovel: IMOVEL, modalidade: "presencial", horario: H, quemConfirmou: "morador" });
  assert.equal(semNome.linhas.some((l) => l.rotulo === "Morador"), false);
  assert.match(semNome.body("Daniel"), /^Olá Daniel, o interessado confirmou a visita presencial a Apto Santa Mônica/);
});

test("E1039 — o servidor passa o nome do morador à confirmação", () => {
  const src = readFileSync(new URL("../data/visitas-video-actions.ts", import.meta.url), "utf8");
  const trecho = src.slice(src.indexOf("corpoVisitaConfirmada({"), src.indexOf("corpoVisitaConfirmada({") + 600);
  assert.match(trecho, /nomeMorador:/);
});
