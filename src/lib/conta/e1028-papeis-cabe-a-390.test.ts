import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOTAO_PARCEIRO_ATIVO, BOTAO_QUERO_PARCEIRO } from "./tela-papeis.ts";
import { BOTAO_PARCERIA_APROVADA } from "../parceiros/situacao-conta.ts";

/**
 * E1028 (Gerente, ORDEM-DUET-129, 18/11/2026; era o D-V9 das varreduras) — Conta › Papéis estourava a 390 px.
 *
 * O botão de um cartão de papel nunca quebra o texto (regra dos botões). Ele morava na coluna do conteúdo, ao lado da
 * foto: a 390 px essa coluna tem 214 px (358 da tela útil − 32 do recuo do cartão − 96 da foto − 16 do espaço).
 * "Abrir meu painel de parceiro" pede 243 px e "Parceria aprovada — ativar sua página" pede 312 px. O cartão não
 * cabia, a grelha da tela alargava para ele e a página inteira ganhava rolagem lateral (403 e 472 px numa tela de 390).
 *
 * A correção é de estrutura: no celular o botão desce para uma linha própria, na largura toda do cartão (326 px), e a
 * grelha da tela deixa de alargar por causa de um filho. A prova de tela é o t1691; aqui fica presa a estrutura.
 */
const tela = readFileSync(new URL("../../components/account/tela-papeis.tsx", import.meta.url), "utf8");
const cartao = tela.slice(tela.indexOf("function CartaoPapel("));

test("o cartão de papel tem um lugar próprio para o botão, fora da coluna estreita do conteúdo", () => {
  assert.match(cartao, /function CartaoPapel\(\{ id, foto, ativo, acao, children \}/, "o cartão recebe a ação à parte");
  // No celular a ação ocupa as duas colunas (a foto e o conteúdo); do sm para cima volta para a coluna do conteúdo.
  assert.match(cartao, /data-testid=\{`papel-\$\{id\}-acao`\}/);
  assert.match(cartao, /className="col-span-2 mt-3 sm:col-span-1 sm:col-start-2"/);
});

test("o cartão é uma grelha em que o conteúdo pode encolher: nenhuma coluna alarga por causa do que tem dentro", () => {
  assert.match(cartao, /grid grid-cols-\[6rem_minmax\(0,1fr\)\]/);
  assert.match(cartao, /sm:grid-cols-\[11rem_minmax\(0,1fr\)\]/);
});

test("a grelha da tela não alarga por causa de um cartão", () => {
  assert.match(tela, /<div className="grid grid-cols-\[minmax\(0,1fr\)\] gap-4" data-testid="tela-papeis">/);
});

test("os dois botões entram pela ação do cartão, não pelo conteúdo", () => {
  assert.match(tela, /<CartaoPapel id="anunciar" foto=\{PHOTOS\.papeis\.anunciar\} ativo=\{anunciar\} acao=\{botaoAnunciar\}>/);
  assert.match(tela, /<CartaoPapel id="parceiro" foto=\{PHOTOS\.papeis\.parceiro\} ativo=\{parceiro\} acao=\{botaoParceiro\}>/);
  assert.match(tela, /const botaoAnunciar = \(\s+<ButtonLink href="\/dashboard\/imoveis\/novo" size="lg" className=\{BOTAO_DO_CARTAO\} data-testid="papel-comecar-anuncio">/);
  assert.match(tela, /const botaoParceiro = \(\s+<ButtonLink href=\{HREF_ATIVAR_PARCERIA\} size="lg" className=\{BOTAO_DO_CARTAO\} data-testid="papel-parceiro-botao">/);
  // Dentro dos cartões (entre a abertura e o fecho) não fica nenhum botão: só o que entra por `acao`.
  for (const id of ["anunciar", "parceiro"]) {
    const abre = tela.indexOf(`<CartaoPapel id="${id}"`);
    const miolo = tela.slice(abre, tela.indexOf("</CartaoPapel>", abre));
    assert.doesNotMatch(miolo, /<ButtonLink/, `${id}: botão dentro do conteúdo do cartão`);
  }
});

test("os rótulos do botão de parceiro são os três de sempre (a tela é medida com cada um no t1691)", () => {
  assert.equal(BOTAO_QUERO_PARCEIRO, "Cadastrar meu serviço");
  assert.equal(BOTAO_PARCEIRO_ATIVO, "Abrir meu painel de parceiro");
  assert.equal(BOTAO_PARCERIA_APROVADA, "Parceria aprovada — ativar sua página");
});
