/*
  E539 (iii) — família E449: a página Fale com a Viva tinha DOIS formulários de chamado: o mini "Falar com uma pessoa"
  dentro do chat e o "Abrir chamado" completo da Central, logo abaixo. Correção: nesta página fica UM formulário, o
  da Central. "Falar com uma pessoa" no chat da página não abre formulário próprio: entrega a conversa ao "Abrir
  chamado", que a anexa ao chamado (pedido de pessoa, como antes). O botão flutuante das outras telas, que não têm a
  Central, segue com o formulário curto dele.
  Roda: node --test src/components/ajuda/e539-um-formulario-chamado.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ASSUNTO_CHAMADO_DO_CHAT, mensagemDoChamado, transcricaoChat, type MsgChat } from "../../lib/atendimento/viva-chat-texto.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const conversa: MsgChat[] = [
  { role: "user", content: "Como funciona a Caução?" },
  { role: "assistant", content: "É um valor guardado durante a estadia." },
];

test("a mensagem do chamado leva a conversa quando ela veio do chat", () => {
  assert.equal(mensagemDoChamado(conversa, "Quero falar com alguém"), transcricaoChat(conversa, "Quero falar com alguém"));
  assert.equal(mensagemDoChamado(null, "  Meu pedido  "), "Meu pedido");
  assert.equal(mensagemDoChamado([], "  Meu pedido  "), "Meu pedido");
  assert.equal(ASSUNTO_CHAMADO_DO_CHAT, "Conversa com a Viva (chat do site)");
});

test("no chat da página, 'Falar com uma pessoa' entrega a conversa à Central (sem formulário próprio)", () => {
  const chat = ler("components/ajuda/viva-chat.tsx");
  assert.match(chat, /<PainelChat altura="h-\[420px\]" semPromessa entregarPessoa \/>/);
  assert.match(chat, /if \(entregarPessoa\) window\.dispatchEvent\(new CustomEvent\(EVENTO_FALAR_COM_PESSOA, \{ detail: \{ conversa: msgs \} \}\)\);\s*(?:\/\/.*\n\s*)*else window\.location\.assign\(HREF_CHAMADO_DO_CHAT\);/); // E449: fora da página, a rota única
});

test("a Central abre o 'Abrir chamado' com a conversa anexada e pede uma pessoa", () => {
  const central = ler("components/ajuda/central-ajuda.tsx");
  assert.match(central, /window\.addEventListener\(EVENTO_FALAR_COM_PESSOA, /);
  assert.match(central, /conversa=\{conversa\}/);
  assert.match(central, /mensagem: mensagemDoChamado\(conversa, mensagem\)/);
  assert.match(central, /pedePessoa: conversa \? true : undefined/);
  assert.match(central, /data-testid="chamado-conversa-anexada"/);
});

test("a página Fale com a Viva tem o chat e UMA Central (um formulário de chamado)", () => {
  const pagina = ler("app/(public)/ajuda/fale-com-a-viva/page.tsx");
  assert.equal((pagina.match(/<VivaChatBloco\b/g) ?? []).length, 1);
  assert.equal((pagina.match(/<CentralAjuda\b/g) ?? []).length, 1);
});
