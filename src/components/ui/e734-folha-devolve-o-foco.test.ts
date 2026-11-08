// E734 (QA, C17 — WCAG 2.4.3): fechar "Mais filtros" com Esc mandava o foco para "Pular para o conteúdo principal". A folha
// (BottomSheet) agora guarda o elemento que a abriu e devolve o foco a ele ao fechar. T-C17 da QA: abrir "Mais filtros" pelo
// teclado, apertar Esc e conferir que o `document.activeElement` é `[data-testid=pilula-mais]`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/components/ui/bottom-sheet.tsx", "utf8");

test("E734: o BottomSheet guarda quem abriu e devolve o foco a ele ao desmontar o efeito (Esc, fundo, X, aplicar)", () => {
  assert.match(s, /const abridor = document\.activeElement instanceof HTMLElement && document\.activeElement !== document\.body \? document\.activeElement : null;/);
  assert.match(s, /if \(abridor && abridor\.isConnected\) abridor\.focus\(\);/);
  // o abridor é lido ANTES do foco inicial no painel (senão guardaria o próprio painel)
  assert.ok(s.indexOf("const abridor") < s.indexOf("panelRef.current?.focus()"), "abridor guardado antes de focar o painel");
});

test("E734: a folha de filtros da busca usa o BottomSheet (a correção vale para ela) e o botão tem o marcador da QA", () => {
  const folha = readFileSync("src/components/busca/painel-filtros-celular.tsx", "utf8");
  assert.match(folha, /<BottomSheet/);
  const pilulas = readFileSync("src/components/busca/barra-pilulas.tsx", "utf8");
  assert.match(pilulas, /pilula-mais/);
});
