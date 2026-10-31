/* Roda: node --test src/components/ui/voltar-lista.test.ts — E176-IMPL (parte logada): o padrão ÚNICO de voltar. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(p, "utf8");

test("E176: as telas de detalhe logadas usam o MESMO voltar '← <lista>' no topo (estadia = contrato = Fechamento = visita)", () => {
  const telas: [string, RegExp][] = [
    // A estadia leva à lista do papel: o dono a Contratos (como o detalhe do contrato), o morador a Minhas estadias.
    ["src/app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx", /<VoltarLista href="\/dashboard\/contratos" rotulo="Contratos" \/> : <VoltarLista href="\/dashboard\/locacoes" rotulo="Minhas estadias" \/>/],
    ["src/components/contrato/contrato-detalhe.tsx", /<VoltarLista href=\{voltarHref\} rotulo=\{voltarRotulo\} \/>/],
    ["src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx", /<VoltarLista href="\/dashboard\/leads" rotulo="Interessados" \/>/],
    ["src/app/(dashboard)/dashboard/visitas/[id]/page.tsx", /<VoltarLista href=/],
  ];
  for (const [arq, re] of telas) {
    const f = ler(arq);
    assert.match(f, re, arq);
    // Nenhum outro "Voltar" de texto na tela (o padrão é um só, no topo).
    assert.doesNotMatch(f.replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}|\/\/.*$/gm, ""), />\s*Voltar\b/, `${arq}: "Voltar" fora do padrão`);
  }
  // O componente é o "← <lista>" (sempre a lista de origem, nunca o histórico).
  const c = ler("src/components/ui/voltar-lista.tsx");
  assert.match(c, /<span aria-hidden>←<\/span> \{rotulo\}/);
  assert.doesNotMatch(c, /history\.back|router\.back/);
});
