import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REGRA_DO_REAGENDAMENTO, REGRAS_AGENDA, podeReagendar } from "./regras.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

/*
  E1155 (ORDEM-DUET-652, achado da passagem ao vivo). Com a visita marcada, o DONO lia junto do "Reagendar" a regra
  "Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso."; o AVALIADOR, no formulário dele de agendar e
  reagendar, não lia regra nenhuma — e a regra vale igual para os dois (cada parte reagenda uma vez, com 24 horas).
  A frase passa a ter uma fonte só, e os dois formulários mostram-na nas mesmas condições (com a visita já marcada).
  Roda: node --test src/lib/vistoria/e1155-regra-do-reagendamento-no-avaliador.test.ts
*/
const ler = (p: string) => readFileSync(p, "utf8");
const escritaAMao = (fonte: string) => (fonte.match(/Reagendar sem custo/g) ?? []).length;

test("E1155: a regra é uma frase só, com o prazo lido da regra da agenda", () => {
  assert.equal(REGRA_DO_REAGENDAMENTO, "Reagendar sem custo: uma vez, com pelo menos 24 horas de aviso.");
  assert.equal(REGRAS_AGENDA.antecedenciaReagendarHoras, 24);
  assert.equal(REGRAS_AGENDA.reagendamentosPorParte, 1);
  const regras = semComentarios(ler("src/lib/vistoria/regras.ts"));
  assert.match(regras, /export const REGRA_DO_REAGENDAMENTO = `Reagendar sem custo: uma vez, com pelo menos \$\{REGRAS_AGENDA\.antecedenciaReagendarHoras\} horas de aviso\.`;/);
  // A frase diz o que a regra faz: uma vez por parte, e só com a antecedência.
  const visita = "2026-11-27T13:00:00.000Z";
  assert.deepEqual(podeReagendar(visita, new Date("2026-11-26T12:59:00.000Z"), false), { ok: true });
  assert.equal(podeReagendar(visita, new Date("2026-11-26T13:01:00.000Z"), false).ok, false, "menos de 24 horas de aviso");
  assert.equal(podeReagendar(visita, new Date("2026-11-25T13:00:00.000Z"), true).ok, false, "a parte já reagendou uma vez");
});

test("E1155: o formulário do avaliador mostra a regra, da mesma fonte e na mesma condição do formulário do dono", () => {
  const dono = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  const avaliador = semComentarios(ler("src/app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx"));
  // Nenhum dos dois escreve a frase à mão.
  assert.equal(escritaAMao(dono), 0);
  assert.equal(escritaAMao(avaliador), 0);
  // O dono: como era, dentro do formulário de data, só com a visita já marcada.
  const formDono = dono.slice(dono.indexOf('testid="dono-agendar"'), dono.indexOf("</FormAcao>", dono.indexOf('testid="dono-agendar"')));
  assert.match(formDono, /\{atual\.agendado_para && \(\s*<span [^>]*data-testid="avaliacao-regra-reagendar"[^>]*>\s*\{REGRA_DO_REAGENDAMENTO\}\s*<\/span>\s*\)\}/);
  // O avaliador: a mesma frase, dentro do formulário de agendar, na mesma condição.
  const formAval = avaliador.slice(avaliador.indexOf('testid="agendar-visita"'), avaliador.indexOf("</FormAcao>", avaliador.indexOf('testid="agendar-visita"')));
  assert.match(formAval, /\{p\.agendado_para && \(\s*<span [^>]*data-testid="regra-reagendar"[^>]*>\s*\{REGRA_DO_REAGENDAMENTO\}\s*<\/span>\s*\)\}/);
  // O rótulo do botão muda nos dois com a mesma condição: a regra acompanha o "Reagendar".
  assert.match(formDono, /\{atual\.agendado_para \? "Reagendar" : "Propor data"\}/);
  assert.match(formAval, /\{p\.agendado_para \? "Reagendar" : "Agendar"\}/);
});
