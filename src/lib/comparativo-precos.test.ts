/*
  Preços 12/8/4/0: comparativo em reais, plano que compensa, comissão congelada
  no aceite e nenhum percentual de comissão fixo fora de config/planos.ts.
  Roda: node --test src/lib/comparativo-precos.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { calcularComparativo, custoAnualPorPlano, planoMaisBarato } from "./comparativo-precos.ts";
import { COMISSAO_POR_PLANO, PLANOS, taxaDoContrato, textoComissao } from "../config/planos.ts";

test("tabela nova: 12% / 8% / 4% / 0% e mensalidades R$ 0 / 49 / 129 / sob consulta", () => {
  assert.deepEqual(COMISSAO_POR_PLANO, { free: 0.12, essential: 0.08, pro: 0.04, gestor: 0 });
  assert.deepEqual(PLANOS.map((p) => p.precoMensal), [0, 49, 129, null]);
});

test("comparativo: R$ 2.400 × 4 meses", () => {
  const c = calcularComparativo(2400, 4);
  assert.equal(c.valorContrato, 9600);
  assert.equal(c.airbnb, 1536);
  assert.equal(c.imobiliaria, 2400 + 768); // 1º aluguel + 8% ao mês × 4
  const por = Object.fromEntries(c.planos.map((p) => [p.id, p]));
  assert.deepEqual([por.free.comissao, por.free.mensalidades, por.free.total], [288, 0, 288]);
  assert.deepEqual([por.essential.comissao, por.essential.mensalidades, por.essential.total], [192, 196, 388]);
  assert.deepEqual([por.pro.comissao, por.pro.mensalidades, por.pro.total], [96, 516, 612]);
  assert.equal(Math.round(por.free.pctDoContrato * 1000) / 10, 3);
  assert.ok(!("gestor" in por), "Gestor é sob consulta: fora do comparativo por contrato");
});

test("qual plano compensa, por cenário", () => {
  // 1 imóvel, 3 contratos/ano: Gratuito (864) < Essencial (576+588) < Pro (288+1548)
  assert.equal(planoMaisBarato(1, 3, 2400), "free");
  // 3 imóveis: o Gratuito não comporta (1 anúncio)
  assert.equal(custoAnualPorPlano(3, 10, 2400).find((x) => x.id === "free")!.total, null);
  assert.equal(planoMaisBarato(3, 10, 2400), "essential"); // empate (R$ 2.508 × R$ 2.508): fica o plano mais simples
  // Muitos contratos e aluguel alto: o Profissional compensa
  assert.equal(planoMaisBarato(10, 40, 5000), "pro"); // Ess: 16000+588 · Pro: 8000+1548
  // Mais de 20 imóveis: só o Gestor (sob consulta)
  assert.equal(planoMaisBarato(25, 50, 3000), "gestor");
});

test("texto da comissão sempre em reais", () => {
  assert.equal(textoComissao(0.12, 2400), "12% de um aluguel, uma vez por contrato (≈ R$ 288)");
  assert.equal(textoComissao(0.04), "4% de um aluguel, uma vez por contrato");
  assert.match(textoComissao(0), /zero/i);
  for (const p of PLANOS) if (p.comissao > 0) assert.match(p.custoLabel, /de um aluguel, uma vez por contrato \(≈ R\$ \d/);
});

test("comissão congelada no aceite: aceites antigos NÃO mudam com a tabela nova", () => {
  assert.equal(taxaDoContrato(0.1, "essential"), 0.1); // Essencial antigo (10%) continua 10%
  assert.equal(taxaDoContrato(0.08, "pro"), 0.08); // Profissional antigo (8%) continua 8%
  assert.equal(taxaDoContrato("0.12", "free"), 0.12);
  assert.equal(taxaDoContrato(null, "essential"), 0.08); // sem taxa gravada: a do plano hoje
  assert.equal(taxaDoContrato(null, "pro"), 0.04);
  assert.equal(taxaDoContrato(0.5, "pro"), 0.04); // taxa inventada não vale
});

/** Arquivos .ts/.tsx do src, menos testes e a fonte única. */
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return arquivos(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

test("nenhum outro arquivo tem percentual de comissão fixo", () => {
  const raiz = new URL("../", import.meta.url).pathname; // src/
  const fonte = join(raiz, "config", "planos.ts");
  const violacoes: string[] = [];
  for (const arq of arquivos(raiz)) {
    if (arq === fonte) continue;
    readFileSync(arq, "utf8")
      .split("\n")
      .forEach((linha, i) => {
        if (!/comiss|commission|airbnb/i.test(linha)) return;
        if (/\b(4|8|10|12|16)\s?%/.test(linha) || /[^\w.]0?\.(04|08|1|10|12|16)\b/.test(linha)) violacoes.push(`${arq.replace(raiz, "src/")}:${i + 1}: ${linha.trim().slice(0, 120)}`);
      });
  }
  assert.deepEqual(violacoes, []);
});
