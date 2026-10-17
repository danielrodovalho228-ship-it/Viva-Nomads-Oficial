import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FOTOS_PARCERIA } from "./parceiros-cartoes.ts";

test("#b6621ca2: 5 cartões de parceria, sem foto repetida, alt em português", () => {
  assert.equal(FOTOS_PARCERIA.length, 5);
  assert.equal(new Set(FOTOS_PARCERIA.map((c) => c.foto)).size, 5);
  for (const c of FOTOS_PARCERIA) {
    assert.equal(c.foto, `/images/unicas/parceiros-${c.id}.webp`);
    assert.ok(c.alt.length > 15, `alt curto em ${c.id}`);
  }
});

test("#b6621ca2: fotoPronta só é true quando o arquivo existe em public/", () => {
  for (const c of FOTOS_PARCERIA.filter((c) => c.fotoPronta)) {
    assert.ok(existsSync(join("public", c.foto)), `falta ${c.foto}`);
  }
});

test("#b6621ca2: grade de 6 colunas fecha 3 cartões de 2 + 2 de 3, sem buraco", () => {
  const soma = FOTOS_PARCERIA.map((c) => Number(/lg:col-span-(\d)/.exec(c.classeGrade)?.[1])).reduce((a, b) => a + b, 0);
  assert.equal(soma, 12);
  assert.deepEqual(FOTOS_PARCERIA.map((c) => /lg:col-span-(\d)/.exec(c.classeGrade)?.[1]), ["2", "2", "2", "3", "3"]);
});

test("#4615cfb8: alt de 'empresas' diz 'imóvel mobiliado' e o 5º cartão ocupa a linha toda", () => {
  const empresas = FOTOS_PARCERIA.find((c) => c.id === "empresas")!;
  assert.match(empresas.alt, /imóvel mobiliado/);
  assert.doesNotMatch(empresas.alt, /apartamento/);
  assert.match(FOTOS_PARCERIA.find((c) => c.id === "seguros")!.classeGrade, /sm:col-span-2/);
});
