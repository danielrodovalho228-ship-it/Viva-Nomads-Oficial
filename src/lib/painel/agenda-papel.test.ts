/* Roda: node --test src/lib/painel/agenda-papel.test.ts — E410 (01/11): no painel da MORADORA, a Agenda dizia "todos os
   seus imóveis" e "Quando você anunciar… / Anunciar imóvel" (textos do proprietário). No papel morador, o texto é o dela
   e leva a Visitas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { agendaNoPapelMorador, TEXTOS_AGENDA_MORADOR } from "./agenda-papel.ts";

test("quem está no papel morador", () => {
  assert.equal(agendaNoPapelMorador({ papeis: ["morador"], gravado: null }), true);
  assert.equal(agendaNoPapelMorador({ papeis: ["morador", "proprietario"], gravado: "morador" }), true);
  assert.equal(agendaNoPapelMorador({ papeis: ["morador", "proprietario"], gravado: "proprietario" }), false);
  assert.equal(agendaNoPapelMorador({ papeis: ["morador", "proprietario"], gravado: null }), false);
  assert.equal(agendaNoPapelMorador(null), false);
});

test("os textos da moradora não falam de anunciar nem de 'seus imóveis'", () => {
  const todos = [TEXTOS_AGENDA_MORADOR.subtitulo("horário de Brasília"), TEXTOS_AGENDA_MORADOR.vazioTitulo, TEXTOS_AGENDA_MORADOR.vazioTexto, TEXTOS_AGENDA_MORADOR.acao, TEXTOS_AGENDA_MORADOR.lembrete].join(" ");
  assert.doesNotMatch(todos, /anunciar|seus imóveis|Nenhum imóvel/i);
  assert.match(TEXTOS_AGENDA_MORADOR.vazioTexto, /Agendar visita/);
});

test("a página usa o papel e, na moradora sem imóvel, troca o vazio do dono pelo dela", () => {
  const p = readFileSync(new URL("../../app/(dashboard)/dashboard/agenda/page.tsx", import.meta.url), "utf8");
  assert.match(p, /estadoDosPapeis\(\)\.catch\(\(\) => null\)/);
  assert.match(p, /if \(morador && imoveis\.length === 0\) \{[\s\S]*data-testid="agenda-morador"[\s\S]*href="\/dashboard\/visitas"/);
  // O texto do dono continua para o dono.
  assert.match(p, /Quando você anunciar, as visitas e as estadias de todos os imóveis aparecem aqui num calendário só\./);
});
