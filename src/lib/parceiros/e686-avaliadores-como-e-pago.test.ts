import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// E686: a vitrine pública de avaliadores não diz "segue a tabela da Viva" ao lado de "você define o seu valor".
const src = readFileSync("src/app/(public)/parceiros/avaliadores/page.tsx", "utf8");
const bloco = src.slice(src.indexOf('data-testid="recrutamento-pagamento"'), src.indexOf("Um só pedido"));

test("E686: 'Como é pago' diz que o avaliador define o valor e o prazo, e a tabela é só referência", () => {
  assert.doesNotMatch(bloco, /segue a tabela/);
  assert.match(bloco, /você define o seu valor e o seu prazo/i);
  assert.match(bloco, /tabela da Viva[^.]*referência/i);
  // E714: a frase fala DO dono, não com ele ("Você paga a avaliação" é do dono, não do avaliador que lê a página).
  assert.match(bloco, /\{FRASE_DONO_PAGA_AVALIACAO\}/);
  assert.doesNotMatch(bloco, /FRASE_PAGA_AVALIACAO\}/);
  assert.doesNotMatch(bloco, /Você paga a avaliação/);
});

test("E714: a constante para o avaliador diz que o DONO paga, e a do dono segue falando com o dono", async () => {
  const { FRASE_DONO_PAGA_AVALIACAO, FRASE_PAGA_AVALIACAO } = await import("../vistoria/regras.ts");
  assert.equal(FRASE_DONO_PAGA_AVALIACAO, "O dono paga a avaliação, não o resultado: o seu laudo é independente.");
  assert.equal(FRASE_PAGA_AVALIACAO, "Você paga a avaliação, não o resultado.");
});
