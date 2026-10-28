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

test("o aviso de retomar mora dentro da Qualificação, com 'Continuar o outro'", () => {
  assert.match(pagina, /<Qualificacao\s+aviso=\{avisoRascunho\}/);
  assert.match(pagina, /mostrarQualificacao \? "Continuar o outro" : "Continuar"/);
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
