import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("B1: página da cidade fala 'morador', nunca 'inquilino'", () => {
  const c = ler("app/(public)/cidades/[cidade]/page.tsx");
  assert.match(c, /segurança para morador e proprietário/);
  assert.doesNotMatch(c, /segurança para inquilino/);
});

test("B2, B5, B6: grades pares nas listas de opções e cartões", () => {
  const ped = ler("app/(public)/pedidos/novo/page.tsx");
  assert.match(ped, /<div className="grid grid-cols-2 gap-2" data-testid="pedido-necessidades">/);
  assert.match(ped, /className="odd:last:col-span-2"/);
  assert.match(ler("app/(public)/guias/page.tsx"), /<li key=\{g\.slug\} className="sm:odd:last:col-span-2">/);
  assert.match(ler("components/property/stay-rules.tsx"), /sm:odd:last:col-span-2/);
});

test("B3, B4: um botão cheio por tela", () => {
  assert.match(ler("app/(public)/como-funciona/page.tsx"), /<ButtonLink href="\/pedidos\/novo" variant="outline"/);
  assert.match(ler("app/(public)/parceiros/fotografos/aviso-fotografo.tsx"), /linkEntrarParaAvisar\(voltarPara\)\} variant="secondary"/);
});
