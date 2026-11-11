/*
  Ordem 9950ef15, item 5 (LGPD art. 11): a plataforma NUNCA pede nem mostra diagnóstico. A frase livre do cartão
  "Por que estou na cidade" é mostrada ao proprietário depois do aceite; diagnóstico/doença ali é recusado no servidor
  e, se já estiver gravado (antes desta regra), não chega ao proprietário.
  Roda: node --test src/lib/perfil/por-que-diagnostico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { mencionaDiagnostico, sinaisPorQueParaDono, validarPorQueNaCidade } from "./por-que-na-cidade.ts";

const COM_DIAGNOSTICO = [
  "Vim fazer quimioterapia no hospital",
  "Tratamento de câncer de mama",
  "Acompanho meu pai na hemodiálise",
  "Diagnóstico recente, preciso ficar perto do hospital",
  "Tenho depressão e quero um lugar calmo",
  "Sou HIV positivo",
  "CID F32",
  "Radioterapia por 2 meses",
  "Tratando um tumor",
  "Leucemia do meu filho",
  "Minha doença exige repouso",
];

const SEM_DIAGNOSTICO = [
  "Residência médica",
  "Vim para a cidade trabalhar no hospital",
  "Projeto de 3 meses na fábrica",
  "Mestrado na universidade",
  "Acompanho um familiar em tratamento de saúde",
  "Moro perto da Cidade Universitária",
  "Ciclo de palestras",
];

test("frase com diagnóstico ou doença é recusada no servidor, com mensagem clara", () => {
  for (const frase of COM_DIAGNOSTICO) {
    const r = validarPorQueNaCidade({ frase });
    assert.equal(r.ok, false, frase);
    if (!r.ok) assert.match(r.erro, /diagnóstico/i);
  }
});

test("frase sem diagnóstico continua aceita (inclui 'tratamento de saúde', 'hospital' e 'Cidade')", () => {
  for (const frase of SEM_DIAGNOSTICO) assert.equal(validarPorQueNaCidade({ frase }).ok, true, frase);
});

test("empresa/instituição não passa pelo filtro (nome real de hospital continua aceito)", () => {
  assert.equal(validarPorQueNaCidade({ empresa: "Hospital de Amor (câncer)" }).ok, true);
});

test("frase já gravada com diagnóstico NÃO chega ao proprietário, nem depois do aceite", () => {
  const p = { inicio: "2026-11-01", fim: null, empresa: null, frase: "Vim fazer quimioterapia" };
  assert.deepEqual(sinaisPorQueParaDono(p, true), ["Na cidade desde 01/11/2026"]);
});

test("mencionaDiagnostico: vazio e nulo são falsos", () => {
  assert.equal(mencionaDiagnostico(""), false);
  assert.equal(mencionaDiagnostico(null), false);
});
