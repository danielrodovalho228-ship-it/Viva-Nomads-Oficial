/* Roda: node --test src/lib/anuncio/salvo-fantasma.test.ts — E516: abrir o assistente não carimba "Salvo às". */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { conteudoDoRascunho, decisaoAutosave, salvoAsDoRascunho } from "./salvo-fantasma.ts";

const json = (o: Record<string, unknown>) => JSON.stringify(o);

test("abrir: o estado aplicado do rascunho vira a base (não grava nem carimba)", () => {
  assert.equal(decisaoAutosave({ aguardandoBase: true, base: null, conteudo: "x" }), "base");
});

test("editar logo depois de abrir (ainda na janela da base) conta como edição, não é engolido", () => {
  assert.equal(decisaoAutosave({ aguardandoBase: true, editou: true, base: null, conteudo: "x" }), "edicao");
  const s = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  assert.match(s, /onInputCapture=\{\(\) => \{\s*editouRef\.current = true;/);
  assert.match(s, /if \(!editouRef\.current\) \{\s*\/\/ O estado do rascunho aberto assentou/);
});

test("navegar entre passos sem editar: grava em silêncio (o etapaMax segue salvo, sem 'Salvo às')", () => {
  const a = conteudoDoRascunho(json({ title: "Casa", step: 2, etapaMax: 2, ordemEtapas: 3 }));
  const b = conteudoDoRascunho(json({ title: "Casa", step: 5, etapaMax: 5, ordemEtapas: 3 }));
  assert.equal(a, b);
  assert.equal(decisaoAutosave({ aguardandoBase: false, base: a, conteudo: b }), "silencioso");
});

test("editar o conteúdo: grava e mostra 'Salvo às'", () => {
  const a = conteudoDoRascunho(json({ title: "Casa", step: 2 }));
  const b = conteudoDoRascunho(json({ title: "Casa azul", step: 2 }));
  assert.equal(decisaoAutosave({ aguardandoBase: false, base: a, conteudo: b }), "edicao");
  // Anúncio novo (sem rascunho aberto): a 1ª mudança é edição.
  assert.equal(decisaoAutosave({ aguardandoBase: false, base: null, conteudo: b }), "edicao");
});

test("assistente: aplicar o rascunho arma a base; só a edição mostra 'Salvando…' e carimba a hora", () => {
  const s = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  const aplicar = s.slice(s.indexOf("function aplicarDraft("), s.indexOf("function aplicarDraft(") + 400);
  assert.match(aplicar, /aguardandoBaseRef\.current = true;/);
  const efeito = s.slice(s.indexOf("// Auto-save do rascunho"), s.indexOf("// Limites privados do rascunho"));
  assert.match(efeito, /decisaoAutosave\(/);
  assert.match(efeito, /if \(decisao === "edicao"\) setSaveStatus\("saving"\);/);
  assert.match(efeito, /if \(decisao === "edicao"\) \{\s*setSaveStatus\("saved"\);\s*setSavedAt\(/);
});

// E614 (i): reaberto o rascunho, o "Continuar" antes de o estado assentar (2 s) mudava o passo e não gravava nada —
// o passo retomado não persistia. A navegação nesse meio-tempo grava em silêncio, como a confirmação.
test("E614 retomar: navegar logo depois de abrir grava o passo em silêncio (não vira base)", () => {
  assert.equal(decisaoAutosave({ aguardandoBase: true, navegou: true, base: null, conteudo: "x" }), "silencioso");
  assert.equal(decisaoAutosave({ aguardandoBase: true, navegou: false, base: null, conteudo: "x" }), "base");
  assert.equal(decisaoAutosave({ aguardandoBase: true, navegou: true, editou: true, base: null, conteudo: "x" }), "edicao");
});

// E614 (ii) / regra do Gerente (DUET-1719): o rascunho retomado mostra sempre "Salvo às HH:MM" da última gravação.
test("E614 retomar: a hora da última gravação vem do rascunho, em HH:MM", () => {
  assert.equal(salvoAsDoRascunho({ salvoEm: "2026-11-18T13:07:40.000Z" }, "America/Sao_Paulo"), "10:07");
  assert.equal(salvoAsDoRascunho({}, "America/Sao_Paulo"), null);
  assert.equal(salvoAsDoRascunho({ salvoEm: "não é data" }, "America/Sao_Paulo"), null);
});

test("E614 retomar: toda gravação carimba salvoEm; reabrir mostra 'Salvo às' sem edição", () => {
  const s = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  const efeito = s.slice(s.indexOf("// Auto-save do rascunho"), s.indexOf("// Limites privados do rascunho"));
  assert.match(efeito, /salvoEm: new Date\(\)\.toISOString\(\)/);
  const aplicar = s.slice(s.indexOf("function aplicarDraft("), s.indexOf("const draftIdRef"));
  assert.match(aplicar, /salvoAsDoRascunho\(d\)/);
});
