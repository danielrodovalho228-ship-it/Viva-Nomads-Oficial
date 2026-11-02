/*
  Estabilidade do cadastro (02/11, Pista A): um link que já diz o passo (?etapa=) abria no Passo 1 e só trocava depois
  de ler o rascunho — no celular, salto de layout de 0,33 (Endereço) a 0,78 (Revisão), e o Passo 1 aparecia por um
  instante. Agora o passo nasce da URL; edição (?id=) segue no Passo 1; com outro rascunho no servidor (sem ?draft=),
  o caminho de sempre (Passo 1 com a oferta de retomar).
  Roda: npm test
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { etapaDaUrl, ORDEM_ETAPAS } from "./etapas-anuncio.ts";
import { ETAPA } from "./anuncio/etapas-ids.ts";

const src = readFileSync(new URL("../app/(dashboard)/dashboard/imoveis/novo/page.tsx", import.meta.url), "utf8");

test("o passo inicial vem da URL (menos na edição)", () => {
  assert.match(src, /const paramsIniciais = useSearchParams\(\);\n\s*const \[step, setStep\] = useState<number>\(\(\) => \{\n\s*const e = etapaDaUrl\(paramsIniciais\.get\("etapa"\)\);\n\s*return e !== null && !paramsIniciais\.get\("id"\) \? e : ORDEM_ETAPAS\[0\];/);
});

test("com outro rascunho no servidor (sem ?draft=), volta ao Passo 1 como antes", () => {
  assert.match(src, /setExistingDraft\(\{ id: d\.id, pct: d\.prontidao\?\.pct \?\? 0 \}\);\n\s*setEntradaVerificada\(true\);\n[^\n]*\n\s*if \(etapaParam !== null\) setStep\(ORDEM_ETAPAS\[0\]\);/);
});

test("etapaDaUrl resolve nome e número (a base da inicialização)", () => {
  assert.equal(etapaDaUrl("preco"), ETAPA.preco);
  assert.equal(etapaDaUrl("revisao"), ETAPA.revisao);
  assert.equal(etapaDaUrl(null), null);
  assert.equal(etapaDaUrl("inexistente"), null);
  assert.ok(ORDEM_ETAPAS.includes(ETAPA.tipo));
});
