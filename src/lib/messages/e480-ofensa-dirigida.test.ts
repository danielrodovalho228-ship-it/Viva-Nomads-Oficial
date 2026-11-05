/*
  E480 — E445 item 3: "isso é um lixo, seu idiota" (mensagem real do reteste, produção 02/11) passava íntegra, sem
  aviso e sem moderação. A lista do E445 cobre "ofensa dirigida, discriminação e ameaça", mas só tinha xingamentos
  graves; o xingamento comum DIRIGIDO a alguém ("seu idiota", "você é um imbecil") ficava de fora. Correção (lista v2):
  os xingamentos comuns entram SÓ na forma dirigida — "seu/sua X", "você é um/uma X", "vc é X" —, para que
  "que ideia idiota", "trânsito burro" ou "isso é um lixo" sigam livres. Palavrão leve continua livre.
  Roda: node --test src/lib/messages/e480-ofensa-dirigida.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { termoOfensivo, normalizarParaOfensa } from "./ofensas.ts";
import { TERMOS_OFENSIVOS, VERSAO_LISTA_OFENSAS } from "../../config/ofensas.ts";

test("a mensagem do reteste ('isso é um lixo, seu idiota') é avisada", () => {
  assert.equal(termoOfensivo("isso é um lixo, seu idiota"), "seu idiota");
});

test("xingamento comum dirigido: seu/sua, você é um/uma, vc é", () => {
  for (const [texto, termo] of [
    ["Seu IMBECIL!", "seu imbecil"],
    ["sua burra, leia o anúncio", "sua burra"],
    ["você é um otário", "voce e um otario"],
    ["voce e uma idiota", "voce e uma idiota"],
    ["vc é babaca", "vc e babaca"],
    ["seu palhaço", "seu palhaco"],
  ] as const) assert.equal(termoOfensivo(texto), termo, texto);
});

test("sem falso positivo: o mesmo xingamento sem alvo, palavrão leve e conversa normal passam", () => {
  for (const t of [
    "que ideia idiota a minha, esqueci a chave",
    "isso é um lixo de trânsito",
    "o trânsito está burro hoje",
    "porra, esqueci a chave",
    "seu imóvel é lindo",
    "sua casa ficou ótima",
    "você é um ótimo anfitrião",
    "o palhaço do aniversário chegou",
    "seu lixo vai na terça?", // "lixo" fica fora: "seu lixo" também é o lixo da pessoa
  ]) assert.equal(termoOfensivo(t), null, t);
});

test("lista v2, tudo no formato normalizado", () => {
  assert.equal(VERSAO_LISTA_OFENSAS, 2);
  for (const t of TERMOS_OFENSIVOS) assert.equal(t, normalizarParaOfensa(t), t);
});
