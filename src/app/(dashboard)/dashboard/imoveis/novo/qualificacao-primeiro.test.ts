/* Roda: node --test "src/app/(dashboard)/dashboard/imoveis/novo/qualificacao-primeiro.test.ts" — E180 (qualificação primeiro). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pagina = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const qual = readFileSync(new URL("./qualificacao.tsx", import.meta.url), "utf8");

test("o rascunho anterior não esconde a Qualificação de um anúncio novo", () => {
  const cond = pagina.slice(pagina.indexOf("const mostrarQualificacao ="), pagina.indexOf("/** Responder:"));
  assert.doesNotMatch(cond, /existingDraft|draftBannerDismissed/);
});

test("o aviso de retomar mora dentro da Qualificação, com 'Continuar de onde parei'", () => {
  assert.match(pagina, /<Qualificacao\s+aviso=\{avisoRascunho\}/);
  assert.match(pagina, /data-testid="rascunho-continuar" onClick=\{continuarDeOndeParei\}>\s*Continuar de onde parei/);
  assert.match(qual, /\{p\.aviso && <div className="mt-4">\{p\.aviso\}<\/div>\}/);
});

test("E208: sair da Qualificação fecha a faixa do rascunho antigo; o fluxo mostra o estado do novo", () => {
  const q = pagina.slice(pagina.indexOf("<Qualificacao"), pagina.indexOf("ocupado={abrindoCadastro}"));
  for (const h of ["onResponderDepois", "onComecar", "onVerNoCadastro"]) {
    const corpo = q.slice(q.indexOf(h), q.indexOf("}}", q.indexOf(h)));
    assert.match(corpo, /setDraftBannerDismissed\(true\)/, h);
  }
  assert.match(pagina, /saveStatus === "idle" \? \(\s*"Anúncio novo"/);
});

test("E180 (uso real, 28/10): a cópia local do rascunho nunca se aplica sozinha num anúncio novo", () => {
  const entrada = pagina.slice(pagina.indexOf("const aplicarLocal = () => {"), pagina.indexOf("getLatestDraft()"));
  // Só com `?etapa=` (retomada explícita) a cópia local é aplicada; sem ela, vira a oferta do aviso.
  assert.match(entrada, /if \(etapaParam !== null\) \{[\s\S]*?aplicarDraft\(JSON\.parse\(local\)\)[\s\S]*?return;\s*\}/);
  assert.match(entrada, /setRascunhoLocal\(d\)/);
  assert.equal((entrada.match(/aplicarDraft\(/g) ?? []).length, 1);
  // A retomada é o clique em "Continuar de onde parei".
  const continuar = pagina.slice(pagina.indexOf("function continuarDeOndeParei()"), pagina.indexOf("const avisoRascunho ="));
  assert.match(continuar, /aplicarDraft\(rascunhoLocal\)/);
  // A Qualificação não depende do rascunho local.
  const cond = pagina.slice(pagina.indexOf("const mostrarQualificacao ="), pagina.indexOf("/** Responder:"));
  assert.doesNotMatch(cond, /rascunhoLocal/);
});

test("E180: uma saída só — o 'Sair' da Qualificação sempre termina em Meus imóveis, mesmo se a gravação falhar", () => {
  const sair = pagina.slice(pagina.indexOf("onSalvarESair={async () => {"), pagina.indexOf("ocupado={abrindoCadastro}"));
  assert.match(sair, /finally \{\s*router\.push\(HREF_SAIR_ASSISTENTE\);/);
  assert.match(sair, /Promise\.race\(\[rascunhoDaQualificacao\("pendente"\)/);
  const moldura = readFileSync(new URL("../../../../../components/layout/moldura-assistente.tsx", import.meta.url), "utf8");
  assert.match(moldura, /export const HREF_SAIR_ASSISTENTE = "\/dashboard\/imoveis\?saiu=assistente";/);
  assert.match(moldura, /href=\{HREF_SAIR_ASSISTENTE\}/);
});
