/*
  E255 — "Você entra na regra nova?": combinações do resultado, limiares do aviso, números da Viva, chave desligada e
  o que a tela NUNCA diz (valor ou percentual de imposto, alíquota, redutor, PF × PJ, empresa/holding, "confisco").
  Roda: node --test src/lib/reforma/enquadramento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { enquadramento, linhasDoResultado, mostrarAvisoReforma, numerosNaViva, TEXTO_AVISO, TEXTO_NAO_E_ORIENTACAO } from "./enquadramento.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
/** Só o que vai para a tela (sem comentários do código). */
const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

test("combinações: 3/R$ 300 mil não passa; 4/R$ 250 mil passa; 4/R$ 200 mil não passa; 4/R$ 290 mil passa pelo gatilho", () => {
  const r = (imoveis: number, receita: number) => enquadramento({ imoveisNaViva: imoveis, receitaNaViva: receita });
  assert.equal(r(3, 300_000).passaCriterios, false);
  assert.equal(r(3, 300_000).passaGatilho, false);
  assert.equal(r(4, 250_000).passaCriterios, true);
  assert.equal(r(4, 250_000).passaGatilho, false);
  assert.equal(r(4, 200_000).passaCriterios, false);
  assert.equal(r(4, 290_000).passaGatilho, true);
  // Na divisa não passa ("mais de"): 4 imóveis com exatamente R$ 240 mil / R$ 288 mil.
  assert.equal(r(4, 240_000).passaCriterios, false);
  assert.equal(r(4, 288_000).passaGatilho, false);
});

test("os números de fora da Viva somam aos da Viva (e valores vazios ou negativos contam zero)", () => {
  const x = enquadramento({ imoveisNaViva: 2, receitaNaViva: 100_000, outrosImoveis: 2, outraReceita: 160_000 });
  assert.deepEqual([x.imoveis, x.receita, x.passaCriterios], [4, 260_000, true]);
  const y = enquadramento({ imoveisNaViva: 4, receitaNaViva: 250_000, outrosImoveis: -3, outraReceita: null });
  assert.deepEqual([y.imoveis, y.receita], [4, 250_000]);
});

test("as linhas do resultado (passa / não passa) e o aviso de que não é orientação", () => {
  const l = linhasDoResultado(enquadramento({ imoveisNaViva: 4, receitaNaViva: 250_000 }));
  assert.equal(l.criterios, "Pelos números informados, você passa dos dois critérios (mais de 3 imóveis E mais de R$ 240 mil).");
  assert.match(l.gatilho, /R\$ 288 mil.*você não passa por esse gatilho\.$/);
  assert.match(linhasDoResultado(enquadramento({ imoveisNaViva: 3, receitaNaViva: 300_000 })).criterios, /você não passa dos dois critérios/);
  assert.equal(TEXTO_NAO_E_ORIENTACAO, "Isso não é orientação tributária. Fale com seu contador.");
  assert.equal(TEXTO_AVISO, "A reforma tributária muda as regras para quem tem mais de 3 imóveis alugados. Confira se você entra.");
});

test("aviso só nos limiares: 3 imóveis ou mais na Viva OU R$ 200 mil ou mais no ano", () => {
  assert.equal(mostrarAvisoReforma({ imoveisNaViva: 2, receitaAnoNaViva: 199_999 }), false);
  assert.equal(mostrarAvisoReforma({ imoveisNaViva: 3, receitaAnoNaViva: 0 }), true);
  assert.equal(mostrarAvisoReforma({ imoveisNaViva: 1, receitaAnoNaViva: 200_000 }), true);
});

test("números da Viva: imóveis com contrato no ano, receita registrada no ano e blocos assinados ainda a pagar até 31/12", () => {
  const n = numerosNaViva(
    [
      {
        propertyId: "a",
        status: "ativo",
        blocos: [
          { id: "b1", inicio: "2026-08-01", fim: "2026-09-30", valor: 6000 },
          { id: "b2", inicio: "2026-11-15", fim: "2027-01-14", valor: 6000 },
          { id: "b3", inicio: "2027-01-15", fim: "2027-03-14", valor: 6000 },
        ],
        pagamentos: [
          { blocoId: "b1", tipo: "aluguel", valor: 6000, dataPagamento: "2026-08-01" },
          { blocoId: null, tipo: "caucao", valor: 3000, dataPagamento: "2026-08-01" },
        ],
      },
      { propertyId: "b", status: "encerrado", blocos: [{ id: "c1", inicio: "2025-11-01", fim: "2026-02-28", valor: 9000 }], pagamentos: [{ blocoId: "c1", tipo: "aluguel", valor: 9000, dataPagamento: "2025-11-01" }] },
      { propertyId: "c", status: "cancelado", blocos: [{ id: "d1", inicio: "2026-05-01", fim: "2026-06-30", valor: 5000 }], pagamentos: [] },
    ],
    "2026-10-30",
  );
  assert.deepEqual(n, { ano: 2026, imoveisComContrato: 2, receitaRegistrada: 6000, projecao: 6000 });
});

test("chave desligada não mostra nada; ligada só por 'on' (ou cookie no laboratório)", () => {
  assert.match(ler("lib/flags.ts"), /export const ENQUADRAMENTO_REFORMA = process\.env\.NEXT_PUBLIC_ENQUADRAMENTO_REFORMA === "on";/);
  const pagina = ler("app/(dashboard)/dashboard/ganhos/page.tsx");
  assert.match(pagina, /if \(!isSupabaseConfigured\(\) \|\| !\(await enquadramentoReformaAtivo\(\)\)\) return null;/);
  assert.match(pagina, /\{reforma\?\.aviso && \(/);
  assert.match(pagina, /\{reforma && <EnquadramentoReforma/);
  assert.match(ler("lib/reforma/chave.ts"), /if \(!integracoesSimuladas\(\)\) return false;/);
});

test("fora da Viva fica no navegador: sem formulário, sem nome de campo, sem envio", () => {
  const tela = ler("components/reforma/enquadramento-reforma.tsx");
  assert.doesNotMatch(tela, /<form|name=|fetch\(|"use server"|localStorage|sessionStorage|console\./);
});

test("a tela nunca fala de imposto em número, alíquota, redutor, PF × PJ, empresa ou holding; nem 'confisco'/'tomar os bens'", () => {
  const textos = [semComentarios(ler("components/reforma/enquadramento-reforma.tsx")), semComentarios(ler("lib/reforma/enquadramento.ts"))].join("\n");
  assert.doesNotMatch(textos, /%|al[íi]quota|redutor|\bPJ\b|pessoa jur[íi]dica|empresa|holding|confisco|tomar os bens|imposto de|CBS de|IBS de/i);
  // Vocabulário: sem "aluguel" nos títulos.
  for (const m of semComentarios(ler("components/reforma/enquadramento-reforma.tsx")).matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/g)) assert.doesNotMatch(m[1], /aluguel/i);
});
