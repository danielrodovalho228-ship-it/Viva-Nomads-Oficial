/*
  E840 — "Excluir conta" com dois destinos e dois rótulos conforme a página. Regra: um rótulo só ("Excluir conta") e o
  destino pelo contexto — deslogado → /excluir-conta (a página pública, exigida pelas lojas); logado → a tela da conta
  (/dashboard/conta/excluir, "Sair da Viva"). Família E839 (moldura).
  Roda: node --test src/lib/conta/e840-excluir-conta.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DESTINO_EXCLUIR_CONTA_LOGADO, DESTINO_EXCLUIR_CONTA_PUBLICO, ROTULO_EXCLUIR_CONTA, destinoExcluirConta } from "./excluir-conta.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("um rótulo e o destino pelo contexto", () => {
  assert.equal(ROTULO_EXCLUIR_CONTA, "Excluir conta");
  assert.equal(destinoExcluirConta(false), "/excluir-conta");
  assert.equal(destinoExcluirConta(true), "/dashboard/conta/excluir");
  assert.equal(DESTINO_EXCLUIR_CONTA_PUBLICO, "/excluir-conta");
  assert.equal(DESTINO_EXCLUIR_CONTA_LOGADO, "/dashboard/conta/excluir");
});

test("o rodapé usa o link de contexto (nunca um destino fixo)", () => {
  const rodape = ler("src/components/layout/footer.tsx");
  assert.match(rodape, /<ExcluirContaNoRodape \/>/);
  assert.doesNotMatch(rodape, /href="\/excluir-conta"/);
  const link = ler("src/components/layout/excluir-conta-no-rodape.tsx");
  assert.match(link, /destinoExcluirConta\(logado\)/);
  assert.match(link, /\{ROTULO_EXCLUIR_CONTA\}/);
});

test("a tela de Privacidade da conta diz o mesmo rótulo e vai para a tela da conta", () => {
  const tela = ler("src/components/account/tela-privacidade.tsx");
  assert.match(tela, /href=\{DESTINO_EXCLUIR_CONTA_LOGADO\}/);
  assert.match(tela, /\{ROTULO_EXCLUIR_CONTA\}/);
  assert.doesNotMatch(tela, /Excluir minha conta\s*</);
});

test("a página pública ensina o caminho real no app e abre a tela da conta", () => {
  const pagina = ler("src/app/(public)/excluir-conta/page.tsx");
  assert.match(pagina, /Conta → Privacidade → \{ROTULO_EXCLUIR_CONTA\}/);
  assert.match(pagina, /href=\{DESTINO_EXCLUIR_CONTA_LOGADO\}/);
});
