import { test } from "node:test";
import assert from "node:assert/strict";
import { fonte } from "./ler.ts";

/* E876: o formulário "Fale com a gente" de /empresas declara o prazo do canal empresas (antes e depois de enviar), e as
   menções de 24 h ficam só no canal de atendimento, identificado e pela fonte do atendimento. */
test("o formulário de /empresas: depois de enviar, o prazo do canal empresas pela fonte única", () => {
  const form = fonte("src/app/(public)/empresas/empresas-form.tsx");
  assert.match(form, /from "@\/config\/prazos-canais"/);
  assert.match(form, /data-testid="empresas-form-prazo"[^>]*>[^<]*\{TEXTO_PRAZO_EMPRESAS\}/);
});

test("o chamado da Central de Ajuda fala das 24 h do ATENDIMENTO pela fonte do atendimento (sem número à mão)", () => {
  const central = fonte("src/components/ajuda/central-ajuda.tsx");
  const trecho = central.slice(central.indexOf('data-testid="chamado-conversa-anexada"'), central.indexOf('data-testid="chamado-conversa-anexada"') + 300);
  assert.match(trecho, /PROMESSA_HUMANA_H|frasePrazo/);
  assert.doesNotMatch(trecho, /até 24 h/);
});
