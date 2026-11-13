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

test("/empresas: recibo da estadia em nome do proprietário, sem nota da Viva para a empresa", () => {
  const s = ler("app/(public)/empresas/page.tsx");
  assert.match(s, /Recibo mensal da estadia emitido pelo proprietário \+ contrato assinado, que podem ser usados no reembolso conforme a política da sua empresa\. A Viva Nomads não cobra nada do morador\./);
  assert.doesNotMatch(s, /nota fiscal/i);
});

test("busca: filtro 'Emite nota fiscal' pela declaração do dono PJ/MEI (E574), sem a chave do selo antigo", () => {
  const s = ler("app/(public)/buscar/search-client.tsx") + ler("lib/busca/filtros-da-url.ts"); // E829: a leitura da URL mora em filtros-da-url.ts (o estado nasce dela)
  // E574 (decisão do Daniel, 04/11): o filtro vale para todos — só entra o dono PJ/MEI que declarou emitir nota da
  // locação (PF gera o Recibo de Locação e nunca entra). O selo antigo do cartão (issues_invoice) segue com SELO_NF_UI.
  assert.match(s, /notaOnly: invoiceOnly,/);
  assert.match(s, /invoiceOnly: on\("nota"\)/);
  assert.doesNotMatch(s, /SELO_NF_UI/);
  const folha = ler("components/busca/painel-filtros-celular.tsx");
  assert.match(folha, /<ChipFaceta f=\{facetaInterruptor\(contar, rascunho, "notaOnly"\)\} ativo=\{rascunho\.notaOnly\}/);
  assert.match(folha, /\{ROTULO_FILTRO_NOTA_LOCACAO\}/);
  assert.doesNotMatch(folha, /comNotaFiscal/);
});

test("editor: interruptor 'emite Nota Fiscal do valor mensal' só com a chave do selo", () => {
  const s = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx");
  const i = s.indexOf("Este imóvel emite Nota Fiscal do valor mensal");
  assert.ok(i > 0);
  assert.ok(s.lastIndexOf("{SELO_NF_UI && (", i) > s.lastIndexOf("</Labeled>", i), "interruptor fora da chave");
});

test("/precos: sem card nem promessa de 'Nota fiscal dos serviços' (#23)", () => {
  const s = ler("app/(public)/precos/page.tsx");
  assert.doesNotMatch(s, /nota fiscal|\bNF\b|NFSE_ATIVA|Receipt/i);
});
