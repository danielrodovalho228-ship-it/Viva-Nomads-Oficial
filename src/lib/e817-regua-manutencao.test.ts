/*
  E817 — UMA régua de manutenção no anúncio e na Central de Ajuda. Antes: o anúncio prometia prazo de SOLUÇÃO
  (urgente 24/72 h, comum 72 h, demais 7 dias) e a Ajuda prazo de RESPOSTA (4 h, 24 h, 72 h "nos demais"), sem dizer
  quem resolve, como acionar nem o que acontece no atraso. Agora as duas superfícies leem a mesma régua, com os dois prazos
  de cada prioridade e só o que o código já faz.
  Roda: node --test src/lib/e817-regua-manutencao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { PRAZO_MANUTENCAO_H, PRAZO_SOLUCAO_H, SE_O_PRAZO_VENCER, COMO_ACIONAR_MANUTENCAO, frasePrazosManutencao, linhasReguaManutencao } from "../config/atendimento.ts";
import { textoCompromissoManutencao } from "./conforto/exibicao.ts";
import { SELO_MANUTENCAO } from "./manutencao-solucao.ts";
import { FAQ } from "./atendimento/faq.ts";

test("cada prioridade diz os DOIS prazos (resposta e solução), das constantes do código", () => {
  const [u, m, b] = linhasReguaManutencao().map((l) => l.texto);
  assert.match(u, new RegExp(`resposta em até ${PRAZO_MANUTENCAO_H.urgente} h, solução provisória em até ${PRAZO_SOLUCAO_H.urgente.provisoria} h e definitiva em até ${PRAZO_SOLUCAO_H.urgente.definitiva} h`));
  assert.match(m, new RegExp(`resposta em até ${PRAZO_MANUTENCAO_H.media} h e solução em até ${PRAZO_SOLUCAO_H.media} h`));
  assert.match(b, /resposta em até 72 h e solução em até 7 dias/);
});

test("anúncio e Ajuda leem a MESMA régua (nenhuma linha de prazo diverge)", () => {
  const anuncio = textoCompromissoManutencao();
  const ajuda = frasePrazosManutencao();
  for (const l of linhasReguaManutencao()) {
    assert.ok(anuncio.includes(l.texto), `anúncio: ${l.texto}`);
    assert.ok(ajuda.includes(l.texto), `Ajuda: ${l.texto}`);
  }
  assert.ok(anuncio.includes(SE_O_PRAZO_VENCER) && ajuda.includes(SE_O_PRAZO_VENCER), "o que acontece no atraso, nos dois");
  // Os termos antigos e soltos ("comum", "demais", "horas em urgências") saíram.
  assert.doesNotMatch(anuncio + ajuda, /\bcomum em até|\bdemais em até|horas em urgências|nos demais/);
  const faqManutencao = FAQ.map((f) => f.resposta).find((r) => r.includes("resposta em até"));
  assert.ok(faqManutencao, "a Central de Ajuda usa a régua");
});

test("quem resolve, como acionar e o atraso: só o que o código faz", () => {
  assert.match(COMO_ACIONAR_MANUTENCAO, /Quem resolve é o proprietário/);
  assert.match(COMO_ACIONAR_MANUTENCAO, /"Problema com isto\?"/);
  assert.match(SE_O_PRAZO_VENCER, /você é avisado e pode chamar um parceiro de manutenção pela própria ordem/);
  assert.equal(SELO_MANUTENCAO.perdeCom, 3, "o selo cai com soluções fora do prazo repetidas (3 em 90 dias)");
});
