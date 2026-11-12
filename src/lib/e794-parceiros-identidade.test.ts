/*
  E794 (regra E445): a landing /parceiros prometia "identidade revelada depois/após o aceite" no herói e no cartão de
  números. Nada é revelado nem trocado após o aceite; o contato nunca é trocado. As frases moram na fonte única do E776
  (textos-regulados) e a página passa pelo gate de frases proibidas.
  Roda: node --test src/lib/e794-parceiros-identidade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FORA_DO_GATE, achadosProibidos } from "./frases-proibidas.ts";
import { PARCEIROS_HEROI_SUBTITULO, PARCEIROS_NUMERO_CONTATO } from "../config/textos-regulados.ts";

const PAGINA = "src/app/(public)/parceiros/page.tsx";
const REVELA = /identidade[^.\n"]{0,30}revelad\w*[^.\n"]{0,20}(depois|ap[óo]s)\s+(d?o\s+)?aceite/i;

test("a landing de Parceiros não promete identidade revelada depois do aceite e usa a fonte única", () => {
  const pagina = readFileSync(PAGINA, "utf8");
  assert.doesNotMatch(pagina, REVELA);
  assert.match(pagina, /\{PARCEIROS_HEROI_SUBTITULO\}/);
  assert.match(pagina, /\{PARCEIROS_NUMERO_CONTATO\.titulo\}/);
  assert.match(pagina, /\{PARCEIROS_NUMERO_CONTATO\.nota\}/);
});

test("as frases novas dizem a regra E445 (contato nunca trocado) e passam no gate", () => {
  for (const f of [PARCEIROS_HEROI_SUBTITULO, PARCEIROS_NUMERO_CONTATO.titulo, PARCEIROS_NUMERO_CONTATO.nota]) {
    assert.doesNotMatch(f, REVELA, f);
    assert.deepEqual(achadosProibidos(f, PAGINA), [], f);
  }
  assert.match(`${PARCEIROS_HEROI_SUBTITULO} ${PARCEIROS_NUMERO_CONTATO.nota}`, /nunca é trocado/);
});

test("GATE: a frase velha é barrada nas superfícies de Parceiros, e as páginas públicas de Parceiros não ficam mais fora do gate", () => {
  for (const f of ["com conversa só pela plataforma e identidade revelada depois do aceite.", "identidade revelada após o aceite"])
    assert.ok(achadosProibidos(f, PAGINA).some((a) => a.id === "identidade-revelada-depois-do-aceite-parceiros"), f);
  assert.ok(!FORA_DO_GATE.some((x) => PAGINA.startsWith(x.prefixo)), "a pasta das páginas públicas de Parceiros está no gate");
});
