/*
  t2032 · Orçamentos (Pista 3, lote 2, item D7) @E600 @E562   (sem @ao-vivo-seguro: valores de contrato)
  Regra: na proposta, o total é a soma das parcelas MOSTRADAS — em 30 e em 180 dias, com desconto, com as contas
  incluídas (sem consumo à parte) e à parte (consumo estimado), com limpezas, taxa pet e limpeza de preparação:
    • Mensal + Condomínio + Consumo + Limpezas + Taxa pet = "Total por mês (com contas)";
    • "Total do contrato" = Total por mês × meses + Limpeza de preparação;
    • "1º pagamento" = Total por mês + Limpeza de preparação.
  Lê os números do HTML da tela REAL (proposta-detalhe.tsx), com os totais das regras REAIS (calcularTotais/precos),
  nas duas pontas (morador e dono). Dublês só nas bordas (ver e722-tela-harness/).
  Roda: node --test src/lib/propostas/e440-t2032-total-soma-das-parcelas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { proposta, renderizar } from "./e722-tela-harness/proposta.ts";

/** Pares rótulo → valor (R$) das linhas <dt>/<dd> da tela. */
function linhas(html: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const [, dt, dd] of html.matchAll(/<dt[^>]*>(.*?)<\/dt><dd[^>]*>(.*?)<\/dd>/g)) {
    const rs = dd.replace(/<[^>]+>/g, "").match(/R\$\s*([\d.]+(?:,\d{2})?)/);
    if (rs) m.set(dt.replace(/<[^>]+>/g, "").replace(/&nbsp;| /g, " ").trim(), Number(rs[1].replace(/\./g, "").replace(",", ".")));
  }
  return m;
}
const reais = (n: number) => Math.round(n * 100);

const CASOS = [
  { nome: "30 dias, contas incluídas, sem desconto", termos: { dias: 30, meses: 1, consumo: 0, condominio: 0, descontoPct: 0 }, meses: 1 },
  { nome: "30 dias, contas à parte, condomínio e desconto de 5%", termos: { dias: 30, meses: 1, consumo: 180, condominio: 420, descontoPct: 5 }, meses: 1 },
  { nome: "180 dias, contas à parte, desconto de estadia longa 10% + limpezas, pet e preparação", termos: { dias: 180, meses: 6, consumo: 220, condominio: 450, descontoEstadiaPct: 10, limpezasMes: 2, valorLimpeza: 90, taxaPet: 60, limpezaUnica: 350 }, meses: 6 },
  { nome: "180 dias, contas incluídas, desconto em reais", termos: { dias: 180, meses: 6, consumo: 0, condominio: 0, descontoValor: 150, motivoDesconto: "Pagamento em dia" }, meses: 6 },
];

for (const caso of CASOS) {
  test(`D7: ${caso.nome} — o total fecha com as parcelas mostradas (morador e dono)`, () => {
    for (const papel of ["tenant", "owner"] as const) {
      const l = linhas(renderizar(proposta({ papel, termos: caso.termos as never })));
      const ok = (r: string) => assert.ok(l.has(r), `${papel}: falta a linha "${r}" em ${JSON.stringify([...l])}`);
      for (const r of ["Mensal", "Total por mês (com contas)", "Total do contrato", "1º pagamento"]) ok(r);
      const mensais = [...l].filter(([r]) => r === "Mensal" || r === "Condomínio" || r === "Consumo estimado" || r.startsWith("Limpezas (") || r === "Taxa pet").map(([, v]) => v);
      const porMes = l.get("Total por mês (com contas)")!;
      const preparacao = l.get("Limpeza de preparação (única)") ?? 0;
      assert.equal(reais(mensais.reduce((s, v) => s + v, 0)), reais(porMes), `${papel}: soma das parcelas mensais`);
      assert.equal(reais(l.get("Total do contrato")!), reais(porMes * caso.meses + preparacao), `${papel}: total do contrato`);
      assert.equal(reais(l.get("1º pagamento")!), reais(porMes + preparacao), `${papel}: 1º pagamento`);
    }
  });
}

test("D7: com desconto, o Mensal mostrado é o valor com desconto (e o original aparece entre parênteses)", () => {
  const html = renderizar(proposta({ papel: "tenant", termos: { descontoPct: 5 } as never }));
  const l = linhas(html);
  assert.equal(l.get("Mensal"), 2850); // 3.000 − 5%
  assert.match(html, /R\$\s*2\.850 \(de R\$\s*3\.000\)/);
});
