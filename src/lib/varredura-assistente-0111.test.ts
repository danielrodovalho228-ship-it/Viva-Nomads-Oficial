import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("grade-par: utilitário da casa — a última casa ímpar ocupa a linha inteira", () => {
  const css = ler("app/globals.css");
  assert.match(css, /@utility grade-par \{\s*& > :last-child:nth-child\(odd\) \{\s*grid-column: 1 \/ -1;/);
});

test("assistente do anúncio: grades de opções com grade-par (comodidades, trabalho, regras, chácara, edição)", () => {
  const usos: [string, number][] = [
    ["app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx", 1],
    ["app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx", 1],
    ["components/anuncio/blocos-cadastro.tsx", 2],
    ["components/anuncio/estrutura-acessibilidade.tsx", 1],
    ["components/anuncio/chegada-e-pedido-campos.tsx", 2],
    ["components/anuncio/campos-chacara.tsx", 2],
  ];
  for (const [arq, n] of usos) assert.equal((ler(arq).match(/grade-par /g) ?? []).length, n, arq);
});

test("Passo Preço: 'Duração máxima' (2 opções) em 2 colunas, sem casas vazias", () => {
  assert.match(ler("app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx"), /grid grid-cols-2 gap-2" role="radiogroup" aria-label="Duração máxima"/);
});

test("Verificação: o nome de reserva é 'Morador'", () => {
  assert.match(ler("app/(dashboard)/dashboard/verificacao/page.tsx"), /user\?\.fullName \?\? "Morador"/);
});
