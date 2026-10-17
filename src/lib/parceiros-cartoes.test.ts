import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FOTOS_PARCERIA } from "./parceiros-cartoes.ts";

test("prompt 14: 6 cartões de parceria (número par), fotos únicas, alt em português", () => {
  assert.equal(FOTOS_PARCERIA.length, 6);
  assert.equal(FOTOS_PARCERIA.length % 2, 0);
  assert.equal(new Set(FOTOS_PARCERIA.map((c) => c.foto)).size, 6);
  for (const c of FOTOS_PARCERIA) {
    assert.equal(c.foto, `/images/unicas/parceiros-${c.id}.webp`);
    assert.ok(c.alt.length > 15, `alt curto em ${c.id}`);
    assert.doesNotMatch(c.alt, /apartamento|hóspede/i);
  }
});

test("prompt 14: todo cartão com foto pronta e o arquivo existe em public/", () => {
  for (const c of FOTOS_PARCERIA) {
    assert.equal(c.fotoPronta, true, c.id);
    assert.ok(existsSync(join("public", c.foto)), `falta ${c.foto}`);
  }
});

test("prompt 14: grade 3 + 3 (6 colunas, todos col-span-2), 2 por linha no tablet", () => {
  for (const c of FOTOS_PARCERIA) {
    assert.match(c.classeGrade, /lg:col-span-2/);
    assert.match(c.classeGrade, /sm:col-span-1/);
  }
  const soma = FOTOS_PARCERIA.map((c) => Number(/lg:col-span-(\d)/.exec(c.classeGrade)?.[1])).reduce((a, b) => a + b, 0);
  assert.equal(soma, 12);
});
