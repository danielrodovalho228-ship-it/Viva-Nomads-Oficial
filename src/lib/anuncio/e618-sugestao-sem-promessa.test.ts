/*
  E618: no Passo 7, título e descrição diziam "Escrevendo uma sugestão..." no próprio campo, e nenhuma sugestão chegava —
  o campo ficava vazio com a promessa pendurada. Duas causas: (1) desde o E613 a sugestão vai para um cartão à parte,
  nunca para o campo (o placeholder prometia o que não acontece); (2) o pedido à IA não tinha tempo máximo — se a
  resposta não volta, o estado fica "carregando" para sempre e o texto pronto (modelo fixo) nunca entra.
  Roda: node --test src/lib/anuncio/e618-sugestao-sem-promessa.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEMPO_MAX_SUGESTAO_MS, TEXTO_PREPARANDO_SUGESTAO } from "./texto-sugerido.ts";

const DIR = "../../app/(dashboard)/dashboard/imoveis/novo/";
const ler = (f: string) => readFileSync(new URL(DIR + f, import.meta.url), "utf8");

test("E618: os campos não prometem sugestão (o placeholder é sempre o exemplo)", () => {
  const tela = ler("etapa-encontramos.tsx");
  assert.doesNotMatch(tela, /Escrevendo uma sugestão/);
  assert.match(tela, /placeholder="Ex\.: Studio mobiliado no Centro"/);
  assert.match(tela, /placeholder="Descreva o imóvel…"/);
  // o aviso de que a sugestão está a caminho fica junto do cartão, como status
  assert.match(tela, /data-testid="sugestao-preparando"/);
  assert.match(tela, /TEXTO_PREPARANDO_SUGESTAO/);
  assert.doesNotMatch(TEXTO_PREPARANDO_SUGESTAO, /Escrevendo/);
});

test("E618: o pedido à IA tem tempo máximo e, passado, entra o texto pronto", () => {
  assert.ok(TEMPO_MAX_SUGESTAO_MS > 0 && TEMPO_MAX_SUGESTAO_MS <= 20_000);
  const pagina = ler("page.tsx");
  const corpo = pagina.slice(pagina.indexOf("async function pedirSugestao"), pagina.indexOf("function usarSugestao"));
  assert.match(corpo, /signal: AbortSignal\.timeout\(TEMPO_MAX_SUGESTAO_MS\)/);
  assert.match(corpo, /if \(!texto\) texto = textoDoModelo\(dados\)/);
});
