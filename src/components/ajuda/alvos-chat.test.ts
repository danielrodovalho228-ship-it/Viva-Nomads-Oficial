/* Roda: node --test src/components/ajuda/alvos-chat.test.ts — varredura 01/11 (Pista A): no chat da Viva
   (/ajuda/fale-com-a-viva) "Falar com uma pessoa" tinha 26 px, "Central de Ajuda" 16 px e a caixa de texto 40 px; no
   chamado, "Falar com uma pessoa" e "Sim, resolveu" tinham 32 px. Todos com alvo de toque de 44 px. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("./viva-chat.tsx", import.meta.url), "utf8");
const central = readFileSync(new URL("./central-ajuda.tsx", import.meta.url), "utf8");

test("rodapé do chat: botão, link e caixa de texto com 44 px", () => {
  assert.match(chat, /inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-semibold/);
  assert.match(chat, /<Link href="\/ajuda" className="inline-flex min-h-11 /);
  assert.match(chat, /max-h-28 min-h-11 flex-1/);
  assert.doesNotMatch(chat, /min-h-\[40px\]/);
});

test("botões do chamado com 44 px", () => {
  assert.equal((central.match(/inline-flex min-h-11 items-center gap-2 rounded-full border border-(forest|line) px-4 text-xs font-semibold/g) ?? []).length, 2);
});
