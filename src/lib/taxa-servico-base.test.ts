import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baseDaTaxa, rotuloBaseTaxa } from "./taxa-servico-base.ts";

// Prompt 23 (item 4). O contrato de produção de 12/10: R$ 3.200 × 4 meses, 12%, taxa gravada R$ 384 (= 1 mês).
test("p23/p29 — contrato ANTIGO (taxa sobre 1 mês): 'Regra anterior', valor gravado, sem '× meses'", () => {
  const antigo = { valor: 384, percent: 0.12, aluguelMensal: 3200, meses: 4, aceiteEm: "2026-10-12T18:57:58Z" };
  assert.equal(baseDaTaxa(antigo), "um_mes");
  assert.equal(rotuloBaseTaxa(antigo), "Regra anterior: 12% de 1 mês (R$ 3.200) = R$ 384, valor gravado no aceite em 12/10/2026");
  assert.doesNotMatch(rotuloBaseTaxa(antigo), /× meses/, "regra anterior nunca mostra '× meses'");
});

test("p23/p27 — contrato NOVO mostra a base: '12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800)'", () => {
  const novo = { valor: 1536, percent: 0.12, aluguelMensal: 3200, meses: 4, aceiteEm: "2026-10-18T10:00:00Z" };
  assert.equal(baseDaTaxa(novo), "valor_total");
  assert.equal(rotuloBaseTaxa(novo), "12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.536");
  assert.equal(rotuloBaseTaxa({ valor: 720, percent: 0.08, aluguelMensal: 3000, meses: 3 }), "8% sobre o valor mensal × meses (R$ 3.000 × 3 = R$ 9.000) = R$ 720");
});

test("p23 — valor que não bate com nenhuma regra não inventa base", () => {
  assert.equal(rotuloBaseTaxa({ valor: 500, percent: 0.12, aluguelMensal: 3200, meses: 4, aceiteEm: "2026-10-12" }), "R$ 500, valor gravado no aceite em 12/10/2026");
});

test("p23 — a tela usa 'taxa de serviço' (nunca 'comissão') e não afirma regra de renovação", () => {
  const tela = readFileSync(new URL("../app/(dashboard)/dashboard/contratos/contratos-client.tsx", import.meta.url), "utf8");
  const bloco = tela.slice(tela.indexOf('data-testid="contrato-taxa"'), tela.indexOf('data-testid="contrato-taxa"') + 700);
  assert.match(bloco, /Taxa de serviço:/);
  assert.doesNotMatch(bloco, /[Cc]omissão/);
  assert.doesNotMatch(bloco, /renova/);
  assert.match(tela, /rotuloBaseTaxa\(/);
});

test("complemento P29, item 2 — guarda: nenhuma tela de contrato monta a frase da taxa fora de rotuloBaseTaxa", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const arquivos = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? arquivos(p) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [p] : [];
    });
  // Telas que mostram a taxa de um CONTRATO (gravada no aceite).
  const telasDeContrato = ["src/app/(dashboard)/dashboard/contratos", "src/app/(dashboard)/admin/contratos", "src/app/(dashboard)/admin/financeiro", "src/components/contrato"];
  for (const d of telasDeContrato) {
    for (const f of arquivos(d)) {
      const s = readFileSync(f, "utf8");
      assert.doesNotMatch(s, /rotuloTaxaServico\(|textoTaxaPainel\(/, `${f}: use rotuloBaseTaxa`);
      assert.doesNotMatch(s, /sobre o valor mensal × meses|de 1 mês —|valor (gravado|registrado) no aceite/, `${f}: frase da taxa montada fora de rotuloBaseTaxa`);
    }
  }
  for (const f of ["src/app/(dashboard)/dashboard/contratos/contratos-client.tsx", "src/app/(dashboard)/admin/contratos/page.tsx", "src/app/(dashboard)/admin/financeiro/financeiro-client.tsx"]) {
    assert.match(readFileSync(f, "utf8"), /rotuloBaseTaxa\(/, f);
  }
});
