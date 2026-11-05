/*
  E449 — três fluxos paralelos para falar com a Viva: (i) o botão flutuante abre "Chat com a Viva"; (ii) dentro dele,
  "Falar com uma pessoa" abria um MINI-formulário de chamado (form-pessoa); (iii) "Abrir chamado" em
  /ajuda/fale-com-a-viva abre OUTRO formulário, completo. O E539 (#2643) já uniu o (ii) e o (iii) DENTRO da página; fora
  dela (o chat flutuante em qualquer tela) o mini-formulário seguia. Correção (fluxo/rota única): "Falar com uma pessoa"
  do chat flutuante leva à página Fale com a Viva (?doChat=1#abrir-chamado), que abre o MESMO formulário da Central com
  a conversa anexada (a conversa já fica no sessionStorage do chat). O mini-formulário sai.
  Roda: node --test src/lib/atendimento/e449-chamado-unico.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HREF_CHAMADO_DO_CHAT } from "./viva-chat-texto.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("a rota única do chamado vindo do chat", () => {
  assert.equal(HREF_CHAMADO_DO_CHAT, "/ajuda/fale-com-a-viva?doChat=1#abrir-chamado");
});

test("o chat flutuante leva ao formulário único; o mini-formulário saiu", () => {
  const chat = ler("components/ajuda/viva-chat.tsx");
  assert.match(chat, /else window\.location\.assign\(HREF_CHAMADO_DO_CHAT\);/);
  assert.doesNotMatch(chat, /function FormPessoa|data-testid="form-pessoa"|setPessoa\(true\)/);
});

test("a página abre o mesmo formulário da Central com a conversa guardada pelo chat", () => {
  const c = ler("components/ajuda/central-ajuda.tsx");
  assert.match(c, /if \(p\.get\("doChat"\) === "1"\) \{/);
  assert.match(c, /setConversa\(conversaGuardadaDoChat\(\)\);\s*setAba\("novo"\);/);
});
