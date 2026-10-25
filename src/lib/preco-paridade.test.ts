/*
  Prompt 47 (adendo, Daniel 21/10): TOTAL DO CARTÃO = TOTAL DO FECHAMENTO. Para 6 imóveis da massa de teste e
  durações de 1, 3 e 6 meses, o total do cartão, da página do imóvel, do rodapé fixo e do fechamento são iguais ao
  centavo — todos saem de rotuloPreco. E a varredura: toda tela de preço de imóvel usa rotuloPreco.
  Roda: node --test src/lib/preco-paridade.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { calcularTotalMensal, calcularTudoIncluido, mensalDoFechamento, precoDoFechamento, primeiroPagamentoDoPreco } from "./precos.ts";
import { rotuloPreco, textoPreco } from "./cartao-preco.ts";
import { barraFixaImovel } from "./barra-fixa-imovel.ts";

test("6 imóveis × 1/3/6 meses: cartão = página = rodapé fixo = fechamento, ao centavo", () => {
  const imoveis = SAMPLE_PROPERTIES.filter((p) => p.monthlyPrice > 0).slice(0, 6);
  assert.equal(imoveis.length, 6);
  for (const p of imoveis) {
    for (const meses of [1, 3, 6]) {
      const cartao = rotuloPreco({ mensal: calcularTudoIncluido(p).total, meses });
      const pagina = rotuloPreco({ mensal: calcularTotalMensal(p).total, meses });
      const fechamento = rotuloPreco({ mensal: mensalDoFechamento(p, null), meses });
      const barra = barraFixaImovel({ monthlyPrice: p.monthlyPrice, totalMensal: calcularTotalMensal(p).total, meses, exemplo: false, candidatouSe: false });
      assert.equal(pagina.total, cartao.total, `${p.id} ${meses}m: página`);
      assert.equal(fechamento.total, cartao.total, `${p.id} ${meses}m: fechamento`);
      assert.equal(barra.mes, cartao.mes, `${p.id} ${meses}m: rodapé (mês)`);
      assert.equal(barra.estadia, cartao.estadia, `${p.id} ${meses}m: rodapé (período)`);
      assert.equal(textoPreco(pagina), textoPreco(cartao));
    }
  }
});

test("fechamento com proposta aceita: o preço DA PROPOSTA (não o valor acordado somado aos extras atuais do anúncio)", () => {
  // PROP-2 (substitui a regra do Prompt 47 para proposta aceita): caso real da proposta 301a58ca — R$ 3.200 + consumo
  // R$ 200, 4 meses, preparação R$ 450; o anúncio tem pacote de limpeza de R$ 180 que NÃO entrou na proposta.
  const p = { ...(SAMPLE_PROPERTIES.find((x) => (x.condoFee ?? 0) > 0) ?? SAMPLE_PROPERTIES[0]), monthlyPrice: 3500, limpezaEstadia: { valorMes: 180, porMes: 2 } } as (typeof SAMPLE_PROPERTIES)[number];
  const acordo = { valorMensal: 3200, meses: 4, termos: { condominio: 0, consumo: 200, limpezasMes: 0, valorLimpeza: 0, taxaPet: 0, limpezaUnica: 450 } };
  const f = precoDoFechamento(p, acordo, 4);
  assert.equal(f.totalPorMes, 3400);
  assert.equal(f.totalContrato, 14050);
  assert.equal(f.conta?.replace(/\u00a0/g, " "), "4 × R$ 3.400 + limpeza de preparação R$ 450 = R$ 14.050");
  assert.equal(primeiroPagamentoDoPreco(f), 3850);
  assert.notEqual(f.totalPorMes, mensalDoFechamento(p, 3200), "a mistura antiga (acordado + extras do anúncio) não vale mais");
  // Sem proposta: o anúncio, igual ao cartão.
  assert.equal(precoDoFechamento(p, null, 3).totalPorMes, calcularTudoIncluido(p).total);
  assert.equal(mensalDoFechamento(p, 0), calcularTudoIncluido(p).total, "sem acordo, o anúncio");
});

const SRC = new URL("../", import.meta.url).pathname;
function arquivos(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(join(SRC, dir))) {
    const rel = join(dir, f);
    if (statSync(join(SRC, rel)).isDirectory()) arquivos(rel, out);
    else if (rel.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

test("varredura: as telas de preço de imóvel usam rotuloPreco", () => {
  const superficies = [
    "components/property-card.tsx",
    "components/busca/card-pin-mapa.tsx",
    "components/property/price-card.tsx",
    "components/property-mini-card.tsx",
    "components/dashboard/property-row.tsx",
    "app/(dashboard)/dashboard/imoveis/imoveis-client.tsx",
    "app/(dashboard)/dashboard/comparar/page.tsx",
    "app/(dashboard)/dashboard/pedidos/pedidos-client.tsx",
    "app/(dashboard)/dashboard/fechamento/closing-flow.tsx",
    "app/(public)/imoveis/[id]/opengraph-image.tsx",
  ];
  for (const f of superficies) assert.match(readFileSync(join(SRC, f), "utf8"), /rotuloPreco\(/, f);
  for (const f of ["lib/barra-fixa-imovel.ts", "lib/busca/alerta-busca.ts"]) assert.match(readFileSync(join(SRC, f), "utf8"), /rotuloPreco\(/, f);
});

test("varredura: nenhuma tela monta 'R$ X/mês' do imóvel à mão (formatBRL(monthlyPrice) + '/mês')", () => {
  const manual = /formatBRL\([^()]*(?:monthlyPrice|monthly_price)[^()]*\)\s*\}?\s*(?:<span[^>]*>)?\s*\/mês/;
  const achados: string[] = [];
  for (const dir of ["app", "components"]) {
    for (const f of arquivos(dir)) {
      if (f.startsWith("app/(dashboard)/admin/")) continue; // telas internas da equipe
      const t = readFileSync(join(SRC, f), "utf8").replace(/\n\s*/g, " ");
      if (manual.test(t)) achados.push(f);
    }
  }
  assert.deepEqual(achados, []);
});
