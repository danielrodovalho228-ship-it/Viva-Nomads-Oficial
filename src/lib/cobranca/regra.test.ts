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
  textoTaxaPainel,
  comissaoSobreContrato,
  fraseComissaoUnica,
  comissaoCurta,
} from "./regra.ts";

const em = new Date("2026-10-10T12:00:00Z");
const valor = (imoveisAtivos: number, tipo: "novo" | "renovacao" = "novo") =>
  cobrancaParaAceite({ tipo, imoveisAtivos, aluguelMensal: 4320, meses: 1, assinadoEm: em }).valor;

// Ordem b3c9d76e (14/10): a taxa incide sobre o VALOR TOTAL (aluguel × meses), não sobre o 1º mês.
test("ACEITE b3c9d76e (faixa 12%, R$ 3.000/mês): 1 mês = R$ 360; 3 meses = R$ 1.080; 6 meses = R$ 2.160", () => {
  assert.equal(comissaoSobreContrato(3000, 1, 0.12), 360);
  assert.equal(comissaoSobreContrato(3000, 3, 0.12), 1080);
  assert.equal(comissaoSobreContrato(3000, 6, 0.12), 2160);
  // contrato de 6 meses NÃO paga o mesmo que o de 1 mês
  assert.notEqual(comissaoSobreContrato(3000, 6, 0.12), comissaoSobreContrato(3000, 1, 0.12));
});

test("renovação decidida (14/10): 1 mês R$ 360 + renovação de 2 meses R$ 720 + de 3 meses R$ 1.080 = R$ 2.160 nos 6 meses", () => {
  const partes = [1, 2, 3].map((m) => comissaoSobreContrato(3000, m, 0.12));
  assert.deepEqual(partes, [360, 720, 1080]);
  assert.equal(partes.reduce((a, b) => a + b, 0), 2160); // = contrato único de 6 meses; nunca cobra o mesmo período duas vezes
});

test("cobrancaParaAceite usa a fórmula única: 3 meses na faixa 12% = R$ 1.080; faixa 10% = R$ 900", () => {
  const c = (imoveisAtivos: number, meses: number) =>
    cobrancaParaAceite({ tipo: "novo", imoveisAtivos, aluguelMensal: 3000, meses, assinadoEm: em }).valor;
  assert.equal(c(1, 3), 1080);
  assert.equal(c(4, 3), 900);
  assert.equal(c(1, 0), 0); // sem meses = sem cobrança
});

test("comissaoSobreContrato: entradas inválidas = 0", () => {
  assert.equal(comissaoSobreContrato(-1, 3, 0.12), 0);
  assert.equal(comissaoSobreContrato(0, 3, 0.12), 0);
  assert.equal(comissaoSobreContrato(3000, 0, 0.12), 0);
  assert.equal(comissaoSobreContrato(3000, Number.NaN, 0.12), 0);
  assert.equal(comissaoSobreContrato(3000, 3, Number.NaN), 0);
  assert.equal(comissaoSobreContrato(3000, 3, 0), 0);
});

test("textos padrão da comissão (frase padrão e curta)", () => {
  assert.equal(
    fraseComissaoUnica("12%"),
    "A VivaNomads cobra uma comissão única de 12% sobre o valor total do contrato de locação fechado pela plataforma.",
  );
  assert.equal(comissaoCurta("12%"), "12% sobre o valor total do contrato fechado.");
});

