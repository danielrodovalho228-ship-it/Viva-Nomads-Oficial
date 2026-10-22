/* Roda: node --test src/lib/onboarding/vazios.test.ts — Prompt 43: estado vazio = frase + próximo passo. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { VAZIOS_ONBOARDING } from "./vazios.ts";

const PROIBIDO = /bem-vindo à sua jornada|vamos começar|aventura|incr[ií]vel|perfeito para você|desbloqueie|oops|algo deu errado|✨|🚀|aluguel|vistoria|apartamento/i;

test("cada estado vazio diz o que acontece aqui e o próximo passo concreto", () => {
  for (const [k, v] of Object.entries(VAZIOS_ONBOARDING)) {
    assert.match(v.frase, /^Aqui /, `${k}: começa dizendo o que aparece aqui`);
    assert.ok(v.frase.length <= 120, `${k}: frase curta`);
    assert.doesNotMatch(v.frase + v.acao.rotulo, PROIBIDO, `${k}: sem texto proibido`);
    assert.match(v.acao.href, /^\//, `${k}: botão leva a uma tela da Viva`);
    assert.ok(v.acao.rotulo.split(" ").length <= 5, `${k}: botão curto`);
  }
});
