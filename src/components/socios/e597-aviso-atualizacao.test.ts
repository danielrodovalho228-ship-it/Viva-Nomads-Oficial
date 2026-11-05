/* Roda: node --test src/components/socios/e597-aviso-atualizacao.test.ts — E597: aviso de página em atualização. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { TEXTO_AVISO_ATUALIZACAO } from "../../lib/socios/aviso-atualizacao.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E597: o texto do aviso é exatamente o aprovado pelo coordenador", () => {
  assert.equal(TEXTO_AVISO_ATUALIZACAO, "Página em atualização com a decisão de 04/11 (Caminho B). Não usar como referência até a revisão.");
});

test("E597: o aviso fica no TOPO de /socios e de /decisao (antes da navegação e do conteúdo)", () => {
  for (const p of ["app/socios/page.tsx", "app/decisao/page.tsx"]) {
    const c = ler(p);
    const aviso = c.indexOf("<AvisoEmAtualizacao />");
    assert.ok(aviso > 0, `${p}: tem o aviso`);
    assert.ok(aviso < c.indexOf("<PaginasInternasNav"), `${p}: o aviso vem antes da navegação`);
  }
});

test("E597: o aviso é fixo no topo e bem visível; /simulacao não muda", () => {
  const comp = ler("components/socios/aviso-atualizacao.tsx");
  assert.match(comp, /sticky top-0/);
  assert.match(comp, /role="alert"/);
  assert.match(comp, /data-testid="aviso-em-atualizacao"/);
  for (const p of ["app/simulacao/page.tsx", "app/(public)/simulacao/page.tsx"]) if (existsSync(new URL(`../../${p}`, import.meta.url))) assert.doesNotMatch(ler(p), /AvisoEmAtualizacao/);
});
