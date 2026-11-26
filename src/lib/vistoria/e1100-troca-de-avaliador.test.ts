/*
  E1100 (ORDEM-DUET-465, classe A) — "Escolher outro avaliador" descartava o avaliador escolhido E a proposta viva num
  clique: sem confirmação, sem abrir a escolha, sem volta. A massa da fatia 4 morreu assim na ronda das 09:00 de 22/11.
  Regras travadas aqui:
   1. a confirmação diz, por escrito, o que se perde (o avaliador, a proposta com valor e prazo) e que não dá para desfazer;
   2. antes de confirmar, o dono sabe se há outro avaliador para escolher (com um só na cidade, o pedido fica aguardando);
   3. o servidor só descarta com a confirmação explícita (o clique antigo, sem ela, é recusado);
   4. depois da troca, a tela leva o dono à escolha do novo avaliador.
  Roda: node --test src/lib/vistoria/e1100-troca-de-avaliador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";
import {
  CAMPO_CONFIRMAR_TROCA,
  ERRO_TROCA_SEM_CONFIRMAR,
  ROTULO_CONFIRMAR_TROCA,
  ROTULO_ESCOLHER_OUTRO,
  ROTULO_MANTER_PROPOSTA,
  mensagemDepoisDaTroca,
  textoDaTroca,
  trocaConfirmada,
} from "./troca-de-avaliador.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E1100 (1): a confirmação escreve o que se perde — o avaliador, a proposta (valor e prazo) e que não dá para desfazer", () => {
  const t = textoDaTroca({ numero: "UDI-002", valor: "R$ 380,00", prazoDias: 5, outros: 2, cidade: "Uberlândia" });
  assert.equal(t.titulo, "Escolher outro avaliador?");
  assert.deepEqual(t.perde, [
    "O avaliador nº UDI-002 sai deste pedido e não volta a aparecer na lista.",
    "A proposta dele é descartada: R$ 380,00 · laudo em 5 dias.",
    "Não dá para desfazer.",
  ]);
  assert.equal(textoDaTroca({ numero: null, valor: "R$ 300,00", prazoDias: 1, outros: 2, cidade: null }).perde[0], "O avaliador escolhido sai deste pedido e não volta a aparecer na lista.");
  assert.equal(textoDaTroca({ numero: null, valor: "R$ 300,00", prazoDias: 1, outros: 2, cidade: null }).perde[1], "A proposta dele é descartada: R$ 300,00 · laudo em 1 dia.");
});

test("E1100 (2): antes de confirmar, o dono sabe quantos avaliadores sobram para escolher", () => {
  const base = { numero: "UDI-002", valor: "R$ 380,00", prazoDias: 5 };
  assert.deepEqual(
    { depois: textoDaTroca({ ...base, outros: 3, cidade: "Uberlândia" }).depois, semOutro: textoDaTroca({ ...base, outros: 3, cidade: "Uberlândia" }).semOutro },
    { depois: "Depois, você escolhe entre os 3 avaliadores disponíveis em Uberlândia.", semOutro: false },
  );
  assert.equal(textoDaTroca({ ...base, outros: 1, cidade: "Uberlândia" }).depois, "Depois, você escolhe o novo avaliador: há 1 disponível em Uberlândia.");
  assert.equal(textoDaTroca({ ...base, outros: 2, cidade: null }).depois, "Depois, você escolhe entre os 2 avaliadores disponíveis.");
  // O caso que matou a massa da fatia 4: um só avaliador na cidade. O aviso vem ANTES do clique.
  const sem = textoDaTroca({ ...base, outros: 0, cidade: "Uberlândia" });
  assert.equal(sem.semOutro, true);
  assert.equal(sem.depois, "Atenção: não há outro avaliador disponível em Uberlândia agora. Se você descartar, o pedido fica aguardando e a equipe da Viva é avisada."); // E1177 (asserção alterada, ORDEM-DUET-778): sem a promessa do aviso
  // A leitura falhou: não se inventa número.
  const nulo = textoDaTroca({ ...base, outros: null, cidade: "Uberlândia" });
  assert.equal(nulo.depois, "Depois, você escolhe o novo avaliador na lista.");
  assert.equal(nulo.semOutro, false);
});

test("E1100 (3): só a confirmação explícita descarta — o servidor recusa o clique sem ela", () => {
  assert.equal(CAMPO_CONFIRMAR_TROCA, "confirmar");
  const com = new FormData();
  com.set("confirmar", "1");
  assert.equal(trocaConfirmada(com), true);
  assert.equal(trocaConfirmada(new FormData()), false);
  const errado = new FormData();
  errado.set("confirmar", "0");
  assert.equal(trocaConfirmada(errado), false);
  assert.equal(ERRO_TROCA_SEM_CONFIRMAR, "Confirme a troca: você perde o avaliador escolhido e a proposta dele.");

  const act = semComentarios(ler("src/lib/vistoria/actions.ts"));
  const corpo = act.slice(act.indexOf("export async function recusarProposta("), act.indexOf("export async function agendarVisita("));
  assert.ok(corpo.length > 50, "achei a ação");
  const confere = corpo.indexOf("if (!trocaConfirmada(form)) return { ok: false, erro: ERRO_TROCA_SEM_CONFIRMAR }");
  const descarta = corpo.indexOf("devolverAoDono(");
  assert.ok(confere > 0, "a ação confere a confirmação");
  assert.ok(confere < descarta, "a confirmação é conferida ANTES de descartar");
});

test("E1100 (1 e 3): no bloco do dono, 'Escolher outro avaliador' não é mais um envio direto", () => {
  const b = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  assert.doesNotMatch(b, /<FormAcao acao=\{recusarProposta\}/, "o formulário de um clique saiu do bloco");
  assert.doesNotMatch(b, />Escolher outro avaliador<\/Button>/);
  assert.match(b, /<TrocaDeAvaliador\b/);
  assert.match(b, /outrosParaTroca\(/, "o bloco lê quantos avaliadores sobram antes do clique");

  const c = semComentarios(ler("src/components/vistoria/troca-de-avaliador.tsx"));
  assert.match(c, /^"use client";/);
  // O primeiro botão só abre a confirmação (type="button"); o envio fica dentro dela, com o campo da confirmação.
  assert.match(c, /type="button"[^>]*data-testid="trocar-avaliador"|data-testid="trocar-avaliador"[^>]*type="button"/);
  assert.match(c, /name=\{CAMPO_CONFIRMAR_TROCA\} value="1"/);
  assert.match(c, /\{ROTULO_CONFIRMAR_TROCA\}/);
  assert.match(c, /\{ROTULO_MANTER_PROPOSTA\}/);
  assert.equal(ROTULO_ESCOLHER_OUTRO, "Escolher outro avaliador");
  assert.equal(ROTULO_CONFIRMAR_TROCA, "Descartar e escolher outro");
  assert.equal(ROTULO_MANTER_PROPOSTA, "Manter esta proposta");
});

test("E1100 (4): depois da troca, a tela diz o que aconteceu e leva à escolha do novo avaliador", () => {
  assert.equal(mensagemDepoisDaTroca(false), "Avaliador e proposta descartados. Escolha o novo avaliador na lista abaixo.");
  assert.equal(mensagemDepoisDaTroca(true), "Avaliador e proposta descartados. Não há outro avaliador disponível agora. A equipe da Viva foi avisada."); // E1177 (asserção alterada, ORDEM-DUET-778)
  const b = semComentarios(ler("src/components/vistoria/bloco-avaliacao-dono.tsx"));
  assert.match(b, /atual\.status === "pedido" && <DepoisDaTroca\b/, "o aviso aparece quando o pedido voltou à escolha");
  const c = semComentarios(ler("src/components/vistoria/troca-de-avaliador.tsx"));
  assert.match(c, /export function DepoisDaTroca\b/);
  assert.match(c, /scrollIntoView\(/);
  assert.match(c, /\.focus\(/);
});

test("E1100: 'quantos sobram' usa a MESMA leitura da escolha (fonte única), sem mudar quem pode ser escolhido", () => {
  const s = semComentarios(ler("src/lib/vistoria/servidor.ts"));
  assert.match(s, /export async function outrosParaTroca\(/);
  const corpo = s.slice(s.indexOf("export async function outrosParaTroca("));
  assert.match(corpo.slice(0, 600), /leituraDaEscolha\(/);
});
