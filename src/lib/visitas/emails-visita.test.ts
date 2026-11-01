/*
  E325 — os e-mails de visita identificam o imóvel (título + código VN-…) no assunto, no corpo e no bloco, e dizem quem
  agiu. Caso real da prova do E290 (31/10): "Pedido de visita no seu imóvel" e "Visita confirmada" sem imóvel nenhum.
  Roda: node --test src/lib/visitas/emails-visita.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { corpoVisitaConfirmada, corpoVisitaPedida, imovelDaVisitaTexto, quandoVisita } from "./emails-visita.ts";

const IMOVEL = { id: "3f9a2c11-0000-4000-8000-000000000001", titulo: "Apto Santa Mônica" };

test("pedido de visita ao dono: assunto, corpo e bloco com título e código do imóvel", () => {
  const c = corpoVisitaPedida({ imovel: IMOVEL, modalidade: "video", horarios: ["2026-11-05T13:00:00Z", "2026-11-04T18:00:00Z"] });
  assert.equal(c.subject, "Pedido de visita: Apto Santa Mônica");
  assert.equal(
    c.body("Daniel"),
    "Olá Daniel, um interessado pediu uma visita por vídeo a Apto Santa Mônica (código VN-3F9A2C). Confirme um dos horários, proponha outro ou recuse pela plataforma.",
  );
  assert.deepEqual(c.linhas, [
    { rotulo: "Imóvel", valor: "Apto Santa Mônica · código VN-3F9A2C" },
    { rotulo: "Visita", valor: "Por vídeo" },
    { rotulo: "Horários propostos", valor: "04/11/2026 às 15:00; 05/11/2026 às 10:00 (horário de Brasília)" },
  ]);
});

test("visita confirmada: diz quem confirmou, o imóvel (título + código) e o horário", () => {
  const ao = corpoVisitaConfirmada({ imovel: IMOVEL, modalidade: "presencial", horario: "2026-11-05T13:00:00Z", quemConfirmou: "proprietario" });
  assert.equal(ao.subject, "Visita confirmada: Apto Santa Mônica");
  assert.equal(ao.body("Lara"), "Olá Lara, o proprietário confirmou a sua visita presencial a Apto Santa Mônica (código VN-3F9A2C) para 05/11/2026 às 10:00 (horário de Brasília). Os detalhes ficam em Visitas, na plataforma.");
  assert.deepEqual(ao.linhas, [
    { rotulo: "Imóvel", valor: "Apto Santa Mônica · código VN-3F9A2C" },
    { rotulo: "Visita", valor: "Presencial" },
    { rotulo: "Quando", valor: "05/11/2026 às 10:00 (horário de Brasília)" },
  ]);
  const aoDono = corpoVisitaConfirmada({ imovel: IMOVEL, modalidade: "video", horario: "2026-11-05T13:00:00Z", quemConfirmou: "morador" });
  assert.match(aoDono.body("Daniel"), /^Olá Daniel, o interessado confirmou a visita por vídeo a Apto Santa Mônica \(código VN-3F9A2C\)/);
});

test("sem título: o código continua identificando o imóvel; sem nome, saudação neutra", () => {
  const c = corpoVisitaPedida({ imovel: { id: IMOVEL.id, titulo: null }, modalidade: "video", horarios: [] });
  assert.equal(c.subject, null);
  assert.match(c.body(), /^Olá, um interessado pediu uma visita por vídeo ao imóvel de código VN-3F9A2C\./);
  assert.equal(imovelDaVisitaTexto({ id: IMOVEL.id }), "código VN-3F9A2C");
  assert.equal(quandoVisita(null), "");
});

test("os dois e-mails do servidor usam os corpos do E325 (nunca mais só o texto genérico do modelo)", () => {
  const src = readFileSync(new URL("../data/visitas-video-actions.ts", import.meta.url), "utf8");
  assert.match(src, /corpoVisitaPedida\(\{ imovel: \{ id: propertyId, titulo: /);
  assert.match(src, /corpoVisitaConfirmada\(\{\n\s*imovel: \{ id: v\.property_id as string, titulo: /);
  assert.match(src, /\.\.\.\(corpo \? \{ \.\.\.\(corpo\.subject \? \{ subject: corpo\.subject \} : \{\}\), body: corpo\.body \} : \{\}\)/);
  // O link cru da chamada nunca vai no e-mail (E326 / revisão do #1786).
  assert.doesNotMatch(src.slice(src.indexOf("function avisarVisita"), src.indexOf("export async function pedirVisita")), /link_chamada|linkChamada/);
});
