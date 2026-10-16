/*
  Ordem ec7988fe (item 1): checklist do painel compacto (no máximo 3 itens visíveis).
  node --test (sem alias @).
*/
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

import { itensDoChecklist, MAX_ITENS_COMPACTO } from "./checklist-compacto.ts";

const item = (key: string, ok: boolean) => ({ key, label: key, ok, href: `/${key}` });

test("compacto: mostra só os primeiros pendentes, no máximo 3", () => {
  const itens = [item("a", true), item("b", false), item("c", false), item("d", false), item("e", false), item("f", true)];
  const r = itensDoChecklist(itens, false);
  assert.equal(MAX_ITENS_COMPACTO, 3);
  assert.deepEqual(r.visiveis.map((i) => i.key), ["b", "c", "d"]);
  assert.equal(r.ocultos, 3);
});

test("compacto: poucos pendentes não escondem nada pendente", () => {
  const r = itensDoChecklist([item("a", true), item("b", false)], false);
  assert.deepEqual(r.visiveis.map((i) => i.key), ["b"]);
  assert.equal(r.ocultos, 1);
});

test("expandido: mostra tudo, na ordem original", () => {
  const itens = [item("a", true), item("b", false), item("c", false), item("d", false), item("e", false)];
  const r = itensDoChecklist(itens, true);
  assert.deepEqual(r.visiveis.map((i) => i.key), ["a", "b", "c", "d", "e"]);
  assert.equal(r.ocultos, 0);
});

test("o painel usa o checklist compacto e a capa 3S (PageTitle), não o banner antigo", () => {
  const src = readFileSync(new URL("../../app/(dashboard)/dashboard/visao-geral-client.tsx", import.meta.url), "utf8");
  assert.match(src, /itensDoChecklist\(/);
  assert.match(src, /checklist-ver-todos/);
  assert.match(src, /<PageTitle[\s\S]{0,200}capa=/);
  assert.doesNotMatch(src, /<DashboardBanner/);
});
