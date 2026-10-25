/* Roda: node --test src/lib/anunciar-barra-fotos.test.ts — Anunciar imóvel (celular), E107 (QA do Muse): a faixa fixa
   "Fotos: N de 8" saiu. Ela vazava para os passos 1 e 3–10 e, no Passo 2, repetia o contador da página. As fotos têm
   uma fonte só: o Passo 2, com o contador e o envio dele. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ler = (p: string) => readFileSync(join("src", p), "utf8");
const NOVO = "app/(dashboard)/dashboard/imoveis/novo";

test("E107: a barra fixa de fotos não existe mais (nem o componente, nem o uso, nem o CSS)", () => {
  assert.equal(existsSync(join("src", NOVO, "barra-fotos.tsx")), false);
  const pagina = ler(`${NOVO}/page.tsx`);
  assert.doesNotMatch(pagina, /BarraFotos|barra-fotos|enviandoFotos|erroEnvioFotos/);
  const css = ler("app/globals.css");
  assert.doesNotMatch(css, /vn-barra-fotos|vn-respiro-barra-fotos|altura-barra-fotos|data-testid="barra-fotos"/);
  assert.doesNotMatch(ler("components/layout/moldura-assistente.tsx"), /altura-barra-fotos/);
});

test("E107: as fotos moram só no Passo 2 (uma fonte do contador e do envio)", () => {
  const pagina = ler(`${NOVO}/page.tsx`);
  assert.equal((pagina.match(/<EtapaFotos\b/g) ?? []).length, 1);
  assert.match(pagina, /\{step === ETAPA\.fotos && \(\s*<EtapaFotos /);
});
