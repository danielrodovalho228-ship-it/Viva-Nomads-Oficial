import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEXTO_REGRA_UNICA,
  TEXTO_REGRA_CURTO,
  cobrancaParaAceite,
  fixacaoAdminValida,
  pctTexto,
  taxaDeConfig,
  taxaNaAssinatura,
  valorTaxa,
} from "./regra.ts";

const em = new Date("2026-10-10T12:00:00Z");

test("4.320 × 12% = 518,40 no contrato novo E na renovação", () => {
  assert.equal(cobrancaParaAceite({ tipo: "novo", aluguelMensal: 4320, assinadoEm: em }).valor, 518.4);
  assert.equal(cobrancaParaAceite({ tipo: "renovacao", aluguelMensal: 4320, assinadoEm: em }).valor, 518.4);
});

test("a taxa não depende do nº de imóveis (dono com 30 imóveis também paga 12%)", () => {
  // a assinatura da função nem aceita imóveis: regra igual para todos, por construção
  const t = taxaNaAssinatura({ tipo: "novo", assinadoEm: em });
  assert.equal(t.taxa, 0.12);
  assert.equal(t.origem, "regra_unica");
  assert.equal(valorTaxa(4320, t.taxa), 518.4);
});

test("config (taxa_comissao / taxa_renovacao em %) manda; inválida cai no padrão 12%", () => {
  assert.equal(taxaDeConfig("12", 0.12), 0.12);
  assert.equal(taxaDeConfig("15", 0.12), 0.15);
  for (const ruim of [null, undefined, "", "abc", "-1", "101"]) assert.equal(taxaDeConfig(ruim, 0.12), 0.12);
  const cfg = { taxaComissao: 0.12, taxaRenovacao: 0.1 };
  assert.equal(taxaNaAssinatura({ tipo: "renovacao", assinadoEm: em, config: cfg }).taxa, 0.1);
  assert.equal(taxaNaAssinatura({ tipo: "novo", assinadoEm: em, config: cfg }).taxa, 0.12);
});

test("valorTaxa: entradas inválidas = 0", () => {
  assert.equal(valorTaxa(-1, 0.12), 0);
  assert.equal(valorTaxa(0, 0.12), 0);
  assert.equal(valorTaxa(4320, Number.NaN), 0);
  assert.equal(valorTaxa(Number.NaN, 0.12), 0);
});

test("override do admin exige motivo e validade; vencido, sem motivo ou fora de 0..1 é ignorado", () => {
  const ate = new Date("2026-12-31T00:00:00Z");
  const ok = taxaNaAssinatura({ tipo: "novo", assinadoEm: em, fixadaPeloAdmin: { taxa: 0.05, motivo: "negociação", validoAte: ate } });
  assert.deepEqual([ok.taxa, ok.origem], [0.05, "admin"]);
  const ruins = [
    { taxa: 0.05, motivo: "negociação", validoAte: new Date("2026-10-01T00:00:00Z") },
    { taxa: 0.05, motivo: "  ", validoAte: ate },
    { taxa: 0.05, motivo: "x", validoAte: ate },
    { taxa: 1.5, motivo: "negociação", validoAte: ate },
  ];
  for (const f of ruins) {
    assert.equal(fixacaoAdminValida(f, em), false);
    assert.equal(taxaNaAssinatura({ tipo: "novo", assinadoEm: em, fixadaPeloAdmin: f }).taxa, 0.12);
  }
});

test("texto oficial: 12%, sem mensalidade, sem plano nem faixa", () => {
  assert.equal(TEXTO_REGRA_UNICA, "Anunciar é grátis. A Viva cobra 12% por contrato fechado. Sem mensalidade.");
  assert.equal(TEXTO_REGRA_CURTO, TEXTO_REGRA_UNICA);
  assert.doesNotMatch(TEXTO_REGRA_UNICA, /plano|faixa|Essencial|Gestor/i);
  assert.equal(pctTexto(0.12), "12%");
});

// ── Página de preços e tabela "Compare" ──
import { readFileSync, readdirSync, statSync } from "node:fs";
import { COMPARE_CONTRATO, COMPARE_RODAPE, DIFERENCIAIS_VIVA, LINHAS_COMPARE, linhasPublicas } from "../../config/compare-precos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("Compare: contrato de 3 × R$ 4.320; Viva ≈ R$ 518; Airbnb ≈ R$ 2.074; Booking ≈ R$ 2.333", () => {
  assert.equal(COMPARE_CONTRATO, 12960);
  const v = (id: string) => LINHAS_COMPARE.find((l) => l.id === id)!.valor;
  assert.equal(v("viva"), 518.4);
  assert.equal(Math.round(v("airbnb")!), 2074);
  assert.equal(Math.round(v("booking")!), 2333);
});

