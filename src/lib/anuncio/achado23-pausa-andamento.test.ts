/*
  Achado nº 23 (erros/estados vazios) — antes de pausar, o dono vê o que continua em andamento (contratos, propostas,
  visitas, candidaturas). Cada contagem que falhava virava 0 e a tela não dizia nada — como se não houvesse contrato.
  Agora a contagem LANÇA e a tela diz que não deu para conferir, e que o que existe continua valendo.
  Roda: node --test src/lib/anuncio/achado23-pausa-andamento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MSG_ANDAMENTO_FALHOU } from "./pausa.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("a contagem do que está em andamento lança na falha (nunca vira 0)", () => {
  const f = ler("src/lib/data/actions.ts");
  const i = f.indexOf("export async function emAndamentoDoAnuncio(");
  const corpo = f.slice(i, f.indexOf("\nexport ", i + 10));
  assert.match(corpo, /if \(r\.error\) throw new Error\(/);
  assert.doesNotMatch(corpo, /\(await q\)\.count \?\? 0/);
});

test("a tela de pausa avisa que não conferiu, e que nada em andamento muda", () => {
  const c = ler("src/components/anuncio/estado-anuncio.tsx");
  assert.match(c, /\.catch\(\(\) => setAndamento\(\[MSG_ANDAMENTO_FALHOU\]\)\)/);
  assert.doesNotMatch(c, /\.catch\(\(\) => setAndamento\(\[\]\)\)/);
  assert.match(MSG_ANDAMENTO_FALHOU, /^Não foi possível conferir o que está em andamento agora\./);
  assert.match(MSG_ANDAMENTO_FALHOU, /contratos, propostas aceitas, visitas marcadas e candidaturas abertas continuam valendo/);
});
