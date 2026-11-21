/*
  E886: /parceiros prometia "A Viva responde por e-mail em até 7 dias" e a página de recrutamento de avaliadores
  (/parceiros/avaliadores) não prometia prazo nenhum, embora o pedido de credenciamento seja o mesmo formulário.
  As duas superfícies usam a MESMA constante (TEXTO_PRAZO_PARCERIA). Roda: node --test src/lib/parceiros/e886-avaliadores-prazo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_PRAZO_PARCERIA, DIAS_RESPOSTA_PARCERIA } from "./regras.ts";

const ler = (p: string) => readFileSync(new URL(`../../app/(public)/${p}`, import.meta.url), "utf8");
const avaliadores = ler("parceiros/avaliadores/page.tsx");
const parceiros = ler("parceiros/page.tsx");

test("E886: o prazo da resposta é um só (7 dias) e vem da constante", () => {
  assert.equal(DIAS_RESPOSTA_PARCERIA, 7);
  assert.equal(TEXTO_PRAZO_PARCERIA, "A Viva responde por e-mail em até 7 dias.");
});

test("E886: /parceiros e /parceiros/avaliadores mostram o mesmo TEXTO_PRAZO_PARCERIA", () => {
  for (const [nome, src] of [["parceiros", parceiros], ["avaliadores", avaliadores]] as const) {
    assert.match(src, /import \{[^}]*\bTEXTO_PRAZO_PARCERIA\b[^}]*\} from "@\/lib\/parceiros\/regras"/, nome);
    assert.match(src, /\{TEXTO_PRAZO_PARCERIA\}|\$\{TEXTO_PRAZO_PARCERIA\}/, nome);
  }
  assert.match(avaliadores, /data-testid="avaliadores-prazo-resposta"/);
});

test("E886: a página de avaliadores não escreve outro prazo de resposta à mão", () => {
  assert.doesNotMatch(avaliadores, /respond\w*[^.]{0,40}\b\d+\s*(dias|horas|h)\b/i);
});