test("Compare: só aparece linha com fonte e data; rodapé obrigatório; sem logos", () => {
  const pub = linhasPublicas();
  assert.ok(pub.length >= 2);
  for (const l of pub) {
    assert.ok(l.fonte && l.fonte.url.length > 0 && l.conferidoEm, `${l.id} sem fonte/data`);
    assert.match(l.conferidoEm!, /^\d{4}-\d{2}-\d{2}$/);
  }
  // concorrente sem fonte conferida nunca é publicado
  for (const l of LINHAS_COMPARE) if (!l.fonte) assert.ok(!pub.includes(l));
  assert.equal(COMPARE_RODAPE, "Valores de referência de out/2026, sujeitos a mudança pelas empresas. Exemplo ilustrativo.");
  assert.doesNotMatch(ler("src/components/precos/comparativo-precos.tsx"), /<(img|Image)\b/);
});

test("/precos: sem planos, faixas, mensalidade nem 'renovação grátis'; com a regra única", () => {
  const page = ler("src/app/(public)/precos/page.tsx");
  assert.match(page, /TEXTO_REGRA_UNICA/);
  assert.match(page, /ComparativoPrecos/);
  assert.doesNotMatch(page, /PLANS|Essencial|Gestor|plano Profissional|faixas por volume|renovação grátis|vistoria/i);
  const linhas = ler("src/components/precos/comparativo-precos.tsx");
  assert.doesNotMatch(linhas, /Essencial|Profissional|Gestor/);
});

test("varredura: nada nas páginas públicas, FAQ, llms e navegação fala de plano, faixa, comissão zero ou renovação grátis", () => {
  const pastas = ["src/app/(public)", "src/components/layout"];
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(new URL(`../../../${d}`, import.meta.url))) {
      const rel = `${d}/${n}`;
      if (statSync(new URL(`../../../${rel}`, import.meta.url)).isDirectory()) andar(rel);
      else if (/\.tsx?$/.test(n) && !/\.test\./.test(n)) arquivos.push(rel);
    }
  };
  pastas.forEach(andar);
  arquivos.push("src/lib/atendimento/faq.ts", "src/lib/seo/llms.ts", "src/lib/seo/estruturados.ts", "src/lib/constants.ts");
  const proibido = /Essencial|plano (Gratuito|Profissional|Gestor)|comiss[aã]o zero|renova[cç][aã]o (gr[aá]tis|n[aã]o paga)|Renovação: você não paga|taxa de extensão|ver planos|Planos de assinatura/i;
  const achados = arquivos.filter((a) => a !== "src/components/layout/dashboard-shell.tsx" && proibido.test(ler(a)));
  assert.deepEqual(achados, []);
});

test("vocabulário (ordens 12eea681/5faa3903): a cobrança da Viva nas páginas públicas não usa aluguel, comissão, locação, imobiliária, corretagem nem intermediação", () => {
  const proibido = /aluguel|comiss[aã]o|loca[cç][aã]o|imobili[aá]ria|corretagem|intermedia/i;
  const textos = [
    TEXTO_REGRA_UNICA,
    ler("src/app/(public)/precos/page.tsx").match(/<section className="bg-forest[\s\S]*?<\/section>/)![0],
    ler("src/app/(public)/precos/page.tsx").match(/data-testid="regra-unica"[\s\S]*?<ButtonLink/)![0],
    LINHAS_COMPARE.find((l) => l.id === "viva")!.regra,
    ...DIFERENCIAIS_VIVA,
  ];
  for (const t of textos) assert.doesNotMatch(t.replace(/aluguelMensal/g, ""), proibido, t.slice(0, 60));
  assert.match(ler("src/lib/atendimento/faq.ts"), /12% por contrato fechado/);
});

test("Compare: mantém a seção e os diferenciais da Viva (só a coluna da Viva, concorrente só com fonte)", () => {
  assert.equal(DIFERENCIAIS_VIVA.length, 8);
  assert.ok(DIFERENCIAIS_VIVA.includes("Você só paga quando a reserva é fechada"));
  assert.ok(DIFERENCIAIS_VIVA.includes("Nenhuma taxa para quem vem morar"));
  const comp = ler("src/components/precos/comparativo-precos.tsx");
  assert.match(comp, /DIFERENCIAIS_VIVA/);
  assert.match(comp, /COMPARE_RODAPE/);
});
