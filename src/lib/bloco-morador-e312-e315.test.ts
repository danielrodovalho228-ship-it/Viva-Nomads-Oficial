import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROXIMO_PASSO_CANDIDATURA, ROTULOS_CANDIDATURA } from "./candidaturas/status.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("E313: toda grade de comodidades fecha par — o último item de lista ímpar ocupa as duas colunas", () => {
  const src = ler("components/property/amenities-grid.tsx");
  assert.match(src, /const FECHA_GRADE = "odd:last:col-span-2 odd:last:justify-center";/);
  // Os dois tipos de item (tem e não tem) levam a regra.
  assert.equal((src.match(/\$\{FECHA_GRADE\}/g) ?? []).length >= 2, true);
  // A grade "Para trabalhar" da mesma página segue a mesma regra.
  assert.match(ler("components/property/workspace-section.tsx"), /odd:last:col-span-2/);
});

test("E314: o cartão 'Em análise' (e o 'Enviada') diz o que acontece agora e o próximo passo, com link", () => {
  for (const chave of ["em_analise", "enviada"] as const) {
    const p = PROXIMO_PASSO_CANDIDATURA[chave];
    assert.ok(p, `${chave} sem próximo passo`);
    assert.ok(p.agora.length > 10 && p.proximo.length > 10);
    assert.match(p.acao.href, /^\/dashboard\//);
  }
  assert.equal(PROXIMO_PASSO_CANDIDATURA.aceita, undefined, "o 'Aceita' já tem o seu passo (conversar e documentos)");
  assert.equal(ROTULOS_CANDIDATURA.em_analise.label, "Em análise");
  const pagina = ler("app/(dashboard)/dashboard/candidaturas/page.tsx");
  assert.match(pagina, /data-testid="candidatura-proximo-passo"/);
  // Vocabulário da casa nos textos.
  const textos = JSON.stringify(PROXIMO_PASSO_CANDIDATURA);
  assert.doesNotMatch(textos, /inquilino|hóspede|reserva|temporada/i);
});

test("E315: o detalhe da proposta mostra a validade sempre, com o rótulo da lista ('Validade:')", () => {
  const det = ler("app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  assert.match(det, /data-testid="proposta-validade"/);
  assert.match(det, /Validade: \{dataBR\(p\.validaAte\)\}/);
  assert.doesNotMatch(det, /estaAberta\(p\.status\) && \(\s*<p[^>]*>\s*<Clock/);
  const lista = ler("app/(dashboard)/dashboard/orcamentos/orcamentos-client.tsx");
  assert.match(lista, /Validade: \{dataBR\(p\.validaAte\)\}/);
});
