/*
  E1070 — trava: quando "Gerar contrato" recebe um 503, a mensagem corresponde à causa ou é genérica — nunca afirma
  "assinatura digital inativa" quando o motivo é outro. Antes, a tela tratava QUALQUER 503 como assinatura inativa; a
  rota também responde 503 quando não consegue ler as partes, os valores ou a reserva.
  A tela é cobrada pela t1706; aqui a regra e a guarda de que a rota marca a assinatura inativa com o modo.
  Roda: node --test src/lib/e1070-503-mensagem-da-causa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { passoDaRespostaContrato } from "./fechamento-contrato.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("E1070 — só o modo \"inativa\" diz que a assinatura está inativa; o 503 sozinho não diz", () => {
  assert.equal(passoDaRespostaContrato(503, {}), "erro");
  assert.equal(passoDaRespostaContrato(503, { modo: undefined }), "erro");
  assert.equal(passoDaRespostaContrato(503, { modo: "teste" }), "erro");
  // A assinatura inativa continua reconhecida — pelo modo que a rota manda.
  assert.equal(passoDaRespostaContrato(503, { modo: "inativa" }), "inativa");
  assert.equal(passoDaRespostaContrato(200, { modo: "inativa" }), "inativa");
});

test("E1070 — a rota manda o modo \"inativa\" em TODA resposta de assinatura inativa, e só nelas", () => {
  const rota = ler("app/api/contrato/route.ts");
  const respostas = [...rota.matchAll(/NextResponse\.json\((\{[^\n]*?\}), \{ status: 503 \}\)/g)].map((m) => m[1]);
  assert.ok(respostas.length >= 6, "a rota tem respostas 503 para conferir");
  const inativas = respostas.filter((r) => /MSG_ASSINATURA_INATIVA/.test(r));
  assert.equal(inativas.length, 3);
  for (const r of inativas) assert.match(r, /modo: "inativa"/);
  for (const r of respostas.filter((x) => !/MSG_ASSINATURA_INATIVA/.test(x))) assert.doesNotMatch(r, /modo:/, `503 de outra causa sem modo: ${r}`);
});

test("E1070 — nas outras falhas a tela mostra o texto do servidor ou um genérico, nunca a assinatura inativa", () => {
  const tela = ler("app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  const clique = tela.slice(tela.indexOf("async function generateContract()"), tela.indexOf("const canAdvance"));
  assert.match(clique, /if \(passo === "inativa"\) \{\s*setErroContrato\(MSG_ASSINATURA_INATIVA\);\s*return;/);
  assert.match(clique, /if \(passo !== "registrar"\) \{\s*setErroContrato\(data\.error \?\? "Não foi possível gerar o contrato\. Tente de novo\."\);\s*return;/);
  // A mensagem da assinatura inativa aparece num único ponto do clique.
  assert.equal(clique.split("MSG_ASSINATURA_INATIVA").length - 1, 1);
});

test("E1070 — os textos de \"não consegui ler\" que a rota manda com 503 não falam de assinatura", () => {
  const servidor = ler("lib/data/fechamento-servidor.ts");
  assert.match(servidor, /MSG_FECHAMENTO_SEM_LEITURA = "Não foi possível conferir o fechamento agora\. Tente de novo em instantes\."/);
  assert.match(servidor, /status: 503, error: "Não foi possível ler os dados das partes agora\. Tente de novo em instantes\."/);
  for (const texto of [...servidor.matchAll(/status: 503, error: "([^"]+)"/g)].map((m) => m[1])) assert.doesNotMatch(texto, /assinatura/i);
});
