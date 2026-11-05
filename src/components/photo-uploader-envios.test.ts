/*
  t204 a 390 px (lab do #2777): arrastar a 8ª foto enquanto o lote de 7 ainda era conferido fazia o 2º envio gravar
  sobre a lista ANTIGA (vazia) — a galeria ficava com 1 foto e a IA das fotos nunca rodava. Cada envio grava agora
  sobre a lista mais recente.
  Roda: node --test src/components/photo-uploader-envios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync(new URL("./photo-uploader.tsx", import.meta.url), "utf8");

test("o envio grava sobre a lista mais recente, não sobre a do começo do envio", () => {
  const corpo = fonte.slice(fonte.indexOf("async function handleFiles"), fonte.indexOf("async function usarOriginal"));
  assert.match(corpo, /gravarSobreAtual\(\(atual\) => comPrincipalBoa\(\[\.\.\.atual, \.\.\.novas\]\)\)/);
  assert.doesNotMatch(corpo, /onChange\(comPrincipalBoa\(\[\.\.\.photos, \.\.\.novas\]\)\)/);
  assert.match(corpo, /atuais: fotosRef\.current/);
  assert.match(fonte, /fotosRef\.current = next;\s*onChange\(next\);/);
});
