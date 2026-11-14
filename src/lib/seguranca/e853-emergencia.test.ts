/*
  E853 (🔴, defeito confirmado duas vezes): /seguranca perdeu a linha de emergência. Ela volta em destaque, logo no início
  do conteúdo, com o texto exato. Roda: node --test src/lib/seguranca/e853-emergencia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FRASE_EMERGENCIA_SEGURANCA, NUMEROS_EMERGENCIA } from "./emergencia.ts";

const pagina = readFileSync(new URL("../../app/(public)/seguranca/page.tsx", import.meta.url), "utf8");

test("E853: a frase de emergência é a aprovada, palavra por palavra", () => {
  assert.equal(FRASE_EMERGENCIA_SEGURANCA, "Em uma emergência, ligue 190 ou 193. A Viva não recebe esse tipo de ligação.");
  assert.deepEqual(NUMEROS_EMERGENCIA, ["190", "193"]);
  for (const n of NUMEROS_EMERGENCIA) assert.ok(FRASE_EMERGENCIA_SEGURANCA.includes(n), n);
});

test("E853: /seguranca mostra a linha em destaque, antes dos golpes, com os números ligáveis", () => {
  const i = pagina.indexOf('data-testid="seguranca-emergencia"');
  assert.ok(i > 0, "a linha existe");
  assert.ok(i < pagina.indexOf("GOLPES.map"), "vem antes da lista de golpes (destaque)");
  const bloco = pagina.slice(pagina.lastIndexOf("<", i), pagina.indexOf("</section>", i));
  assert.match(bloco, /role="note"/);
  assert.match(bloco, /<LinhaEmergencia \/>/);
  const comp = readFileSync(new URL("../../components/institucional/linha-emergencia.tsx", import.meta.url), "utf8");
  assert.match(comp, /FRASE_EMERGENCIA_SEGURANCA/);
  assert.match(comp, /href=\{`tel:\$\{n\}`\}/);
});
