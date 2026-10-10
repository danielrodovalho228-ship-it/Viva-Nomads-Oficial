import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FAIXAS_COMISSAO_PADRAO,
  TEXTO_REGRA_UNICA,
  TEXTO_REGRA_CURTO,
  cobrancaParaAceite,
  ehPlanoGestor,
  faixaPorImoveisAtivos,
  fixacaoAdminValida,
  pctTexto,
  proximaFaixa,
  taxaDeConfig,
  taxaNaAssinatura,
  valorTaxa,
} from "./regra.ts";

const em = new Date("2026-10-10T12:00:00Z");
const valor = (imoveisAtivos: number, tipo: "novo" | "renovacao" = "novo") =>
  cobrancaParaAceite({ tipo, imoveisAtivos, aluguelMensal: 4320, assinadoEm: em }).valor;

test("4.320 por faixa: 518,40 (12%), 432,00 (10%), 345,60 (8%), 259,20 (6%)", () => {
  assert.deepEqual([1, 2].map((n) => valor(n)), [518.4, 518.4]);
  assert.deepEqual([3, 5].map((n) => valor(n)), [432, 432]);
  assert.deepEqual([6, 15].map((n) => valor(n)), [345.6, 345.6]);
  assert.deepEqual([16, 30].map((n) => valor(n)), [259.2, 259.2]);
});

test("renovação conta como novo contrato: mesma taxa da faixa do dono", () => {
  for (const n of [1, 4, 10, 20, 40]) assert.equal(valor(n, "renovacao"), valor(n, "novo"));
  assert.equal(valor(4, "renovacao"), 432);
});

test("31+ imóveis (Plano Gestor): dono com 40 imóveis sem override paga 6%; com override 4% paga 4%", () => {
  assert.equal(valor(40), 259.2);
  assert.equal(ehPlanoGestor(40), true);
  assert.equal(ehPlanoGestor(30), false);
  const ate = new Date("2026-12-31T00:00:00Z");
  const t = cobrancaParaAceite({
    tipo: "novo",
    imoveisAtivos: 40,
    aluguelMensal: 4320,
    assinadoEm: em,
    fixadaPeloAdmin: { taxa: 0.04, motivo: "negociação Plano Gestor", validoAte: ate },
  });
  assert.deepEqual([t.taxa, t.origem, t.valor], [0.04, "admin", 172.8]);
  // override vencido volta aos 6%
  const vencido = taxaNaAssinatura({
    tipo: "novo",
    imoveisAtivos: 40,
    assinadoEm: em,
    fixadaPeloAdmin: { taxa: 0.04, motivo: "negociação", validoAte: new Date("2026-10-01T00:00:00Z") },
  });
  assert.equal(vencido.taxa, 0.06);
});

test("limites das faixas e entrada inválida", () => {
  const taxa = (n: number) => faixaPorImoveisAtivos(n).taxa;
  assert.deepEqual([1, 2, 3, 5, 6, 15, 16, 30, 31, 100].map(taxa), [0.12, 0.12, 0.1, 0.1, 0.08, 0.08, 0.06, 0.06, 0.06, 0.06]);
  for (const ruim of [0, -3, Number.NaN]) assert.equal(taxa(ruim), 0.12);
  assert.equal(FAIXAS_COMISSAO_PADRAO.length, 5);
});

test("próxima faixa: 'Ative mais 1 imóvel e sua taxa cai para 10%'; no Gestor não há próxima", () => {
  assert.deepEqual(proximaFaixa(2), { faltam: 1, taxa: 0.1 });
  assert.deepEqual(proximaFaixa(5), { faltam: 1, taxa: 0.08 });
  assert.equal(proximaFaixa(35), null);
});

test("cair de faixa: a taxa anterior vale por 30 dias; depois, a nova", () => {
  const queda = { taxaAnterior: 0.08, em: new Date("2026-10-01T00:00:00Z") };
  const dentro = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 2, assinadoEm: new Date("2026-10-20T00:00:00Z"), queda });
  assert.deepEqual([dentro.taxa, dentro.origem], [0.08, "faixa_com_queda_recente"]);
  const fora = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 2, assinadoEm: new Date("2026-11-05T00:00:00Z"), queda });
  assert.deepEqual([fora.taxa, fora.origem], [0.12, "faixa"]);
});

test("config (em %) manda; inválida cai no padrão", () => {
  assert.equal(taxaDeConfig("12", 0.12), 0.12);
  assert.equal(taxaDeConfig("15", 0.12), 0.15);
  for (const ruim of [null, undefined, "", "abc", "-1", "101"]) assert.equal(taxaDeConfig(ruim, 0.12), 0.12);
});

