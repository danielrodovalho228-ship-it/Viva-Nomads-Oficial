/*
  Avaliador, "Encerradas, recusas e ausências": a lista vazia diz o que vai aparecer ali, no lugar de "Nada por aqui ainda.".
  Roda: node --test src/lib/painel/vazio-avaliacao-historico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGINA = readFileSync(new URL("../../app/(dashboard)/dashboard/parceiro/avaliacao/page.tsx", import.meta.url), "utf8");

test("o histórico vazio explica o que entra nele, com testid", () => {
  assert.doesNotMatch(PAGINA, /Nada por aqui ainda\./);
  assert.match(PAGINA, /data-testid="avaliacoes-historico-vazio"/);
  assert.match(PAGINA, /avaliações que você concluiu, as que recusou, as que passaram de 24 horas sem resposta e as ausências registradas/);
  // Os três rótulos do histórico continuam os mesmos que o texto descreve.
  assert.match(PAGINA, /recusada: "Você recusou", expirada: "Sem resposta em 24 horas", ausencia: "Ausência registrada"/);
});
