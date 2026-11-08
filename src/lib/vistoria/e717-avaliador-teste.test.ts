import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULO_AVALIADOR_CREDENCIADO, ROTULO_AVALIADOR_EM_TESTE, TEXTO_AVALIADOR_DE_TESTE } from "./regras.ts";

const pagina = readFileSync("src/app/(public)/avaliadores/[numero]/page.tsx", "utf8");

// E717 (QA): o avaliador em teste (conta de teste) abria em /avaliadores/<nº> como "Avaliador credenciado da Viva", sem a
// faixa de teste — enquanto o /conferir mostra "Documento de teste". A página lê `teste` da vitrine e declara a conta de teste.
test("a página pública do avaliador mostra a faixa de teste quando a conta é de teste", () => {
  assert.match(pagina, /a\.teste &&/);
  assert.match(pagina, /data-testid="avaliador-teste"/);
  assert.match(pagina, /\{TEXTO_AVALIADOR_DE_TESTE\}/);
});

test("o texto diz que é conta de teste e que não vale como avaliador real", () => {
  assert.match(TEXTO_AVALIADOR_DE_TESTE, /conta de teste/);
  assert.match(TEXTO_AVALIADOR_DE_TESTE, /não é um avaliador real/);
});

// E717 (instrução de 08/11): o rótulo "credenciado" também sai para quem está em teste.
test("o rótulo acima do nome é 'em teste' quando a conta é de teste e 'credenciado' só para o real", () => {
  assert.match(pagina, /data-testid="avaliador-rotulo">\{a\.teste \? ROTULO_AVALIADOR_EM_TESTE : ROTULO_AVALIADOR_CREDENCIADO\}/);
  assert.equal(ROTULO_AVALIADOR_EM_TESTE, "Avaliador em teste");
  assert.equal(ROTULO_AVALIADOR_CREDENCIADO, "Avaliador credenciado da Viva");
});
