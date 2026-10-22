/* Prompt 27 — Ferramentas do proprietário (QA do Muse, 18/10): itens 1, 2, 3, 4 e 6. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cenariosOcupacao, liquidoMobiliadoAnual, simularRentabilidade, simularROI } from "./simulador.ts";
import { geometriaBarras, rotuloValorBarra } from "./grafico-barras.ts";
import { rotuloTaxaServico } from "./cobranca/regra.ts";
import { calcularTotais, taxaServicoProposta, type TermosProposta } from "./propostas/regras.ts";
import { canaisDaCalculadora } from "../config/compare-precos.ts";
import { htmlSimulacao } from "./print-simulacao.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const SIM = ler("../app/(dashboard)/dashboard/simulador/page.tsx");
const ROI = ler("../app/(dashboard)/dashboard/roi-imovel/page.tsx");

// Os números do print do Muse: R$ 3.000 mobiliado, 10 meses, sem condomínio, contas R$ 400 à parte,
// investimento R$ 25.000 com 10% de reposição, 12% de taxa. Antes: Simulador 26.400 × Calculadora 23.900.
const MUSE = { valor: 3000, meses: 10, invest: 25000, reposicao: 0.1, contas: 400, taxa: 0.12 };

test("p27 item 1 — com as mesmas entradas, o líquido do Simulador é IGUAL ao mobiliado da Calculadora (23.900)", () => {
  const sim = simularRentabilidade(
    { aluguelMensal: MUSE.valor, condoIptu: 0, contas: MUSE.contas, mesesOcupados: MUSE.meses, prazoMedioMeses: 4, investimentoMobilia: MUSE.invest, reposicaoAnualPct: MUSE.reposicao },
    MUSE.taxa,
    0,
  );
  const roi = simularROI(
    { investimentoMobiliar: MUSE.invest, aluguelVazio: 1800, aluguelMobiliado: MUSE.valor, contasMensais: MUSE.contas, reposicaoAnualPct: MUSE.reposicao, mesesOcupados: MUSE.meses, prazoMedioMeses: 4 },
    MUSE.taxa,
    0,
  );
  assert.equal(sim.reposicaoAnual, 2500);
  assert.equal(sim.receitaLiquidaAnual, 23900);
  assert.equal(roi.netMobiliadoAnual, sim.receitaLiquidaAnual);
  // Com condomínio, contas incluídas e outra faixa, continuam iguais.
  for (const [condo, cobr, taxa, m] of [[550, "incluido", 0.1, 8], [300, "aparte", 0.06, 12], [0, "aparte", 0.08, 6]] as const) {
    const s = simularRentabilidade({ aluguelMensal: 4200, condoIptu: condo, contas: 350, mesesOcupados: m, prazoMedioMeses: 3, condoCobranca: cobr, contasCobranca: cobr, investimentoMobilia: 30000, reposicaoAnualPct: 0.08 }, taxa, 0);
    const r = simularROI({ investimentoMobiliar: 30000, aluguelVazio: 2000, aluguelMobiliado: 4200, condoIptu: condo, contasMensais: 350, condoCobranca: cobr, contasCobranca: cobr, reposicaoAnualPct: 0.08, mesesOcupados: m, prazoMedioMeses: 3 }, taxa, 0);
    assert.equal(r.netMobiliadoAnual, s.receitaLiquidaAnual);
  }
});

test("p27 item 1 — as duas telas chamam a mesma função; nenhuma faz conta própria; 'mesma conta' só onde é verdade", () => {
  assert.match(ler("./simulador.ts"), /liquidoMobiliadoAnual\(\{ \.\.\.e, valorMensal: e\.aluguelMensal \}/);
  assert.equal((ler("./simulador.ts").match(/liquidoMobiliadoAnual\(/g) ?? []).length, 3, "definição + Simulador + ROI");
  for (const tela of [SIM, ROI]) assert.doesNotMatch(tela, /baseMobiliadoAno\(/, "a tela não calcula por fora");
  assert.match(SIM, /Reposição e desgaste da mobília/);
  assert.match(SIM, /mesma conta do mobiliado na Calculadora de ROI/);
  assert.match(ROI, /mesma conta do Simulador de rentabilidade \(a mesma função\)/);
  assert.equal(liquidoMobiliadoAnual({ valorMensal: 3000, condoIptu: 0, contas: 0, mesesOcupados: 10, investimentoMobilia: 25000, reposicaoAnualPct: 0.1 }, 0.12).liquidoAnual, 23900);
});

test("p27 item 2 — sem QuintoAndar na Calculadora nem no Simulador; ficam Viva, Airbnb (com fonte) e o tradicional", () => {
  for (const tela of [SIM, ROI]) assert.doesNotMatch(tela, /quinto\s*andar|linhasPublicas/i);
  const canais = canaisDaCalculadora({ taxaAdm: 0.1, intermediacaoACadaMeses: 30 });
  assert.deepEqual(canais.map((c) => c.nome), ["Viva Nomads", "Airbnb", "Contrato tradicional (12+ meses)"]);
  assert.ok(canais[1].fonte?.url.includes("airbnb"));
  assert.equal(canais[2].pct, 0.133); // 10% + 1/30
  assert.doesNotMatch(JSON.stringify(canais), /quinto/i);
  assert.equal(canaisDaCalculadora({ taxaAdm: 0.08, intermediacaoACadaMeses: 0 })[2].pct, 0.08);
});

test("p27 item 3 — cenários Conservador / Realista / Otimista nas duas telas e no PDF", () => {
  assert.deepEqual(cenariosOcupacao(10).map((c) => c.nome), ["Conservador", "Realista", "Otimista"]);
  for (const tela of [SIM, ROI]) {
    assert.doesNotMatch(tela, /Pessimista|"Esperado"/);
    assert.match(tela, /c\.nome === "Realista"/);
    assert.match(tela, /cenarios: cenarios\.map/);
  }
  const html = htmlSimulacao({ titulo: "t", entradas: [], resultados: [], cenarios: cenariosOcupacao(10).map((c) => ({ label: c.nome, valor: "x" })) });
  assert.match(html, /Cenários de ocupação/);
  assert.match(html, /Conservador[\s\S]*Realista[\s\S]*Otimista/);
  // A projeção do admin (premissas-financeiras) não muda.
  assert.match(ler("../config/premissas-financeiras.ts"), /Pessimista/);
});

test("p27 item 4 — Acumulado com os números do Muse: a barra do Ano 1 (−R$ 1.100) desce do zero com altura > 0", () => {
  const roi = simularROI(
    { investimentoMobiliar: 25000, aluguelVazio: 1800, aluguelMobiliado: 3000, contasMensais: 400, reposicaoAnualPct: 0.1, mesesOcupados: 10, prazoMedioMeses: 4 },
    0.12,
    0,
  );
  assert.equal(roi.acumulado[0].mobiliado, -1100);
  const valores = roi.acumulado.flatMap((a) => [a.mobiliado, a.vazio]);
  const geo = geometriaBarras(valores, 160);
  const ano1 = geo.barras[0];
  assert.ok(ano1.negativo);
  assert.ok(ano1.altura >= 4, `altura ${ano1.altura}`);
  assert.equal(ano1.topo, geo.zeroY, "começa na linha do zero e desce");
  assert.ok(geo.zeroY < 160, "a escala inclui o negativo: o zero não fica no rodapé");
  // Proporcional: um negativo grande ocupa a altura certa.
  const g2 = geometriaBarras([-1000, 1000], 100);
  assert.equal(g2.zeroY, 50);
  assert.equal(g2.barras[0].altura, 50);
  assert.equal(g2.barras[1].topo, 0);
  assert.equal(geometriaBarras([0, 10], 100).barras[0].altura, 0);
  assert.equal(rotuloValorBarra(-1100, (v) => `R$ ${v.toLocaleString("pt-BR")}`), "−R$ 1.100");
  const ui = ler("../components/simulador/ui.tsx");
  assert.match(ui, /className="sr-only"/);
  assert.match(ui, /bg-red-400/);
  assert.match(ROI, /<GraficoColunas/);
});

test("p27 item 6 — rótulo da taxa: base = valor mensal × meses, mesmo com consumo, limpeza e pet no total", () => {
  assert.equal(rotuloTaxaServico(0.12, 3200, 4), "Taxa de serviço: 12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800) = R$ 1.536");
  const termos = {
    valorBase: 3200, descontoPct: 0, descontoValor: 0, descontoEstadiaPct: 0, meses: 4, dataEntrada: "2026-11-01",
    condominio: 0, consumo: 250, limpezasMes: 2, valorLimpeza: 90, taxaPet: 80, limpezaUnica: 150,
  } as unknown as TermosProposta;
  const tot = calcularTotais(termos);
  assert.ok(tot.totalContrato > tot.baseTaxa, "o total do contrato inclui os extras");
  const taxa = taxaServicoProposta(termos, 0.12);
  const rotulo = rotuloTaxaServico(0.12, tot.valorMensal, 4, taxa);
  assert.equal(taxa, 1536);
  assert.match(rotulo, /\(R\$ 3\.200 × 4 = R\$ 12\.800\) = R\$ 1\.536$/);
  assert.doesNotMatch(rotulo, /valor total/);
  // Todos os lugares que mostram a taxa usam o rótulo único.
  const proposta = ler("../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx");
  const orcamento = ler("../app/(dashboard)/dashboard/orcamentos/nova/montagem-proposta.tsx");
  const fechamento = ler("../app/(dashboard)/dashboard/fechamento/closing-flow.tsx");
  assert.match(proposta, /rotuloTaxaServico\(/);
  assert.doesNotMatch(proposta, /sobre o valor total/);
  assert.match(orcamento, /textoTaxaPainel\(/);
  assert.match(fechamento, /textoTaxaPainel\(/);
  assert.match(SIM, /rotuloTaxaServico\(/);
  assert.match(ROI, /rotuloTaxaServico\(/);
});

import { textoVencimento, venceEm24h, aguardandoResposta, mudancasProibidas } from "./propostas/regras.ts";
import { planoCarteiraTeste, PREFIXO_CARTEIRA_TESTE } from "./carteira-teste.ts";
import { ehAnuncioDeTeste } from "./data/anuncio-teste.ts";
import { itensDisponiveis, avisoAbaixoDoMinimo } from "./anuncio/negociacao.ts";

test("p27 item 5 — o editor do anúncio PUBLICADO tem o bloco de negociação (a causa do 'não vi')", () => {
  const editor = ler("../app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx");
  assert.match(editor, /<BlocoNegociacao/);
  assert.match(editor, /testid="editar-negociacao"/);
  assert.match(editor, /salvarLimitesNegociacao\(/, "o limite privado é salvo à parte");
  assert.match(editor, /^\s+negociacao,$/m, "a negociação vai no updateProperty");
  // Caução parcelada só com a chave; o mínimo nunca aparece: só a próxima centena.
  assert.equal(itensDisponiveis(false).some((i) => i.chave === "caucao_parcelada"), false);
  assert.equal(itensDisponiveis(true).some((i) => i.chave === "caucao_parcelada"), true);
  assert.deepEqual(avisoAbaixoDoMinimo(2800, 2950), { tenteAPartirDe: 3000 });
});

test("p27 item 5 — J: item não liberado não muda nem pela API (o servidor confere com mudancasProibidas)", () => {
  const base = {
    valorBase: 3200, descontoPct: 0, descontoValor: 0, motivoDesconto: null, descontoEstadiaPct: 0, meses: 4, dataEntrada: "2026-11-01",
    condominio: 0, consumo: 0, limpezasMes: 0, valorLimpeza: 0, taxaPet: 0, limpezaUnica: 0,
  } as TermosProposta;
  const proibidas = mudancasProibidas(base, { ...base, valorBase: 2900 }, "tenant", ["meses"]);
  assert.ok(proibidas.length > 0);
  assert.deepEqual(mudancasProibidas(base, { ...base, meses: 5 }, "tenant", ["meses"]), []);
  assert.match(ler("./data/propostas-actions.ts"), /mudancasProibidas\(anterior, nova, papel, neg\.itens\)/);
});

test("p27 item 7 — contagem regressiva, lembrete de 24 h e 'aguardando a sua resposta'", () => {
  const agora = new Date("2026-10-18T12:00:00Z");
  assert.equal(textoVencimento("2026-10-23T12:00:00Z", agora), "vence em 5 dias");
  assert.equal(textoVencimento("2026-10-19T20:00:00Z", agora), "vence amanhã");
  assert.equal(textoVencimento("2026-10-18T20:00:00Z", agora), "vence hoje");
  assert.equal(textoVencimento("2026-10-18T11:00:00Z", agora), "venceu");
  assert.equal(venceEm24h("2026-10-19T11:00:00Z", agora), true);
  assert.equal(venceEm24h("2026-10-19T13:00:00Z", agora), false);
  assert.equal(venceEm24h("2026-10-18T11:00:00Z", agora), false);
  assert.equal(aguardandoResposta("enviada", "owner", "tenant"), true);
  assert.equal(aguardandoResposta("contraproposta", "tenant", "tenant"), false);
  assert.equal(aguardandoResposta("aceita", "owner", "tenant"), false);
  const cron = ler("../app/api/cron/automacoes/route.ts");
  assert.match(cron, /tipo: "proposta_vencendo"/);
  assert.match(ler("./notifications/eventos-email.ts"), /proposta_vencendo: \{/);
  // Prompt 42: a proposta que espera o inquilino vira linha de "Hoje você tem N decisões", com o "vence em N dias".
  assert.match(ler("./painel/decisoes.ts"), /prazoTexto: pz\.prazo \? textoVencimento\(pz\.prazo, agora\) : null/);
  assert.match(ler("../app/(dashboard)/dashboard/propostas/page.tsx"), /data-testid="propostas-inquilino"/);
});

test("p27 item 8 — carteira de teste: 3 imóveis [TESTE QA] (fora da busca), 2 contratos encerrados e 1 ativo", () => {
  const hoje = new Date("2026-10-18T12:00:00Z");
  const plano = planoCarteiraTeste(hoje);
  assert.equal(plano.length, 3);
  for (const p of plano) assert.ok(ehAnuncioDeTeste(p.titulo) && p.titulo.startsWith(PREFIXO_CARTEIRA_TESTE));
  assert.deepEqual(plano.map((p) => p.statusContrato), ["concluido", "concluido", "ativo"]);
  assert.ok(plano[2].inicio <= "2026-10-18" && plano[2].fim >= "2026-10-18", "o ativo cobre hoje");
  assert.ok(plano.slice(0, 2).every((p) => p.fim < "2026-10-18"), "os encerrados terminaram");
  // As regras do banco para o bloco: 1 a 3 meses e no máximo 90 dias (contratos_tamanho_bloco_meses_check, bloco_max_90_dias).
  for (const p of plano) {
    assert.ok(p.meses >= 1 && p.meses <= 3, `${p.titulo}: bloco de 1 a 3 meses`);
    assert.ok((Date.parse(p.fim) - Date.parse(p.inicio)) / 86_400_000 <= 90, `${p.titulo}: bloco de até 90 dias`);
  }
  const acoes = ler("./data/carteira-teste-actions.ts");
  assert.match(acoes, /soContasDeTeste\(admin, \[input\.ownerId, input\.tenantId\]\)/);
  assert.match(acoes, /exigirAdminAal2/);
  assert.match(acoes, /like\("title", `\$\{PREFIXO_CARTEIRA_TESTE\}%`\)/, "limpar só mexe no que tem o prefixo");
});
