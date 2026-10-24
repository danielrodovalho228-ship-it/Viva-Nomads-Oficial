/*
  Detecção-A — a tela das sugestões das fotos (Entrega 3). Roda: node --test src/lib/fotos/deteccao-a.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const SUG = ler("components/niveis/sugestoes-fotos.tsx");

test("'Encontramos isto numa foto sua' com 'Usar esta foto' e 'Não é isso'", () => {
  assert.match(SUG, />Encontramos isto numa foto sua</);
  assert.match(SUG, /Usar esta foto/);
  assert.match(SUG, /Não é isso/);
  assert.doesNotMatch(SUG, />\s*Confirmar\s*</);
});

test("'Olhando suas fotos…' à vista enquanto analisa; com erro, o bloco some (estado nulo)", () => {
  assert.match(SUG, /Olhando suas fotos…/);
  assert.match(SUG, /catch \{[\s\S]{0,140}if \(vivo\) aplicar\(null\);/);
  assert.match(SUG, /if \(!propertyId \|\| !estado\?\.ligada\) \{\s*return analisando \? <Analisando \/> : null;/);
});

test("alerta do topo: o que falta foto, com 'Enviar foto' para a lista do nível; só com a chave ligada", () => {
  assert.match(SUG, /export function AlertaFaltaFoto/);
  assert.match(SUG, /if \(itens\.length === 0\) return null;/);
  assert.match(SUG, /href="#nivel-cadastro-falta"[\s\S]{0,400}Enviar foto/);
  const nivel = ler("components/niveis/nivel-cadastro.tsx");
  assert.match(nivel, /id="nivel-cadastro-falta"/);
  assert.match(nivel, /g\.itens\.filter\(\(i\) => i\.prova === "foto"\)/);
  const pagina = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(pagina, /\{deteccaoLigada && <AlertaFaltaFoto itens=\{faltaFoto\} \/>\}\s*<EtapaEncontramos parte="comodidades"/);
});

test("comodidade achada e ainda não marcada: tracejada, com 'Confirme'; tocar marca", () => {
  const grade = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-encontramos.tsx");
  assert.match(grade, /const detectada = !on && !!p\.detectadas\?\.includes\(it\.key\);/);
  assert.match(grade, /detectada \? "border-dashed border-forest bg-white text-forest"/);
  assert.match(grade, /Confirme/);
});
