/*
  Achado nº 20 (erros/estados vazios) — o calendário do dono lia as estadias e, na falha, engolia o erro: os dias
  ocupados por um contrato apareciam livres, sem aviso. Agora a leitura LANÇA com `exigir` e a tela avisa, com
  "Tentar de novo" (o mesmo botão dos bloqueios).
  Roda: node --test src/lib/data/achado20-calendario-estadias.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("a leitura das estadias do calendário lança na falha quando a tela exige", () => {
  const f = ler("src/lib/data/estadias-calendario.ts");
  assert.match(f, /export async function getEstadiasDoImovel\(propertyId: string, opcoes: \{ exigir\?: boolean \} = \{\}\)/);
  assert.match(f, /if \(error && opcoes\.exigir\) throw new Error\(/);
});

test("o calendário pede exigir, avisa a falha e oferece tentar de novo", () => {
  const c = ler("src/components/property/block-calendar.tsx");
  assert.match(c, /getEstadiasDoImovel\(propertyId, \{ exigir: true \}\)/);
  assert.doesNotMatch(c, /getEstadiasDoImovel\(propertyId\)[\s\S]{0,80}\.catch\(\(\) => \{\}\)/);
  assert.match(c, /if \(vivo\) setEstadiasFalhou\(true\)/);
  assert.match(c, /data-testid="estadias-calendario-erro"[\s\S]{0,200}os dias ocupados podem não aparecer/);
  assert.match(c, /setEstadiasFalhou\(false\);/);
});
