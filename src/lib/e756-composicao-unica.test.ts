/* Roda: node --test src/lib/e756-composicao-unica.test.ts
   E756 (reprovado ao vivo em 11/11): "R$ X em N meses" com regra diferente por superfície. No ube-001, o total de 1 mês do cartão
   e do detalhe (R$ 3.960) EXCLUÍA as limpezas de preparação e de saída que a conta da própria página soma (R$ 4.660); o de
   6 meses INCLUÍA; e a prévia da revisão do dono incluía a preparação já no 1º mês. Regra ÚNICA (a do E777/E254-A,
   estadiaDoImovel): total em N meses = N × total do mês + limpeza de preparação + limpeza de saída, para QUALQUER N — no
   cartão, no detalhe, na barra do celular, na prévia do dono e nos demais resumos; e o cartão mostra a conta. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "./properties.ts";
import { estadiaDoImovel } from "./precos.ts";
import { estadiaNoCartao } from "./cartao-estadia.ts";
import { precosDaPrevia } from "./anuncio/passo10-colunas.ts";
import { barraFixaImovel } from "./barra-fixa-imovel.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const imovel = (id: string) => SAMPLE_PROPERTIES.find((p) => p.id === id)!;
const SEM_NBSP = (s: string | null | undefined) => (s ?? "").replace(/ /g, " ");

test("ube-001/002/003, 1 e 6 meses: o cartão dá o MESMO total da página (com as limpezas) e mostra a conta", () => {
  for (const id of ["ube-001", "ube-002", "ube-003"]) {
    const p = imovel(id);
    for (const meses of [1, 6]) {
      const pagina = estadiaDoImovel(p, meses)!;
      const cartao = estadiaNoCartao(p, meses);
      assert.ok(cartao, `${id}, ${meses} mês(es): o cartão tem o total da estadia (antes, com 1 mês, caía no total do mês sem limpezas)`);
      assert.equal(cartao.total, pagina.total, `${id}, ${meses} mês(es): cartão × página`);
      assert.equal(cartao.composicao, pagina.conta, `${id}, ${meses} mês(es): o cartão mostra a conta inteira`);
    }
  }
  // O número que a prova ao vivo mediu: ube-001 com 1 mês = 1 × R$ 3.960 + preparação R$ 450 + saída R$ 250 = R$ 4.660.
  assert.equal(estadiaNoCartao(imovel("ube-001"), 1)?.total, 4660);
  assert.equal(SEM_NBSP(estadiaNoCartao(imovel("ube-001"), 1)?.composicao), "1 × R$ 3.960 + limpeza de preparação R$ 450 + limpeza de saída R$ 250");
  assert.equal(estadiaNoCartao(imovel("ube-003"), 2)?.total, 8900, "2 × R$ 4.100 + R$ 450 + R$ 250");
});

test("a prévia da revisão do dono e a barra do celular dão o mesmo total da estadia mínima", () => {
  for (const id of ["ube-001", "ube-002", "ube-003"]) {
    const p = imovel(id);
    const previa = precosDaPrevia(p).at(-1)!;
    const meses = Math.max(1, Math.ceil((p.minPeriodDays ?? 30) / 30));
    assert.equal(previa.valor, estadiaDoImovel(p, meses)!.total, `${id}: prévia do dono`);
    assert.equal(estadiaNoCartao(p, meses)?.total, previa.valor, `${id}: cartão × prévia do dono`);
  }
  // Barra fixa do celular: com 1 mês, o total da estadia (com as limpezas) — não o total do mês.
  const p = imovel("ube-001");
  const b = barraFixaImovel({ monthlyPrice: p.monthlyPrice, totalMensal: 3960, meses: 1, totalPeriodo: estadiaDoImovel(p, 1)!.total, exemplo: false, candidatouSe: false });
  assert.equal(SEM_NBSP(b.estadia), "R$ 4.660 em 1 mês");
});

test("função única para os resumos 'em N meses' das listas (rotuloPrecoDoImovel)", async () => {
  const { rotuloPrecoDoImovel } = await import("./cartao-estadia.ts");
  assert.equal(typeof rotuloPrecoDoImovel, "function", "rotuloPrecoDoImovel existe");
  const p = imovel("ube-001");
  for (const meses of [1, 6]) {
    const r = rotuloPrecoDoImovel(p, { meses });
    assert.equal(r.total, estadiaDoImovel(p, meses)!.total);
    assert.equal(SEM_NBSP(r.estadia), SEM_NBSP(`${estadiaNoCartao(p, meses)!.texto}`));
    assert.equal(SEM_NBSP(r.mes), "R$ 3.960/mês", "o /mês continua sendo o total do mês, sem os únicos");
  }
});

test("as superfícies usam a regra única (sem total 'só mensalidades' com 1 mês nem mês × N fora da regra)", () => {
  const cartao = ler("src/components/property-card.tsx");
  assert.doesNotMatch(cartao, /estadiaDoCartao\(preco\)/, "o cartão não cai mais no total do mês");
  const lateral = ler("src/components/property/price-card.tsx");
  assert.doesNotMatch(lateral, /meses > 1 \? estadiaDoImovel/);
  assert.doesNotMatch(lateral, /resumoEmMeses\(preco\.total, 1\)/);
  const detalhe = ler("src/app/(public)/imoveis/[id]/property-detail.tsx");
  assert.doesNotMatch(detalhe, /meses > 1 \? estadiaDoImovel\(property, meses\)\?\.total/);
  const barra = ler("src/lib/barra-fixa-imovel.ts");
  assert.doesNotMatch(barra, /preco\.meses > 1 \? \(p\.totalPeriodo \?\? preco\.total\) : preco\.total/);
  for (const f of [
    "src/components/busca/card-pin-mapa.tsx",
    "src/components/property-mini-card.tsx",
    "src/app/(dashboard)/dashboard/comparar/page.tsx",
    "src/app/(dashboard)/dashboard/visao-geral-client.tsx",
    "src/app/(public)/imoveis/[id]/opengraph-image.tsx",
  ])
    assert.match(ler(f), /rotuloPrecoDoImovel\(/, `${f} usa a regra única`);
  // Meus anúncios: a linha "Estadia mínima (N)" da regra única (estadiaDoCartaoDoDono → linhaEstadiaMinima), também com 1 mês.
  assert.match(ler("src/app/(dashboard)/dashboard/imoveis/imoveis-client.tsx"), /estadia: estadiaDoCartaoDoDono\(p, r\.meses\)/);
  // Sem os valores das limpezas à mão, a lista não inventa um "em N meses" diferente: só o total do mês.
  assert.doesNotMatch(ler("src/components/dashboard/property-row.tsx"), /rotuloPreco\(\{[^}]*meses:/);
  assert.doesNotMatch(ler("src/app/(dashboard)/dashboard/pedidos/pedidos-client.tsx"), /rotuloPreco\(\{ mensal: totalMesDaLinha\(r\.properties\), meses:/);
});

test("Meus anúncios (dono): com 1 mês também a linha com o total e a conta da regra única, igual à prévia do Passo 10", async () => {
  const { estadiaDoCartaoDoDono } = await import("./precos.ts");
  const p = imovel("ube-001");
  const previa = precosDaPrevia(p).at(-1)!;
  const linha = SEM_NBSP(estadiaDoCartaoDoDono(p, 1));
  assert.match(linha, /^Estadia mínima \(1 mês\): R\$ 4\.660 · 1 × R\$ 3\.960 \+ limpeza de preparação R\$ 450 \+ limpeza de saída R\$ 250$/);
  assert.equal(previa.valor, 4660);
});
