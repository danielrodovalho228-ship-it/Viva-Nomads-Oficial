/*
  Visita PEDIDA com todos os horários já passados aparece como "Expirada". A tela nunca cancela sozinha; E205-B (msg 65
  do coordenador): o cron e a abertura da lista gravam "cancelado" com o motivo "expirou" e avisam os dois lados — o
  cartão continua dizendo "Expirada".
  Roda: node --test src/lib/visitas/visita-expirada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULO_EXPIRADA, horariosAindaValidos, visitaExpirada } from "./endereco-visita.ts";

const agora = new Date("2026-10-28T15:00:00Z");
const passados = ["2026-10-21T13:00:00Z", "2026-10-22T13:00:00Z"];

test("pedida com todos os horários passados: Expirada", () => {
  assert.equal(ROTULO_EXPIRADA, "Expirada");
  assert.equal(visitaExpirada({ status: "pedido", horarios: passados }, agora), true);
});

test("pedida com algum horário ainda por vir: segue Pedida; os outros estados não expiram", () => {
  assert.equal(visitaExpirada({ status: "pedido", horarios: [...passados, "2026-10-30T13:00:00Z"] }, agora), false);
  assert.equal(visitaExpirada({ status: "pedido", horarios: [] }, agora), false);
  for (const status of ["confirmado", "remarcar", "cancelado", "feito"]) assert.equal(visitaExpirada({ status, horarios: passados }, agora), false);
});

test("o dono só vê para confirmar os horários que ainda não passaram", () => {
  assert.deepEqual(horariosAindaValidos([...passados, "2026-10-30T13:00:00Z"], agora), ["2026-10-30T13:00:00Z"]);
  assert.deepEqual(horariosAindaValidos(["2026-10-28T15:00:00Z", "lixo"], agora), []);
});

test("cartão: etiqueta Expirada e aviso; a tela não cancela sozinha; dono propõe outro horário, sem confirmar o que passou", () => {
  const tela = readFileSync(new URL("../../components/visitas/cartao-visita.tsx", import.meta.url), "utf8");
  assert.match(tela, /expirada \? ROTULO_EXPIRADA/);
  assert.match(tela, /data-testid="visita-expirada-aviso"/);
  assert.match(tela, /validos\.map\(\(h\) =>/);
  assert.match(tela, /validos\.length === 0 \? null : \(\s*<Button[^>]*data-testid="visita-confirmar"/);
  // O morador ainda pode cancelar (a expirada não some sozinha) e nenhuma ação automática é chamada.
  assert.doesNotMatch(tela, /expirada[^\n]*rodar\(\{ acao: "cancelar"/);
  const acoes = readFileSync(new URL("../data/visitas-video-actions.ts", import.meta.url), "utf8");
  assert.doesNotMatch(acoes, /visitaExpirada/);
});

test("E205-B: cancelado com o motivo \"expirou\" segue Expirada no cartão, sem a linha Motivo", () => {
  const tela = readFileSync(new URL("../../components/visitas/cartao-visita.tsx", import.meta.url), "utf8");
  assert.match(tela, /expiradaGravada = status === "cancelado" && v\.motivoRecusa === MOTIVO_EXPIROU/);
  assert.match(tela, /v\.motivoRecusa && !expiradaGravada/);
  assert.match(tela, /O pedido expirou sem resposta\. Peça outros horários\./);
});
