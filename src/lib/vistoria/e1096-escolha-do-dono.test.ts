/*
  E1096 (ORDEM-DUET-453) — a escolha do avaliador pelo dono conforme o mockup aprovado (dono-escolha-avaliador):
   1. o cartão ganha as estrelas de conduta e, sem avaliação nem nota, "Novo na Viva";
   2. "Identidade verificada pela Viva" aparece no cartão da escolha, só de quem tem a identidade confirmada (o fato). No
      perfil público a mesma frase é do E1099 (ORDEM-DUET-458/460); a constante é uma só;
   3. a frase do valor fica sob os cartões e fala como a tela do pedido do avaliador: a tabela da cidade é referência;
      o valor de cada avaliador vem depois de ele aceitar o pedido;
   4. o título é "Escolher avaliador" e o botão, "Escolher".
  Roda: node --test src/lib/vistoria/e1096-escolha-do-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTULO_ESCOLHER, TEXTO_IDENTIDADE_VERIFICADA, TITULO_ESCOLHA_AVALIADOR, TITULO_NOVO_NA_VIVA, fraseDoValorNaEscolha, reputacaoNoCartao } from "./vitrine-avaliadores.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E1096 (1): sem avaliação nem nota → cinco estrelas vazias e 'Novo na Viva'", () => {
  assert.deepEqual(reputacaoNoCartao(0, null), { novo: true, cheias: 0, texto: TITULO_NOVO_NA_VIVA });
  assert.equal(TITULO_NOVO_NA_VIVA, "Novo na Viva");
});

test("E1096 (1): com nota de conduta publicada → estrelas cheias pela nota e 'nota (N avaliações)'", () => {
  assert.deepEqual(reputacaoNoCartao(12, 4.9), { novo: false, cheias: 5, texto: "4,9 (12 avaliações)" });
  assert.deepEqual(reputacaoNoCartao(1, 4), { novo: false, cheias: 4, texto: "4,0 (1 avaliação)" });
  assert.deepEqual(reputacaoNoCartao(3, 3.4), { novo: false, cheias: 3, texto: "3,4 (3 avaliações)" });
  // Nota publicada sem contagem lida: conta pelo menos a avaliação que deu a nota (a mesma regra da linha de termos).
  assert.deepEqual(reputacaoNoCartao(0, 5), { novo: false, cheias: 5, texto: "5,0 (1 avaliação)" });
});

test("E1096 (1): avaliações feitas, ainda sem nota de conduta → estrelas vazias e só a contagem (não é 'Novo na Viva')", () => {
  assert.deepEqual(reputacaoNoCartao(2, null), { novo: false, cheias: 0, texto: "2 avaliações" });
});

test("E1096 (3): a frase do valor — a tabela é referência; o valor de cada avaliador vem depois de ele aceitar", () => {
  const f = fraseDoValorNaEscolha({ referencia: "R$ 350,00", min: "R$ 280,00", max: "R$ 420,00" });
  assert.equal(f, "Valor de referência da cidade: R$ 350,00 (faixa de R$ 280,00 a R$ 420,00). O valor e o prazo de cada avaliador aparecem depois que ele aceitar o pedido; você aceita ou escolhe outro.");
  assert.doesNotMatch(f, /define o próprio valor/);
});

test("E1096 (4): os textos do mockup — 'Escolher avaliador' e 'Escolher'", () => {
  assert.equal(TITULO_ESCOLHA_AVALIADOR, "Escolher avaliador");
  assert.equal(ROTULO_ESCOLHER, "Escolher");
});

test("E1096: o bloco do dono usa a fonte única (título, botão, estrelas e a frase sob os cartões)", () => {
  const b = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  assert.match(b, /data-testid="avaliacao-escolha-titulo">\{TITULO_ESCOLHA_AVALIADOR\}/);
  assert.match(b, />\{ROTULO_ESCOLHER\}<\/Button>/);
  assert.match(b, /aria-label=\{`\$\{ROTULO_ESCOLHER\} \$\{a\.nome\}`\}/, "cada botão diz quem escolhe (vários cartões na mesma tela)");
  assert.doesNotMatch(b, /Escolher este avaliador|Escolha o avaliador/);
  assert.match(b, /reputacaoNoCartao\(/);
  assert.match(b, /data-testid="avaliacao-sugerido-estrelas"/);
  assert.match(b, /data-testid="avaliacao-sugerido-reputacao"/);
  // A frase fica DEPOIS da lista de cartões (sob o cartão), não antes.
  assert.match(b, /fraseDoValorNaEscolha\(/);
  assert.ok(b.indexOf('data-testid="avaliacao-faixa"') > b.indexOf('data-testid="avaliacao-sugerido"'), "a frase do valor vem sob os cartões");
  assert.doesNotMatch(b, /Cada avaliador define o próprio valor e prazo/);
  // O preço do cartão continua a ser o da tabela da cidade (mockup), nunca o próprio do avaliador (E682).
  assert.match(b, /data-testid="avaliacao-sugerido-preco"[^>]*>\s*Avaliação: \{reaisCurtos\(Number\(preco\.valor\)\)\}/);
});

test("E1096 (2): 'Identidade verificada pela Viva' no cartão da escolha — a constante única, só com o fato da identidade confirmada", () => {
  assert.equal(TEXTO_IDENTIDADE_VERIFICADA, "Identidade verificada pela Viva");
  const b = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  assert.match(b, /a\.identidadeVerificada && \(/);
  assert.match(b, /data-testid="avaliacao-sugerido-identidade"[\s\S]{0,300}\{TEXTO_IDENTIDADE_VERIFICADA\}/);
  assert.doesNotMatch(b, /Identidade verificada pela Viva/, "o texto vem da constante; ninguém o duplica");
  const s = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  assert.match(s, /export async function identidadesConfirmadas\(/);
  assert.match(s, /e\.estado === "confirmada"/, "vem do fato (a identidade confirmada), nunca do status do credenciamento");
  // A constante existe uma vez só no código de produção.
  assert.equal((ler("src/lib/vistoria/vitrine-avaliadores.ts").match(/"Identidade verificada pela Viva"/g) ?? []).length, 1);
});
