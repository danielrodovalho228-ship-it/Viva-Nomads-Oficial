import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PROXIMO_PASSO_CANDIDATURA, ROTULOS_CANDIDATURA } from "./candidaturas/status.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("E313 (devolução): item final ímpar na 1ª coluna, alinhado à esquerda — nunca centrado nem esticado", () => {
  const src = ler("components/property/amenities-grid.tsx");
  assert.doesNotMatch(src, /justify-center|col-span-2/);
  assert.match(src, /const ITEM_DA_GRADE = "flex items-center gap-3 text-sm justify-start";/);
  assert.equal((src.match(/\$\{ITEM_DA_GRADE\}/g) ?? []).length, 2);
  assert.doesNotMatch(ler("components/property/workspace-section.tsx"), /odd:last:(col-span-2|justify-center)/);
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
