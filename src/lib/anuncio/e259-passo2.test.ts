/* Roda: node --test src/lib/anuncio/e259-passo2.test.ts — E259 (3)(4) (prova de publicação do QA, 30/10). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IA_LIMITE_DIA, mensagemLimitePreenchimento } from "../ai/anuncio-prompt.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("(3) a contagem do Passo 2 soma as fotos já concluídas no envio", () => {
  const passo = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx");
  assert.match(passo, /const contadas = photos\.length \+ enviadas;/);
  assert.match(passo, /onProgresso=\{\(p\) => setEnviadas\(p\?\.feitas \?\? 0\)\}/);
  assert.match(passo, /<span data-testid="fotos-contagem-numero">\{contadas\}<\/span> \/ \{MIN_PHOTOS\} fotos/);
  const up = ler("src/components/photo-uploader.tsx");
  assert.match(up, /onProgresso\?\.\(\{ feitas, total \}\);/);
  assert.match(up, /onProgresso\?\.\(null\);/);
});

test("(4) o limite diz o que parou (o preenchimento) e o que continua (as comodidades do Passo 5)", () => {
  const m = mensagemLimitePreenchimento(IA_LIMITE_DIA);
  assert.match(m, /^Limite de 10 preenchimentos automáticos por dia atingido/);
  assert.match(m, /As comodidades vistas nas fotos continuam aparecendo no Passo 5\./);
  assert.doesNotMatch(m, /análises por dia/);
  // A detecção do Passo 5 tem limite próprio (não usa o do preenchimento).
  const det = ler("src/lib/data/deteccao-actions.ts");
  assert.match(det, /consumirLimite\(`deteccao:anuncio:\$\{propertyId\}`/);
  assert.doesNotMatch(det, /ia:user:/);
  assert.match(ler("src/app/api/ai/fotos/route.ts"), /falha\("limite", 429, mensagemLimitePreenchimento\(IA_LIMITE_DIA\)\)/);
});
