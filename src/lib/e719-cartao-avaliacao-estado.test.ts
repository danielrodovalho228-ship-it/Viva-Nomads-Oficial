/*
  E719 — o cartão do contrato lê o estado REAL da avaliação: publicada tira o "Aguardando a outra parte".
  Roda: node --test src/lib/e719-cartao-avaliacao-estado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partesDaAvaliacao } from "./avaliacoes.ts";

const le = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("publicada: o cartão diz 'Publicada' e não 'Aguardando a outra parte'", () => {
  const p = partesDaAvaliacao(true, "18/11/2026", "publicada");
  assert.equal(p.estado, "Publicada");
  const texto = JSON.stringify(p);
  assert.doesNotMatch(texto, /Aguardando a outra parte/);
  assert.doesNotMatch(texto, /Fica fechada/);
});

test("enviada continua 'Aguardando a outra parte'; sem avaliar, 'Falta a sua avaliação' (regra às cegas intacta)", () => {
  assert.equal(partesDaAvaliacao(true, null, "enviada").estado, "Aguardando a outra parte");
  assert.equal(partesDaAvaliacao(true, null).estado, "Aguardando a outra parte");
  assert.equal(partesDaAvaliacao(false, null, null).estado, "Falta a sua avaliação");
});

test("em moderação e removida têm estado próprio", () => {
  assert.equal(partesDaAvaliacao(true, null, "em_moderacao").estado, "Em análise pela equipe");
  assert.equal(partesDaAvaliacao(true, null, "removida").estado, "Removida pela equipe");
});

test("as telas leem o estado do banco e o passam ao formulário; o formulário não oferece avaliar de novo", () => {
  const acoes = le("./data/contratos-actions.ts");
  assert.match(acoes, /async function avaliacoesMinhasPorContrato\(/);
  assert.equal((acoes.match(/minhaAvaliacao: minhasAvaliacoes\.get\(String\(c\.id\)\) \?\? null/g) ?? []).length, 2);
  assert.match(le("../app/(dashboard)/dashboard/contratos/contratos-client.tsx"), /minhaAvaliacao=\{demo \? null : contrato\.minhaAvaliacao\}/);
  assert.match(le("../app/(dashboard)/dashboard/locacoes/locacoes-client.tsx"), /minhaAvaliacao=\{demoOn \? null : l\.minhaAvaliacao\}/);
  const form = le("../components/avaliacao-form.tsx");
  assert.match(form, /if \(!enviado && minhaAvaliacao\) return partes;/);
  assert.ok(form.indexOf("if (!enviado && minhaAvaliacao) return partes;") < form.indexOf("if (fechada) {"));
});

test("falha ao ler as avaliações não inventa 'não avaliei': devolve mapa vazio e o cartão segue como antes", () => {
  assert.match(le("./data/contratos-actions.ts"), /if \(error\) return mapa;/);
});
