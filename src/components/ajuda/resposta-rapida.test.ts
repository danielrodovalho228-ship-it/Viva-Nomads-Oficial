/* Roda: node --test src/components/ajuda/resposta-rapida.test.ts — Prompt 43, item 9: ajuda em 3 níveis. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("resposta rápida usa a primeira frase da MESMA FAQ da Central e leva a /ajuda", () => {
  const src = readFileSync(new URL("./resposta-rapida.tsx", import.meta.url), "utf8");
  assert.match(src, /import \{ FAQ \} from "@\/lib\/atendimento\/faq"/);
  assert.match(src, /href="\/ajuda"/);
});

test("Falar com a Viva: terciário, com a promessa única, no fim das telas de decisão", () => {
  const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
  const comp = ler("components/ajuda/falar-com-a-viva.tsx");
  assert.match(comp, /data-testid="falar-com-a-viva"/);
  assert.match(comp, /PROMESSA_ATENDIMENTO/);
  for (const tela of [
    "app/(dashboard)/dashboard/propostas/[id]/page.tsx",
    "app/(dashboard)/dashboard/contratos/[id]/page.tsx",
    "app/(dashboard)/dashboard/locacoes/[id]/page.tsx",
    "app/(dashboard)/dashboard/pedidos/page.tsx",
    "app/(dashboard)/dashboard/servicos/pedidos/[id]/page.tsx",
    "app/(dashboard)/dashboard/fechamento/page.tsx",
    "app/(dashboard)/dashboard/verificacao/page.tsx",
    "app/(dashboard)/dashboard/conta/excluir/page.tsx",
  ])
    assert.match(ler(tela), /<FalarComAViva\b/, tela);
});
