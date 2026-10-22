/*
  Internet medida no imóvel (Prompt 57).
  Roda: node --test src/lib/internet-medida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { INTERNET } from "../config/internet.ts";
import {
  boaParaVideochamada,
  dentroDoLimite,
  homeOfficeMedido,
  horaDeAvisarRemedicao,
  juntarRodadas,
  mediana,
  rodadaValida,
  sinalMorador,
  textoInternet,
  validarLocal,
  validoAte,
  vigente,
} from "./internet-medida.ts";

const imovel = { lat: -18.9186, lng: -48.2772 };
// ~0,0009° de latitude ≈ 100 m; 0,0036° ≈ 400 m.
const perto = { lat: -18.9177, lng: -48.2772 };
const longe = { lat: -18.915, lng: -48.2772 };

test("mediana das 2 rodadas (média dos dois) e de 3", () => {
  assert.equal(mediana([300, 340]), 320);
  assert.equal(mediana([10, 50, 20]), 20);
  assert.deepEqual(juntarRodadas([{ downloadMbps: 300, uploadMbps: 40, latenciaMs: 12 }, { downloadMbps: 356, uploadMbps: 44, latenciaMs: 14 }]), {
    downloadMbps: 328,
    uploadMbps: 42,
    latenciaMs: 13,
  });
  assert.equal(juntarRodadas([]), null);
});

test("resultado do navegador: só números positivos e plausíveis", () => {
  assert.ok(rodadaValida({ downloadMbps: 328, uploadMbps: 42, latenciaMs: 12 }));
  assert.ok(!rodadaValida({ downloadMbps: 0, uploadMbps: 42, latenciaMs: 12 }));
  assert.ok(!rodadaValida({ downloadMbps: 1e9, uploadMbps: 42, latenciaMs: 12 }));
  assert.ok(!rodadaValida({ downloadMbps: "328", uploadMbps: 42, latenciaMs: 12 }));
});

test("distância ≤ 300 m valida; > 300 m, sem permissão e sem confirmar o Wi-Fi não validam; nunca guarda a coordenada", () => {
  const ok = validarLocal(perto, imovel, true);
  assert.equal(ok.validada, true);
  assert.ok(ok.distanciaM! <= INTERNET.raioValidacaoM);
  assert.deepEqual(Object.keys(ok).sort(), ["distanciaM", "motivo", "validada"]);
  assert.deepEqual(validarLocal(longe, imovel, true).motivo, "longe");
  assert.equal(validarLocal(longe, imovel, true).validada, false);
  assert.deepEqual(validarLocal(null, imovel, true), { validada: false, distanciaM: null, motivo: "sem_permissao" });
  assert.equal(validarLocal(perto, imovel, false).motivo, "sem_confirmacao_wifi");
  assert.equal(validarLocal(perto, null, true).motivo, "sem_coordenadas_imovel");
});

test("validade de 6 meses; aviso a partir de ~5,5 meses", () => {
  assert.equal(validoAte(new Date("2026-10-22T15:00:00Z")).toISOString(), "2027-04-22T15:00:00.000Z");
  assert.equal(validoAte(new Date("2026-08-31T12:00:00Z")).toISOString().slice(0, 10), "2027-02-28");
  const m = { medidoEm: "2026-10-22T15:00:00Z", validoAte: "2027-04-22T15:00:00Z" };
  assert.ok(vigente(m, new Date("2027-04-22T14:59:00Z")));
  assert.ok(!vigente(m, new Date("2027-04-22T15:00:01Z")));
  assert.ok(!horaDeAvisarRemedicao(m, new Date("2027-03-22T15:00:00Z")));
  assert.ok(horaDeAvisarRemedicao(m, new Date("2027-04-08T15:00:00Z")));
  assert.ok(!horaDeAvisarRemedicao(m, new Date("2027-04-23T15:00:00Z")), "vencida não avisa mais");
});

test("regra de videochamada pela constante", () => {
  const { downloadMin, uploadMin, latenciaMax } = INTERNET.videochamada;
  assert.ok(boaParaVideochamada({ downloadMbps: downloadMin, uploadMbps: uploadMin, latenciaMs: latenciaMax }));
  assert.ok(!boaParaVideochamada({ downloadMbps: downloadMin - 0.1, uploadMbps: 50, latenciaMs: 10 }));
  assert.ok(!boaParaVideochamada({ downloadMbps: 300, uploadMbps: uploadMin - 0.1, latenciaMs: 10 }));
  assert.ok(!boaParaVideochamada({ downloadMbps: 300, uploadMbps: 50, latenciaMs: latenciaMax + 1 }));
  assert.ok(!boaParaVideochamada(null));
});

test("sinal do morador abaixo de 50% da medição do dono", () => {
  const dono = { downloadMbps: 300, uploadMbps: 40, latenciaMs: 12 };
  assert.ok(!sinalMorador(dono, { downloadMbps: 150, uploadMbps: 20, latenciaMs: 20 }));
  assert.ok(sinalMorador(dono, { downloadMbps: 149, uploadMbps: 30, latenciaMs: 20 }));
  assert.ok(sinalMorador(dono, { downloadMbps: 290, uploadMbps: 19, latenciaMs: 20 }));
  assert.ok(!sinalMorador(null, { downloadMbps: 1, uploadMbps: 1, latenciaMs: 1 }));
});

test("limite de 6 medições por imóvel por dia", () => {
  assert.ok(dentroDoLimite(5));
  assert.ok(!dentroDoLimite(6));
});

test("página do imóvel: medida, informada (não medida) ou nada; capacidade só com medição válida", () => {
  const agora = new Date("2026-10-23T12:00:00Z");
  const medida = { downloadMbps: 328, uploadMbps: 42, latenciaMs: 12, medidoEm: "2026-10-22T15:00:00Z", validoAte: "2027-04-22T15:00:00Z" };
  const t = textoInternet(medida, 300, agora)!;
  assert.equal(t.tipo, "medida");
  assert.equal(t.texto, "Internet medida no imóvel: 328 Mbps para baixar · 42 para enviar · 12 ms — medida em 22/10/2026");
  assert.equal(t.videochamada, "Boa para videochamadas");
  assert.deepEqual(textoInternet(null, 300, agora), { tipo: "informada", texto: "Internet informada pelo proprietário: 300 Mbps (não medida)", videochamada: null });
  assert.equal(textoInternet(null, null, agora), null);
  // Vencida: volta ao informado, sem capacidade.
  assert.equal(textoInternet(medida, 300, new Date("2027-05-01T00:00:00Z"))!.tipo, "informada");
  // Medida que não passa a regra: número sim, capacidade não.
  assert.equal(textoInternet({ ...medida, uploadMbps: 2 }, null, agora)!.videochamada, null);
});

test("etiqueta medida: 4 essenciais + medição vigente que passa a regra", () => {
  const agora = new Date("2026-10-23T12:00:00Z");
  const medida = { downloadMbps: 328, uploadMbps: 42, latenciaMs: 12, medidoEm: "2026-10-22T15:00:00Z", validoAte: "2027-04-22T15:00:00Z" };
  assert.ok(homeOfficeMedido(true, medida, agora));
  assert.ok(!homeOfficeMedido(false, medida, agora));
  assert.ok(!homeOfficeMedido(true, null, agora));
  assert.ok(!homeOfficeMedido(true, { ...medida, latenciaMs: 200 }, agora));
});