test("4.320 (1 mês) por faixa: 518,40 (12%), 432,00 (10%), 345,60 (8%), 259,20 (6%)", () => {
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
    meses: 1,
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

test("texto oficial: 12%, faixas até 6%, sem mensalidade", () => {
  assert.equal(
    TEXTO_REGRA_UNICA,
    "Anunciar é grátis. A Viva cobra 12% sobre o valor total do contrato fechado. Quanto mais imóveis, menor a taxa (até 6%). Sem mensalidade.",
  );
  assert.equal(TEXTO_REGRA_CURTO, TEXTO_REGRA_UNICA);
  assert.doesNotMatch(TEXTO_REGRA_UNICA, /plano|Essencial|Gestor|aluguel|comiss/i);
  assert.equal(pctTexto(0.12), "12%");
});

// ── Página de preços e tabela "Compare" ──
import { readFileSync, readdirSync, statSync } from "node:fs";
import { COMPARE_CONTRATO, COMPARE_RODAPE, DIFERENCIAIS_VIVA, LINHAS_COMPARE, linhasPublicas } from "../../config/compare-precos.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("Compare em % do total pago: Viva 12%, QuintoAndar ≈ 12,6%, imobiliária ≈ 13%, Airbnb 16%, Booking 18%", () => {
  assert.equal(COMPARE_CONTRATO, 12960);
  const v = (id: string) => LINHAS_COMPARE.find((l) => l.id === id)!.pct;
  assert.equal(v("viva"), 0.12);
  assert.equal(v("quintoandar"), 0.126);
  assert.equal(Math.round(v("imobiliaria")! * 100), 13);
  assert.equal(v("airbnb"), 0.16);
  assert.equal(v("booking"), 0.18);
  assert.equal(v("olx"), null);
  assert.equal(v("zap-vivareal"), null);
  assert.match(LINHAS_COMPARE.find((l) => l.id === "viva")!.regra, /12% sobre o valor total do contrato fechado \(menor com mais imóveis\)/);
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

test("vocabulário (ordens 12eea681/5faa3903): a cobrança da Viva nas páginas públicas não usa aluguel, locação, imobiliária, corretagem nem intermediação", () => {
  // Ordem b3c9d76e (14/10): a frase aprovada da renovação usa "comissão"; "aluguel", "locação" etc. seguem proibidos.
  const proibido = /aluguel|loca[cç][aã]o|imobili[aá]ria|corretagem|intermedia/i;
  const textos = [
    TEXTO_REGRA_UNICA,
    ler("src/app/(public)/precos/page.tsx").match(/<BannerTopo[\s\S]*?<\/BannerTopo>/)![0],
    ler("src/app/(public)/precos/page.tsx").match(/data-testid="regra-unica"[\s\S]*?<ButtonLink/)![0],
    LINHAS_COMPARE.find((l) => l.id === "viva")!.regra,
    ...DIFERENCIAIS_VIVA,
  ];
  for (const t of textos) assert.doesNotMatch(t.replace(/aluguelMensal|FAIXAS_COMISSAO_PADRAO/g, ""), proibido, t.slice(0, 60));
  assert.match(ler("src/lib/atendimento/faq.ts"), /12% sobre o valor total do contrato fechado/);
});

test("Compare: mantém a seção e os diferenciais da Viva (só a coluna da Viva, concorrente só com fonte)", () => {
  assert.equal(DIFERENCIAIS_VIVA.length, 8);
  assert.ok(DIFERENCIAIS_VIVA.includes("Você só paga quando a reserva é fechada"));
  assert.ok(DIFERENCIAIS_VIVA.includes("Nenhuma taxa para quem vem morar"));
  const comp = ler("src/components/precos/comparativo-precos.tsx");
  assert.match(comp, /DIFERENCIAIS_VIVA/);
  assert.match(comp, /COMPARE_RODAPE/);
});


test("painel do dono: 'Taxa de serviço: 12% do valor total do contrato = R$ 1.080,00' (3 meses a R$ 3.000)", () => {
  const t = textoTaxaPainel(0.12, 3000, 3);
  assert.equal(t, "Taxa de serviço: 12% do valor total do contrato = R$ 1.080,00");
  assert.equal(textoTaxaPainel(0.06, 4320, 1), "Taxa de serviço: 6% do valor total do contrato = R$ 259,20");
  assert.doesNotMatch(t, /primeiro|plano/i);
});

test("painel do dono: valor mensal ou prazo inválido não inventa valor", () => {
  assert.equal(textoTaxaPainel(0.12, 0, 3), "Taxa de serviço: 12% do valor total do contrato");
  assert.equal(textoTaxaPainel(0.12, Number.NaN, 3), "Taxa de serviço: 12% do valor total do contrato");
  assert.equal(textoTaxaPainel(0.12, 3000, 0), "Taxa de serviço: 12% do valor total do contrato");
});

test("F6: tabela pública — 31+ (Plano Gestor) é 'Negociado'; as demais faixas mostram o percentual", async () => {
  const { taxaPublicaTexto } = await import("./regra.ts");
  assert.deepEqual(
    FAIXAS_COMISSAO_PADRAO.map(taxaPublicaTexto),
    ["12%", "10%", "8%", "6%", "Negociado"],
  );
});

test("F6: /precos não mostra 6% fixo nem exemplo em reais para o Plano Gestor", async () => {
  const { readFileSync } = await import("node:fs");
  const t = readFileSync(new URL("../../app/(public)/precos/page.tsx", import.meta.url), "utf8");
  assert.match(t, /taxaPublicaTexto\(f\)/);
  assert.match(t, /f\.gestor \? TAXA_NEGOCIADA_TEXTO/);
  assert.doesNotMatch(t, /pctTexto\(f\.taxa\)/);
  assert.match(t, /Falar sobre o Plano Gestor|PlanoGestorForm/);
});

test("F6: chat da Viva não diz 6% para o Plano Gestor", async () => {
  const { readFileSync } = await import("node:fs");
  const t = readFileSync(new URL("../atendimento/viva-prompt.ts", import.meta.url), "utf8");
  assert.doesNotMatch(t, /Plano Gestor \(6%/);
  assert.match(t, /Plano Gestor \(condições negociadas/);
});

test("b3c9d76e: texto público e das telas não diz que a comissão é só do 1º mês/aluguel (guarda de varredura)", () => {
  const arquivos = [
    "src/lib/cobranca/regra.ts",
    "src/lib/comissao.ts",
    "src/lib/contrato-blocos.ts",
    "src/lib/atendimento/faq.ts",
    "src/lib/atendimento/viva-prompt.ts",
    "src/lib/seo/llms.ts",
    "src/config/compare-precos.ts",
    "src/components/precos/comparativo-precos.tsx",
    "src/app/(public)/precos/page.tsx",
    "src/app/(public)/termos/page.tsx",
    "src/app/(public)/privacidade/page.tsx",
    "src/app/(public)/como-funciona/page.tsx",
    "src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx",
    "src/app/(dashboard)/dashboard/contratos/contratos-client.tsx",
    "src/lib/payments/asaas.ts",
    "src/app/api/comissao/route.ts",
    "src/config/planos.ts",
    "src/config/premissas-financeiras.ts",
    "src/app/(dashboard)/dashboard/simulador/page.tsx",
    "src/app/(dashboard)/dashboard/roi-imovel/page.tsx",
  ];
  const velho = /primeiro (m[êe]s|aluguel)|1º (m[êe]s|aluguel)|de 1 aluguel|de um aluguel|sobre 1 aluguel|1 m[êe]s × taxa/i;
  for (const a of arquivos) assert.doesNotMatch(ler(a), velho, a);
});

test("b3c9d76e: Termos e Privacidade trazem o texto exato aprovado (cláusula 8, seção 3 e Asaas)", () => {
  const termos = ler("src/app/(public)/termos/page.tsx");
  assert.match(termos, /As cobranças da plataforma referem-se à comissão sobre o valor total de cada contrato e de cada renovação, e a serviços opcionais\./);
  assert.match(termos, /uma comissão única sobre o valor total de cada contrato de locação fechado pela plataforma \(valor mensal × número de meses contratados\)/);
  assert.match(termos, /1 a 2 imóveis, 12%; 3 a 5, 10%; 6 a 15, 8%; 16 a 30, 6%; 31 ou mais, condição negociada \(Plano Gestor\)/);
  assert.match(termos, /valor total R\$ 9\.000; comissão R\$ 1\.080\./);
  assert.doesNotMatch(termos, /a taxa é a mesma para todos/i);
  assert.match(ler("src/app/(public)/privacidade/page.tsx"), /Cobrança da comissão sobre o valor total de cada contrato e de cada renovação, do proprietário \(cobrança à parte\); os valores mensais são pagos pelo inquilino direto ao proprietário, fora da plataforma/);
});

test("b3c9d76e + c54366b0: /api/comissao lê aluguel, meses e taxa do CONTRATO registrado (nunca prazo do navegador) e usa a fórmula única", () => {
  const rota = ler("src/app/api/comissao/route.ts");
  assert.match(rota, /comissaoDoContrato\(f\.leadId\)/);
  assert.match(rota, /meses: contrato\.meses/);
  assert.match(rota, /commissionRate: contrato\.taxa/);
  assert.match(rota, /status: 409/);
  assert.doesNotMatch(rota, /termMonths/);
  const fluxo = ler("src/app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.ok(fluxo.indexOf("await registrarContrato(") < fluxo.indexOf('await fetch("/api/comissao"'), "registra o contrato antes de cobrar");
  assert.match(fluxo, /body: JSON\.stringify\(\{ leadId: ctx\.leadId \}\)/);
  assert.match(ler("src/lib/payments/asaas.ts"), /valorComissao\(params\.aluguelMensal, params\.meses, params\.commissionRate\)/);
  assert.match(ler("src/lib/comissao.ts"), /comissaoSobreContrato/);
  assert.match(ler("src/lib/contrato-blocos.ts"), /comissaoContrato\(aluguel, total, rate\)/);
});
