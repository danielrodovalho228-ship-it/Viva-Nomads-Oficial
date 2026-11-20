/*
  E1039 — trava (ORDEM-DUET-217): o CONTEÚDO da mensagem de confirmação de visita, montado como sai no e-mail
  (corpo + bloco de dados + texto/HTML dos detalhes), por destinatário. Determinístico: sem banco, sem relógio.
  O que a véspera traz a cada um tem de estar na confirmação:
  - morador, presencial (o dono confirmou): horário, endereço exato e "Abrir no mapa";
  - dono, presencial (o morador aceitou): horário e com quem (só o primeiro nome — E328); endereço nunca;
  - por vídeo: horário e como entrar ("pela página da visita"); nem endereço nem link cru da chamada (E326).
  Roda: node --test src/lib/visitas/e1039-trava-mensagem-confirmacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { corpoVisitaConfirmada, detalhesDoAvisoVisita } from "./emails-visita.ts";

const IMOVEL = { id: "3f9a2c11-0000-4000-8000-000000000001", titulo: "Apto Santa Mônica" };
const H = "2026-11-05T13:00:00Z"; // 10:00 em Brasília
const QUANDO = "05/11/2026 às 10:00 (horário de Brasília)";
const ENDERECO = {
  texto: "Rua das Flores, 120, apto 31 · Santa Mônica · Florianópolis",
  mapa: "https://www.google.com/maps/search/?api=1&query=Rua%20das%20Flores%2C%20120",
};
const DETALHE = "Visita presencial confirmada para 05/11 10:00.";

function mensagem(o: { modalidade: "video" | "presencial"; quemConfirmou: "proprietario" | "morador"; endereco?: typeof ENDERECO | null }) {
  const corpo = corpoVisitaConfirmada({ imovel: IMOVEL, modalidade: o.modalidade, horario: H, quemConfirmou: o.quemConfirmou, nomeMorador: "Ana Souza" });
  const d = detalhesDoAvisoVisita({ detalhe: DETALHE, endereco: o.endereco ?? null, linhas: corpo.linhas });
  return { corpo: corpo.body("Daniel"), texto: d.texto, html: d.html, tudo: `${corpo.body("Daniel")}\n${d.texto}\n${d.html}` };
}

test("E1039 trava — morador, presencial: horário, endereço exato e o mapa", () => {
  const m = mensagem({ modalidade: "presencial", quemConfirmou: "proprietario", endereco: ENDERECO });
  assert.match(m.corpo, /o proprietário confirmou a sua visita presencial a Apto Santa Mônica \(código VN-3F9A2C\) para 05\/11\/2026 às 10:00 \(horário de Brasília\)\./);
  assert.ok(m.html.includes(QUANDO), "o bloco de dados traz o horário");
  assert.ok(m.texto.includes(`Endereço: ${ENDERECO.texto}`), "o texto traz o endereço exato");
  assert.ok(m.texto.includes(`Abrir no mapa: ${ENDERECO.mapa}`), "o texto traz o mapa");
  assert.ok(m.html.includes(`<strong>Endereço:</strong> ${ENDERECO.texto}`), "o HTML traz o endereço exato");
  assert.ok(m.html.includes(`<a href="${ENDERECO.mapa}">Abrir no mapa</a>`), "o HTML traz o mapa");
  assert.doesNotMatch(m.tudo, /Morador/, "o morador não recebe o próprio nome");
});

test("E1039 trava — dono, presencial: horário e com quem (primeiro nome), sem endereço", () => {
  const m = mensagem({ modalidade: "presencial", quemConfirmou: "morador" });
  assert.match(m.corpo, /o interessado confirmou a visita presencial com Ana a Apto Santa Mônica .* para 05\/11\/2026 às 10:00/);
  assert.ok(m.html.includes(QUANDO), "o bloco de dados traz o horário");
  assert.match(m.html, /Morador<\/td><td[^>]*>Ana<\/td>/, "o bloco de dados traz o morador");
  assert.doesNotMatch(m.tudo, /Souza/, "só o primeiro nome (E328)");
  assert.doesNotMatch(m.tudo, /Endereço|Abrir no mapa/, "o dono não recebe o endereço");
});

// E1039 (texto aprovado pelo coordenador, ORDEM-DUET-258): o documento com foto, na visita presencial.
const LEVE = "Leve um documento com foto.";
const ORIENTADO = "O visitante foi orientado a levar um documento com foto.";

test("E1039 trava — morador, presencial: a linha do documento com foto", () => {
  const m = mensagem({ modalidade: "presencial", quemConfirmou: "proprietario", endereco: ENDERECO });
  assert.ok(m.corpo.includes(LEVE), "o morador é orientado a levar documento com foto");
  assert.ok(!m.tudo.includes(ORIENTADO), "a linha do proprietário não vai ao morador");
});

test("E1039 trava — proprietário, presencial: a linha de que o visitante foi orientado", () => {
  const m = mensagem({ modalidade: "presencial", quemConfirmou: "morador" });
  assert.ok(m.corpo.includes(ORIENTADO), "o proprietário sabe que o visitante leva documento com foto");
  assert.ok(!m.tudo.includes(LEVE), "a linha do morador não vai ao proprietário");
});

for (const quemConfirmou of ["proprietario", "morador"] as const) {
  test(`E1039 trava — por vídeo (${quemConfirmou} confirmou): sem a linha do documento (não há encontro)`, () => {
    const m = mensagem({ modalidade: "video", quemConfirmou });
    assert.doesNotMatch(m.tudo, /documento com foto/);
  });
}

for (const quemConfirmou of ["proprietario", "morador"] as const) {
  test(`E1039 trava — por vídeo (${quemConfirmou} confirmou): horário e como entrar, sem endereço nem link da chamada`, () => {
    const m = mensagem({ modalidade: "video", quemConfirmou });
    assert.ok(m.html.includes(QUANDO), "o bloco de dados traz o horário");
    assert.match(m.corpo, /Na hora, entre pela página da visita na plataforma\./);
    assert.doesNotMatch(m.tudo, /Endereço|Abrir no mapa/);
    assert.doesNotMatch(m.tudo, /https?:\/\/(?!www\.google)/, "nenhum link cru (E326)");
  });
}

test("E1039 trava — o servidor monta o aviso com detalhesDoAvisoVisita (a mesma montagem que a trava confere)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../data/visitas-video-actions.ts", import.meta.url), "utf8");
  const aviso = src.slice(src.indexOf("function avisarVisita("), src.indexOf("function avisarVisita(") + 2000);
  assert.match(aviso, /detalhesDoAvisoVisita\(/);
});
