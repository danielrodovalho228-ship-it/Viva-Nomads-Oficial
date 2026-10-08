/*
  Regra: a Viva Nomads só emite nota do que ela vende (assinatura e comissão,
  para o proprietário). O aluguel é do proprietário: recibo, não nota da Viva;
  o inquilino não paga nada à Viva. Nenhuma tela pública promete o contrário.
  Roda: node --test src/lib/nota-fiscal-textos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("/empresas: recibo do aluguel em nome do proprietário, sem nota da Viva para a empresa", () => {
  const s = ler("app/(public)/empresas/page.tsx");
  assert.match(s, /Recibo mensal do aluguel em nome do proprietário \+ contrato assinado, aceitos para reembolso\. A Viva Nomads não cobra nada do inquilino\./);
  assert.doesNotMatch(s, /nota fiscal/i);
});

test("busca: filtro 'Com Nota Fiscal' só com a chave do selo (SELO_NF_UI)", () => {
  const s = ler("app/(public)/buscar/search-client.tsx");
  assert.match(s, /\{SELO_NF_UI && \(\s*<Chip on=\{invoiceOnly\}/);
  assert.match(s, /SELO_NF_UI && on\("nota"\)/);
  assert.match(s, /SELO_NF_UI && invoiceOnly && <ActiveChip/);
});

test("editor: interruptor 'emite Nota Fiscal do aluguel' só com a chave do selo", () => {
  const s = ler("app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  const i = s.indexOf("Este imóvel emite Nota Fiscal do aluguel");
  assert.ok(i > 0);
  assert.ok(s.lastIndexOf("{SELO_NF_UI && (", i) > s.lastIndexOf("</Labeled>", i), "interruptor fora da chave");
});

test("/precos: sem card nem promessa de 'Nota fiscal dos serviços' (#23)", () => {
  const s = ler("app/(public)/precos/page.tsx");
  assert.doesNotMatch(s, /nota fiscal|\bNF\b|NFSE_ATIVA|Receipt/i);
});
