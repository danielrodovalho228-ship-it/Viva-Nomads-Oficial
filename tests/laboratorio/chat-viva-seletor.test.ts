import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// O #1012 tirou a sombra dos balões do chat e quebrou t19/t42, que achavam a resposta pela classe.
// As specs agora usam o data-testid do balão; este teste impede a volta do seletor por classe.
test("chat da Viva: balões têm data-testid e as specs não dependem de classe de estilo", () => {
  const chat = readFileSync("src/components/ajuda/viva-chat.tsx", "utf8");
  assert.match(chat, /viva-chat-msg-viva/);
  for (const spec of ["t19-atendimento-online", "t42-contato-telefone"]) {
    const txt = readFileSync(`tests/e2e/specs/${spec}.spec.ts`, "utf8");
    assert.doesNotMatch(txt, /bg-white\.shadow-sm/, spec);
    assert.match(txt, /viva-chat-msg-viva/, spec);
  }
});
