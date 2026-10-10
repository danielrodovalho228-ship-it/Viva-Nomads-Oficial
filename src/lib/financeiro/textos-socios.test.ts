/*
  Páginas dos sócios (ordem bd296d53): modelo único de receita — taxa de serviço por contrato fechado,
  sem mensalidade nesta fase. Teste de grep: nenhum destes arquivos pode voltar a citar os planos antigos.
  Roda: node --test src/lib/financeiro/textos-socios.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PROIBIDOS = /Gratuito|Essencial|Profissional|mensalidade|vistoria|30 a 180/;

// Conforme as partes da ordem forem entregues, os demais arquivos entram nesta lista.
const ARQUIVOS = [
  "public/apresentacao.html",
  "src/components/financeiro/modelo-financeiro.tsx",
  "src/config/premissas-financeiras.ts",
  "src/lib/financeiro/projecao.ts",
];

for (const arquivo of ARQUIVOS) {
  test(`sem planos antigos, mensalidade, vistoria nem "30 a 180": ${arquivo}`, () => {
    const texto = readFileSync(new URL(`../../../${arquivo}`, import.meta.url), "utf8");
    const achado = texto.match(PROIBIDOS);
    assert.equal(achado, null, `${arquivo} cita "${achado?.[0]}"`);
  });
}

test("apresentação: mostra a tabela de faixas 12/10/8/6% e não cita apartamentos", () => {
  const html = readFileSync(new URL("../../../public/apresentacao.html", import.meta.url), "utf8");
  for (const faixa of ["12%", "10%", "8%", "6%"]) assert.ok(html.includes(`<b>${faixa}</b>`), `falta ${faixa}`);
  assert.ok(!/apartamentos/i.test(html));
});
