// E718 — /para-proprietarios completa os 3 blocos que faltavam do mockup publico-proprietarios (decisão do Daniel, 08/11).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const s = readFileSync("src/app/(public)/para-proprietarios/page.tsx", "utf8");

test("E718: os três blocos do mockup estão na página, com as portas certas", () => {
  assert.match(s, /Pedidos de moradia da sua cidade chegam até você/);
  assert.match(s, /href="\/dashboard\/pedidos-cidade"/);
  assert.match(s, /Publicamos para você/);
  assert.match(s, /AVISO_SEM_CUSTO/);
  assert.match(s, /Simulador de rentabilidade/);
  assert.match(s, /href="\/dashboard\/simulador"[\s\S]*Calcular rentabilidade/);
});

test("E718: nenhum valor de exemplo no simulador da página (E294: nada preenchido pela Viva)", () => {
  const bloco = s.slice(s.indexOf('data-testid="proprietarios-simulador"'), s.indexOf("Quanto custa, em reais"));
  assert.doesNotMatch(bloco, /R\$\s*\d/);
});

test("E718: um botão cheio por tela continua valendo (os três blocos usam secundário ou o branco do bloco verde)", () => {
  const blocos = s.slice(s.indexOf('data-testid="proprietarios-blocos-mockup"'), s.indexOf("Quanto custa, em reais"));
  assert.doesNotMatch(blocos, /variant="primary"/);
});

test("t112: /para-proprietarios não repete a mesma imagem decorativa na página (a imagem do bloco 'Publicamos para você' saiu)", () => {
  const s = readFileSync(new URL("../app/(public)/para-proprietarios/page.tsx", import.meta.url), "utf8");
  const usos = [...s.matchAll(/\/images\/unicas\/[\w-]+\.webp/g)].map((m) => m[0]);
  const vistos = new Set<string>();
  const repetidas = usos.filter((u) => (vistos.has(u) ? true : (vistos.add(u), false)));
  assert.deepEqual(repetidas, []);
});
