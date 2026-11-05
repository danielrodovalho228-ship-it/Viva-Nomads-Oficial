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
  "src/app/(dashboard)/dashboard/roi-imovel/page.tsx",
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

// E595/E596 (05/11): /socios e /decisao saíram (sócios e modelo revogados; a reescrita vem depois da decisão societária).
test("rede: Rogério no painel e na Central de agentes", () => {
  const painel = readFileSync(new URL("../../../src/lib/agentes/painel.ts", import.meta.url), "utf8");
  assert.ok(painel.includes('id: "rogerio"') && painel.includes('["moacir", "rogerio", "relatorio"]'));
  const central = readFileSync(new URL("../../../src/app/(dashboard)/admin/agentes/central-client.tsx", import.meta.url), "utf8");
  assert.ok(central.includes('data-testid="agente-daniel"') && central.includes('data-testid="agente-rogerio"'));
  // Ninguém ganha admin por e-mail fixo no código: o Moacir promove no banco.
  for (const f of [painel, central]) assert.ok(!/rogerio@/i.test(f));
});

// Ordem da1f9b50: custo fixo real ≈ R$ 6 mil (pró-labore), "equipes jurídicas", condomínios como meta.
test("textos dos sócios: sem 'advogada', sem custo fixo antigo (R$ 989 a R$ 1.450 / menos de R$ 1.500)", () => {
  for (const arquivo of ARQUIVOS) {
    const texto = readFileSync(new URL(`../../../${arquivo}`, import.meta.url), "utf8");
    assert.ok(!/advogada/i.test(texto), `${arquivo} cita "advogada"`);
    assert.ok(!/R\$ ?989 a R\$ ?1\.450|menos de R\$ ?1\.500/.test(texto), `${arquivo} cita o custo fixo antigo`);
  }
});

test("/modelodenegocio: seção 'Virada de chave nos condomínios' é meta, nunca promessa", () => {
  const texto = readFileSync(new URL("../../../src/components/modelo-negocio/modelo-negocio.tsx", import.meta.url), "utf8");
  assert.ok(texto.includes("Virada de chave nos condomínios"));
  assert.ok(texto.includes("STJ"));
  assert.ok(texto.includes("é uma meta, não uma promessa") || texto.includes("É uma meta, não uma promessa"));
  assert.ok(!/aceit[oa]s? onde o Airbnb n[ãa]o/i.test(texto), "nunca 'aceito onde o Airbnb não é'");
  assert.ok(texto.includes("Projeções ilustrativas, não são promessa de retorno."));
  assert.ok(texto.includes("Plataforma em fase de testes. Lançamento oficial em 2027."));
});

test("custo fixo padrão (modelo v3): fornecedores R$ 1.302,90 + pró-labore de referência ≈ R$ 7,3 mil, antes dos encargos do regime", async () => {
  const { CUSTOS_FIXOS, CUSTO_FIXO_FAIXA } = await import("../../config/premissas-financeiras.ts");
  const total = CUSTOS_FIXOS.reduce((s, c) => s + c.valor, 0);
  assert.ok(Math.abs(total - 7302.9) < 0.01, `total ${total}`);
  assert.match(CUSTO_FIXO_FAIXA.texto, /encargos do regime/);
});

// E559: nenhuma tela dos sócios mostra o custo antigo (R$ 989, pró-labore de R$ 5.000) nem chama a hipótese da Certta de preço.
test("E559: /roi, /simulacao e /modelodenegocio sem R$ 989, sem pró-labore de R$ 5.000 e sem 'preço da Certta'", () => {
  const telas = [
    "src/components/financeiro/modelo-financeiro.tsx",
    "src/components/modelo-negocio/modelo-negocio.tsx",
    "src/app/roi/page.tsx",
    "src/app/simulacao/page.tsx",
    "src/app/modelodenegocio/page.tsx",
    "src/config/premissas-financeiras.ts",
  ];
  for (const arquivo of telas) {
    const texto = readFileSync(new URL(`../../../${arquivo}`, import.meta.url), "utf8");
    assert.ok(!/R\$ ?989\b|\b989\b/.test(texto), `${arquivo} cita R$ 989`);
    assert.ok(!/pró-labore[^\n]{0,40}5\.000|5\.000[^\n]{0,40}pró-labore|valor: 5000/i.test(texto), `${arquivo} cita pró-labore de R$ 5.000`);
    assert.ok(!/preço (da|de) Certta|Certta[^\n]{0,20}preço:/i.test(texto), `${arquivo} chama a hipótese da Certta de preço`);
  }
});