test("valorTaxa: entradas inválidas = 0", () => {
  assert.equal(valorTaxa(-1, 0.12), 0);
  assert.equal(valorTaxa(0, 0.12), 0);
  assert.equal(valorTaxa(4320, Number.NaN), 0);
  assert.equal(valorTaxa(Number.NaN, 0.12), 0);
});

test("override do admin exige motivo e validade; vencido, sem motivo ou fora de 0..1 é ignorado", () => {
  const ate = new Date("2026-12-31T00:00:00Z");
  const ok = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 1, assinadoEm: em, fixadaPeloAdmin: { taxa: 0.05, motivo: "negociação", validoAte: ate } });
  assert.deepEqual([ok.taxa, ok.origem], [0.05, "admin"]);
  const ruins = [
    { taxa: 0.05, motivo: "negociação", validoAte: new Date("2026-10-01T00:00:00Z") },
    { taxa: 0.05, motivo: "  ", validoAte: ate },
    { taxa: 0.05, motivo: "x", validoAte: ate },
    { taxa: 1.5, motivo: "negociação", validoAte: ate },
  ];
  for (const f of ruins) {
    assert.equal(fixacaoAdminValida(f, em), false);
    assert.equal(taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 1, assinadoEm: em, fixadaPeloAdmin: f }).taxa, 0.12);
  }
});

test("texto oficial: 12%, faixas até 4%, sem mensalidade", () => {
  assert.equal(
    TEXTO_REGRA_UNICA,
    "Anunciar é grátis. A Viva cobra 12% por contrato fechado. Quanto mais imóveis, menor a taxa (até 4%). Sem mensalidade.",
  );
  assert.equal(TEXTO_REGRA_CURTO, TEXTO_REGRA_UNICA);
  assert.doesNotMatch(TEXTO_REGRA_UNICA, /plano|Essencial|Gestor|aluguel|comiss/i);
  assert.equal(pctTexto(0.12), "12%");
});

// ── Página de preços e tabela "Compare" ──
import { readFileSync, readdirSync, statSync } from "node:fs";
import { COMPARE_CONTRATO, COMPARE_RODAPE, DIFERENCIAIS_VIVA, LINHAS_COMPARE, linhasPublicas } from "../../config/compare-precos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("Compare em % do total pago: Viva ≈ 4%, QuintoAndar ≈ 12,6%, imobiliária ≈ 13%, Airbnb 16%, Booking 18%", () => {
  assert.equal(COMPARE_CONTRATO, 12960);
  const v = (id: string) => LINHAS_COMPARE.find((l) => l.id === id)!.pct;
  assert.equal(v("viva"), 0.04);
  assert.equal(v("quintoandar"), 0.126);
  assert.equal(Math.round(v("imobiliaria")! * 100), 13);
  assert.equal(v("airbnb"), 0.16);
  assert.equal(v("booking"), 0.18);
  assert.equal(v("olx"), null);
  assert.equal(v("zap-vivareal"), null);
  assert.match(LINHAS_COMPARE.find((l) => l.id === "viva")!.regra, /≈ 4% numa reserva de 3 meses; menor com mais imóveis/);
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
  assert.equal(COMPARE_RODAPE, "Valores de referência de out/2026, sujeitos a mudança pelas empresas. Cálculo ilustrativo.");
  assert.doesNotMatch(ler("src/components/precos/comparativo-precos.tsx"), /<(img|Image)\b/);
});

test("/precos: tabela das faixas (12/10/8/6%), Plano Gestor no 31+; sem planos antigos nem 'renovação grátis'", () => {
  const page = ler("src/app/(public)/precos/page.tsx");
  assert.match(page, /TEXTO_REGRA_UNICA/);
  assert.match(page, /ComparativoPrecos/);
  assert.match(page, /FAIXAS_COMISSAO_PADRAO/);
  assert.match(page, /data-testid="faixas-taxa"/);
  assert.match(page, /Plano Gestor/);
  assert.doesNotMatch(page, /PLANS|Essencial|plano Profissional|renovação grátis|vistoria/i);
  const linhas = ler("src/components/precos/comparativo-precos.tsx");
  assert.doesNotMatch(linhas, /Essencial|Profissional|Gestor/);
});

test("varredura: nada nas páginas públicas, FAQ, llms e navegação fala dos planos antigos, comissão zero ou renovação grátis", () => {
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
  const proibido = /Essencial|plano (Gratuito|Profissional)|comiss[aã]o zero|renova[cç][aã]o (gr[aá]tis|n[aã]o paga)|Renovação: você não paga|taxa de extensão|ver planos|Planos de assinatura/i;
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
  for (const t of textos) assert.doesNotMatch(t.replace(/aluguelMensal|FAIXAS_COMISSAO_PADRAO/g, ""), proibido, t.slice(0, 60));
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
