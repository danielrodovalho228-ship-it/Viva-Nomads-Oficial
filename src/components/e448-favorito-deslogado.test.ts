/*
  E448 (QA público, 02/11) — na busca, o coração "Adicionar aos favoritos" ligava em silêncio SEM conta (Prompt 49:
  guardava no aparelho), enquanto o pedido de alinhamento é: deslogado → porta de login, como o "Salvar busca". Agora
  o coração do visitante leva à entrada com o motivo "favorito" e volta para a mesma página; nada é guardado sem conta.
  (A mescla dos favoritos que já estavam no aparelho continua: quem favoritou antes não perde nada ao entrar.)
  Roda: node --test src/components/e448-favorito-deslogado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { urlEntrada } from "../lib/auth/entrada.ts";

const coracao = readFileSync(new URL("./favorite-button.tsx", import.meta.url), "utf8");

test("deslogado: o coração vai para a porta de login (motivo favorito) e volta para a mesma página", () => {
  assert.match(coracao, /if \(!logado\) \{\s*window\.location\.assign\(urlEntrada\("favorito", window\.location\.pathname \+ window\.location\.search\)\);\s*return;\s*\}/);
  assert.match(urlEntrada("favorito", "/buscar?cidade=Uberl%C3%A2ndia"), /^\/auth\?/);
});

test("nada é guardado sem conta: o toggle só roda depois do portão", () => {
  const corpo = coracao.slice(coracao.indexOf("function handleClick"));
  assert.ok(corpo.indexOf("if (!logado)") < corpo.indexOf("toggle(propertyId)"), "o portão vem antes de alternar");
  assert.doesNotMatch(coracao, /armazenamentoDisponivel/);
});
