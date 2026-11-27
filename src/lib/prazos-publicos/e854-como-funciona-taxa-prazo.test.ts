import { test } from "node:test";
import assert from "node:assert/strict";
import { fonte } from "./ler.ts";

/* E854: /como-funciona nomeia a taxa como as superfícies irmãs (escada única) e, onde fala de resposta da Viva, o prazo do
   canal (atendimento, pela fonte do atendimento). */
const pagina = fonte("src/app/(public)/como-funciona/page.tsx");

test("a taxa do proprietário vem da escada única (FRASE_ESCADA_TAXAS), como em /para-proprietarios", () => {
  assert.match(pagina, /data-testid="cf-taxa-proprietario"[\s\S]{0,300}\{FRASE_ESCADA_TAXAS\}/);
});

test("a linha de dúvidas leva à Fale com a Viva com o prazo do atendimento (PROMESSA_ATENDIMENTO)", () => {
  assert.match(pagina, /data-testid="cf-prazo-resposta"[\s\S]{0,300}PROMESSA_ATENDIMENTO/);
  assert.match(pagina, /href="\/ajuda\/fale-com-a-viva"/);
});
