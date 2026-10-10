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
  "src/components/modelo-negocio/modelo-negocio.tsx",
  "src/components/socios/socios.tsx",
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

// Vocabulário da Viva (ordens bd296d53 e 2f80c58a): "reserva do imóvel" e "taxa de serviço".
// Comparações com outras empresas podem citá-las, mas não usamos esses termos nos textos da Viva.
const VOCABULARIO_PROIBIDO = /aluguel|alugu[eé]is|comiss|corretagem|intermedia|apartamentos|Híbrido|híbrido/;

test("/modelodenegocio: regra única 12% por contrato, faixas e rodapé; sem planos nem vocabulário antigo", () => {
  const texto = readFileSync(new URL("../../../src/components/modelo-negocio/modelo-negocio.tsx", import.meta.url), "utf8");
  const semImports = texto.split("\n").filter((l) => !/^\s*import /.test(l)).join("\n");
  const achado = semImports.match(VOCABULARIO_PROIBIDO);
  assert.equal(achado, null, `modelo-negocio.tsx cita "${achado?.[0]}"`);
  assert.ok(!texto.includes("@/config/planos"), "não pode mais ler os planos antigos");
  assert.ok(texto.includes("@/lib/cobranca/regra"), "as faixas vêm de src/lib/cobranca/regra.ts");
  assert.ok(texto.includes("Plataforma em fase de testes. Lançamento oficial em 2027."));
  assert.ok(texto.includes("Plano Gestor"));
});

test("/socios, decisão e rede: Rogério como sócio/dono, sem remover ninguém", () => {
  const socios = readFileSync(new URL("../../../src/components/socios/socios.tsx", import.meta.url), "utf8");
  for (const nome of ["Daniel", "Rômulo", "Danilo", "Rogério"]) assert.ok(socios.includes(`nome: "${nome}"`), `falta ${nome} em /socios`);
  assert.ok(socios.includes("Sócio · Dono"));
  const decisao = readFileSync(new URL("../../../src/components/decisao/decisao.tsx", import.meta.url), "utf8");
  assert.ok(decisao.includes('["Daniel", "Rômulo", "Danilo", "Rogério"]'));
  const painel = readFileSync(new URL("../../../src/lib/agentes/painel.ts", import.meta.url), "utf8");
  assert.ok(painel.includes('id: "rogerio"') && painel.includes('["moacir", "rogerio", "relatorio"]'));
  const central = readFileSync(new URL("../../../src/app/(dashboard)/admin/agentes/central-client.tsx", import.meta.url), "utf8");
  assert.ok(central.includes('data-testid="agente-daniel"') && central.includes('data-testid="agente-rogerio"'));
  // Ninguém ganha admin por e-mail fixo no código: o Moacir promove no banco.
  for (const f of [socios, painel, central]) assert.ok(!/rogerio@/i.test(f));
});
