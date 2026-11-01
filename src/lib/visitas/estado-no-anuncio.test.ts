import test from "node:test";
import assert from "node:assert/strict";
import { estadosDaVisitaNoAnuncio } from "../visitas-video.ts";

const agora = new Date("2026-11-01T12:00:00Z");

test("varredura 01/11 — estado da visita no anúncio, por modalidade", () => {
  assert.deepEqual(estadosDaVisitaNoAnuncio([], agora), {});
  assert.deepEqual(estadosDaVisitaNoAnuncio([{ modalidade: "video", status: "pedido", horarioConfirmado: null }], agora), { video: "pedida" });
  assert.deepEqual(estadosDaVisitaNoAnuncio([{ modalidade: "presencial", status: "remarcar", horarioConfirmado: null }], agora), { presencial: "pedida" });
  assert.deepEqual(estadosDaVisitaNoAnuncio([{ modalidade: "video", status: "confirmado", horarioConfirmado: "2026-11-03T17:00:00Z" }], agora), { video: "agendada" });
  // Confirmada e já passada: o banco ainda conta como em aberto (não pode pedir outra) → "Ver minha visita".
  assert.deepEqual(estadosDaVisitaNoAnuncio([{ modalidade: "video", status: "confirmado", horarioConfirmado: "2026-10-30T17:00:00Z" }], agora), { video: "ver" });
  // Feita ou cancelada: livre para pedir outra.
  assert.deepEqual(estadosDaVisitaNoAnuncio([{ modalidade: "video", status: "cancelado", horarioConfirmado: null }, { modalidade: "video", status: "feito", horarioConfirmado: null }], agora), {});
  // As duas modalidades são independentes.
  assert.deepEqual(
    estadosDaVisitaNoAnuncio([{ modalidade: "video", status: "pedido", horarioConfirmado: null }, { modalidade: "presencial", status: "confirmado", horarioConfirmado: "2026-11-02T13:00:00Z" }], agora),
    { video: "pedida", presencial: "agendada" },
  );
});
