/*
  L2-A, itens 9 e 24. Roda: node --test src/lib/anuncio/l2a-itens-9-24.test.ts
   9 (D-V5): anúncio publicado nunca diz "Falta para publicar"; o que está em aberto vira "Para melhorar o anúncio";
     o checklist de publicar é só do rascunho.
   24: o campo do preço é "Valor mensal (sem condomínio e contas)" e, embaixo, "No anúncio: R$ X/mês tudo incluído", pelo
     mesmo cálculo do cartão e da busca (calcularTudoIncluido) — na edição e no passo Preço do cadastro.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calcularTudoIncluido } from "../precos.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const EDITAR = ler("app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
const PRECO = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx");

test("9: 'Falta para publicar' só no rascunho; publicado mostra 'Para melhorar o anúncio'", () => {
  assert.match(EDITAR, /\{!comp\.podePublicar && !publicado && \(\s*<p[^>]*>Falta para publicar:/);
  assert.match(EDITAR, /\{publicado && comp\.faltam\.length > 0 && \([\s\S]{0,200}Para melhorar o anúncio: \{comp\.faltam\.join/);
  // A lista de "Meus imóveis" já só mostra o checklist no rascunho.
  assert.match(ler("app/(dashboard)/dashboard/imoveis/imoveis-client.tsx"), /\{!demoItem && comp && !imovelPublicado\(p\) && \(/);
});

test("24: rótulo do valor mensal e a linha 'No anúncio' na edição e no cadastro", () => {
  for (const f of [EDITAR, PRECO]) {
    assert.match(f, /Valor mensal \(sem condomínio e contas\)/);
    assert.match(f, /No anúncio:/);
    assert.match(f, /\/mês tudo incluído/);
    assert.match(f, /calcularTudoIncluido\(/);
    assert.doesNotMatch(f, /label="Valor mensal \(R\$/);
  }
});

test("24: o total do anúncio soma aluguel, condomínio, consumo fixo e limpeza (fonte única)", () => {
  assert.equal(calcularTudoIncluido({ monthlyPrice: 2800, condoFee: 450, utilitiesMode: "real", utilitiesEstimate: 300 }).total, 3250);
  assert.equal(calcularTudoIncluido({ monthlyPrice: 2800, condoFee: 450, utilitiesMode: "fixed", utilitiesEstimate: 300 }).total, 3550);
  assert.equal(calcularTudoIncluido({ monthlyPrice: 2800, condoFee: 0, utilitiesMode: "real", utilitiesEstimate: 0, limpezaEstadia: { porMes: 2, inclui: "", valorMes: 200 } }).total, 3000);
});
