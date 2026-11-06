/* Roda: node --test src/components/anuncio/e193-passos-8-9-um-padrao.test.ts
  E193 (reteste de 29/10), classe B: faixas de prazo, garantias, "o que pode ser negociado" e limite de limpezas no cartão grande. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("E193: nenhum arquivo do assistente de cadastro usa Pilula (só o proximidades manuais, fora do assistente)", () => {
  for (const a of [
    "src/app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx",
    "src/components/anuncio/blocos-cadastro.tsx",
    "src/components/anuncio/chegada-e-pedido-campos.tsx",
    "src/app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx",
  ]) assert.doesNotMatch(ler(a), /<Pilula\b|\bPilula\b.*from/, a);
});

test("E193: faixas e garantias (Passo 8/9) são CartaoEscolha pressed em grade; cartão desligado sem arredondado de pílula", () => {
  const e = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx");
  assert.match(e, /<CartaoEscolha papel="pressed" on=\{!!p\.faixas\[f\.key\]\}/);
  assert.match(e, /<CartaoEscolha papel="pressed" on=\{!!p\.garantias\[g\.key\]\}/);
  assert.match(e, /grid gap-2 sm:grid-cols-2/);
  assert.doesNotMatch(e, /inline-flex min-h-11 items-center gap-3 rounded-full/);
});

test("E193: negociável e limite de limpezas em cartões, mantendo os testid que as specs usam", () => {
  const b = ler("src/components/anuncio/blocos-cadastro.tsx");
  assert.match(b, /<CartaoEscolha\s+key=\{i\.chave\}[\s\S]{0,400}testid=\{`negociavel-\$\{i\.chave\}`\}/);
  assert.match(b, /<CartaoEscolha key=\{o\.r\}[\s\S]{0,400}limite-limpezas-\$\{o\.v \?\? "sem"\}/);
});
