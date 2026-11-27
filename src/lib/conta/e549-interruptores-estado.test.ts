/**
 * E549 (chat principal, 04/11): em /dashboard/notificacoes os 7 interruptores de "Tipos de aviso" e "Canais" ficavam
 * como ovais vazios — o trilho de carregamento, que só sai quando as três leituras pedidas DO NAVEGADOR (ações de
 * servidor, em fila) voltam. O "Som dos avisos" e a Privacidade mostravam o estado. Agora a página lê as preferências
 * NO SERVIDOR e a tela já nasce com o estado (ligado/desligado) desenhado; o navegador só relê em "Tentar de novo".
 * `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tiposDeDesligadas, TIPOS_AVISO } from "./tela-notificacoes.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("tiposDeDesligadas: ligado = fora da lista de desligadas", () => {
  assert.deepEqual(tiposDeDesligadas([]), { mensagens: true, lembretes: true, outros: true, sugestoes: true });
  assert.deepEqual(tiposDeDesligadas(["sugestoes", "outros"]), { mensagens: true, lembretes: true, outros: false, sugestoes: false });
  assert.deepEqual(Object.keys(tiposDeDesligadas([])).sort(), TIPOS_AVISO.map((t) => t.categoria).sort());
});

test("a página lê as preferências no servidor e passa para a tela", () => {
  const pg = ler("app/(dashboard)/dashboard/notificacoes/page.tsx");
  assert.match(pg, /getCategoriasDesligadas\(\)/);
  assert.match(pg, /getCanais\(\)/);
  assert.match(pg, /<TelaNotificacoes inicial=\{inicial\} \/>/);
});

test("a tela nasce com o estado da página (sem trilho) e só relê no navegador sem ele ou em 'Tentar de novo'", () => {
  const tela = ler("components/account/tela-notificacoes.tsx");
  assert.match(tela, /useState<Tipos \| null>\(inicial \? tiposDeDesligadas\(inicial\.desligadas\) : null\)/);
  assert.match(tela, /useState<CanaisAviso \| null>\(inicial\?\.canais \?\? null\)/);
  assert.match(tela, /if \(inicial && tentativa === 0\) return;/);
});
