/*
  Detecção-A — a tela das sugestões das fotos (Entrega 3). Roda: node --test src/lib/fotos/deteccao-a.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const SUG = ler("components/niveis/sugestoes-fotos.tsx");

test("'Encontramos isto numa foto sua' com 'Não é isso'; comodidade 'Confirmar' (FOTO-NA-HORA: nunca 'Usar esta foto')", () => {
  assert.match(SUG, />Encontramos isto numa foto sua</);
  assert.match(SUG, /Não é isso/);
  assert.doesNotMatch(SUG, /Usar esta foto|Descartar/);
  assert.match(SUG, /<ProvaNaHora/);
});

test("'Olhando suas fotos…' à vista enquanto analisa; com erro, o bloco some (estado nulo)", () => {
  assert.match(SUG, /Olhando suas fotos…/);
  assert.match(SUG, /catch \{[\s\S]{0,140}if \(vivo\) aplicar\(null\);/);
  assert.match(SUG, /if \(!propertyId \|\| !estado\?\.ligada\) \{\s*return analisando \? <Analisando \/> : null;/);
});

test("E141/E142: sem o 'Falta foto de' do topo (uma cobrança só, no nível); a detecção abre o passo", () => {
  assert.doesNotMatch(SUG, /AlertaFaltaFoto|Falta foto de/);
  const nivel = ler("components/niveis/nivel-cadastro.tsx");
  assert.match(nivel, /id="nivel-cadastro-falta"/);
  assert.doesNotMatch(nivel, /onFaltaFoto/);
  const pagina = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.doesNotMatch(pagina, /AlertaFaltaFoto/);
  assert.match(pagina, /\{step === ETAPA\.comodidades && \(\s*<div className="space-y-6">[\s\S]{0,600}<SugestoesDasFotos[\s\S]*?<EtapaEncontramos parte="comodidades"/);
});

test("comodidade achada e ainda não marcada: tracejada, com 'Confirme'; tocar marca", () => {
  const grade = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx");
  assert.match(grade, /const detectada = !on && !!p\.detectadas\?\.includes\(it\.key\);/);
  assert.match(grade, /detectada \? "border-dashed border-forest bg-white text-forest"/);
  assert.match(grade, /Confirme/);
});
