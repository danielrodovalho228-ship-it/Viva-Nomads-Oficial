/*
  Modelo de custos v3 (validado pelo coordenador; ordem do Daniel, 05/11/2026 — continuação do E559/E592): /simulacao e
  /roi com as premissas vigentes. Nada da projeção antiga (até R$ 69,3 mil, 1º mês positivo no 14, payback no 27; exemplo
  de R$ 4.320 × 12% fixo).
  Roda: node --test src/lib/financeiro/custos-v3.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALUGUEL_MEDIO,
  CUSTOS_FIXOS,
  CUSTOS_POR_CONTRATO,
  INVESTIMENTO_INICIAL,
  INVESTIMENTO_INICIAL_DETALHE,
  INVESTIMENTO_DOS_QUAIS,
  INVESTIMENTO_A_COTAR,
  OPCIONAIS_NAO_SOMADOS,
  DOLAR,
  FORA_DO_FIXO,
  MESES_MEDIOS_CONTRATO,
  REGIMES,
  REGIME_PADRAO,
  ROTULO_REGIME_ALTERNATIVO,
  OPERADOR_OPCOES,
  SELO_SOCIETARIO,
  TAXA_FAIXAS,
  marketingDoMes,
  encargosProLabore,
} from "../../config/premissas-financeiras.ts";
import { CUSTO_FIXO_PADRAO, cenariosContratosMes, custoFixoDe, fraseResumo, porContrato, projetar } from "./projecao.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("v3: contrato de referência R$ 3.000 × 3 meses, na faixa da carteira 12/10/8/6 (nunca 12% fixo)", () => {
  assert.equal(ALUGUEL_MEDIO, 3000);
  assert.equal(MESES_MEDIOS_CONTRATO, 3);
  assert.deepEqual(TAXA_FAIXAS.map((f) => f.taxa), [0.12, 0.1, 0.08, 0.06, 0.04]); // E623: + Gestor
  assert.deepEqual(TAXA_FAIXAS.map((f) => porContrato({ operador: 0, taxa: f.taxa }).receita), [1080, 900, 720, 540, 360]);
});

test("E622 (veredito de 05/11): Simples 6% é o padrão; Presumido 16,33% + INSS 20% é o cenário alternativo, a confirmar com o Rodolfo", () => {
  assert.deepEqual(REGIMES.map((r) => [r.id, r.aliquota, r.inssPatronal]), [
    ["simples", 0.06, 0],
    ["presumido", 0.1633, 0.2],
  ]);
  assert.equal(REGIME_PADRAO, "simples");
  const presumido = REGIMES.find((r) => r.id === "presumido")!;
  assert.match(presumido.detalhe, /11,33% federais \(PIS\/Cofins 3,65% \+ IRPJ 4,8% \+ CSLL 2,88%\) \+ ISS de 5% \(teto conservador, a confirmar com o Rodolfo\)/);
  assert.match(presumido.detalhe, /INSS patronal de 20% sobre o pró-labore \(a confirmar com o Rodolfo\)/);
  assert.equal(encargosProLabore(presumido), 1200);
  assert.equal(encargosProLabore(REGIMES[0]), 0);
  assert.equal(ROTULO_REGIME_ALTERNATIVO, "cenário alternativo · regime em definição");
  assert.deepEqual([...OPERADOR_OPCOES], [0]); // sem operador pago desde 18/10
  assert.match(SELO_SOCIETARIO, /em revisão/);
});

test("E622 — valores de referência do simulador oficial (aluguel 3.000 · 3 meses · 10% · Certta R$ 20 · pró-labore 6.000), ±1 contrato / ±3%", () => {
  const ref = { simples: { empate: 10, vinte: 8199 }, presumido: { empate: 13, vinte: 5140 } } as const;
  for (const r of ["simples", "presumido"] as const) {
    const empate = Math.ceil(custoFixoDe({ regime: r }) / porContrato({ operador: 0, regime: r }).margem);
    const vinte = cenariosContratosMes({ operador: 0, regime: r })[1].resultado;
    assert.ok(Math.abs(empate - ref[r].empate) <= 1, `${r}: empate ${empate}`);
    assert.ok(Math.abs(vinte - ref[r].vinte) / ref[r].vinte <= 0.03, `${r}: 20 contratos ${vinte}`);
  }
  // e os números exatos de hoje (o oficial usa médias por contrato: R$ 10 de diferença)
  assert.equal(Math.ceil(porContrato({ operador: 0, regime: "simples" }).empate[0]), 10);
  assert.equal(Math.ceil(porContrato({ operador: 0, regime: "presumido" }).empate[0]), 13);
  assert.equal(Math.round(cenariosContratosMes({ operador: 0, regime: "simples" })[1].resultado), 8189);
  assert.equal(Math.round(cenariosContratosMes({ operador: 0, regime: "presumido" })[1].resultado), 5130);
});

test("v3 (veredito do coordenador, 05/11): ACIUB e e-mail visíveis mas FORA da soma; parecer e consulta dentro do investimento", () => {
  const linha = (r: RegExp) => CUSTOS_FIXOS.find((c) => r.test(c.rotulo));
  assert.equal(linha(/ACIUB/), undefined);
  assert.equal(linha(/e-mail/), undefined);
  const fornecedores = CUSTOS_FIXOS.filter((c) => !/Pró-labore/.test(c.rotulo)).reduce((s, c) => s + c.valor, 0);
  assert.ok(Math.abs(fornecedores - 1302.9) < 0.01, String(fornecedores));
  assert.ok(Math.abs(CUSTO_FIXO_PADRAO - 7302.9) < 0.01);
  const opc = (r: RegExp) => OPCIONAIS_NAO_SOMADOS.find((c) => r.test(c.rotulo));
  assert.equal(opc(/ACIUB/)?.obs, "Associação à ACIUB Uberlândia, ~R$ 100/mês, sugestão da Dra. Beatriz, decisão pendente");
  assert.equal(opc(/e-mail/)?.valor, 5.99);
  assert.match(opc(/e-mail/)?.obs ?? "", /Hostinger/);
  assert.equal(INVESTIMENTO_INICIAL, 16000);
  assert.equal(
    INVESTIMENTO_INICIAL_DETALHE,
    "dos quais: parecer da Dra. Beatriz R$ 4.000 (proposta de 05/11, aguarda OK) e consulta de 05/11 R$ 500 (paga pelo Rogério, a reembolsar) — informativos, não somados",
  );
  assert.equal(linha(/Marketing pago/)?.valor, 0);
  assert.equal(marketingDoMes(1), 0);
  assert.equal(marketingDoMes(36), 0);
  assert.equal(linha(/Pró-labore/)?.valor, 6000);
  // sem rateio de parecer: o custo fixo do mês na projeção é o mesmo dos cenários de um mês
  const p = projetar("base", { operador: 0 });
  assert.equal(p.meses[0].custoFixo, custoFixoDe({}));
  assert.equal(DOLAR, 5.2);
});

test("v3: fora do fixo sem número inventado — Stays só na fase 2 do Gestor; seguro: a Viva não tem hoje", () => {
  assert.ok(FORA_DO_FIXO.some((f) => /Stays/.test(f) && /fase 2 do Gestor/.test(f)));
  assert.ok(FORA_DO_FIXO.some((f) => /[Ss]eguro/.test(f) && /a Viva não tem hoje/.test(f) && /decisão pendente/.test(f)));
  for (const f of FORA_DO_FIXO) assert.ok(!/R\$ ?\d/.test(f), f);
});

test("v3: Certta sem preço público — 1,7 × R$ 20 = R$ 34 por contrato é HIPÓTESE, nunca preço", () => {
  const id = CUSTOS_POR_CONTRATO.find((c) => /Certta/.test(c.rotulo))!;
  assert.equal(id.valor, 34);
  assert.match(id.obs ?? "", /hipótese/);
  assert.match(id.obs ?? "", /não tem preço público/);
});

test("v3: a frase do topo não repete a projeção antiga; /simulacao e /roi usam o mesmo componente", () => {
  const p = projetar("base", { operador: 0 });
  const f = fraseResumo("Base", p, p, 0);
  assert.doesNotMatch(f, /69,3 mil|se paga no mês 27/); // "1º positivo no mês 14" volta a coincidir no Presumido
  const comp = ler("src/components/financeiro/modelo-financeiro.tsx");
  assert.match(comp, /data-testid="seletor-regime"/);
  assert.match(comp, /data-testid="seletor-faixa"/);
  assert.doesNotMatch(comp, /4\.320|4320|anexo V/); // "nunca 12% fixo" pode aparecer como regra, não como premissa
  for (const pg of ["src/app/simulacao/page.tsx", "src/app/roi/page.tsx"]) assert.match(ler(pg), /<ModeloFinanceiro pagina=/);
});

test("P3 (05/11): investimento único continua R$ 16.000; parecer e consulta só no \"dos quais\"; investidor e 5 modelos a cotar, fora da soma", () => {
  assert.equal(INVESTIMENTO_INICIAL, 16000);
  assert.deepEqual(
    INVESTIMENTO_DOS_QUAIS.map((i) => [i.rotulo, i.valor]),
    [["Parecer da Dra. Beatriz", 4000], ["Consulta de 05/11", 500]],
  );
  assert.ok(INVESTIMENTO_A_COTAR.some((a) => /investidor/.test(a.rotulo) && /SCP/.test(a.situacao) && /R\$ 10\.000/.test(a.situacao) && /mútuo/.test(a.situacao)));
  assert.ok(INVESTIMENTO_A_COTAR.some((a) => /5 modelos de contrato/.test(a.rotulo) && /a cotar/.test(a.situacao)));
  // nenhum custo em duas linhas: parecer/consulta/investidor/modelos não estão no fixo, por contrato, opcionais nem lacunas
  const outras = [...CUSTOS_FIXOS, ...CUSTOS_POR_CONTRATO, ...OPCIONAIS_NAO_SOMADOS].map((c) => c.rotulo);
  for (const r of outras) assert.ok(!/[Pp]arecer|[Cc]onsulta de 05\/11|investidor|modelos de contrato/.test(r), r);
  // a projeção começa em −R$ 16.000 (nada somado por cima do envelope)
  assert.match(ler("src/lib/financeiro/projecao.ts"), /let caixa = -INVESTIMENTO_INICIAL;/);
  const fonte = ler("src/components/financeiro/modelo-financeiro.tsx");
  assert.match(fonte, /INVESTIMENTO_A_COTAR\.map\(/);
  assert.match(fonte, /data-testid="a-cotar-nao-somado"/);
});

test("E622: equilíbrio do rótulo = o do KPI (mesmo custo fixo com os encargos do regime): Simples 10, Presumido 13", () => {
  const fonte = ler("src/components/financeiro/modelo-financeiro.tsx");
  assert.match(fonte, /const equilibrioFixo = unit\.margem > 0 \? Math\.ceil\(custoFixoDe\(\{ custoFixo, regime \}\) \/ unit\.margem\) : null;/);
  // o KPI mostra um número só quando o intervalo fecha ("13", não "13 a 13")
  assert.match(fonte, /Math\.ceil\(unit\.empate\[0\]\) === Math\.ceil\(unit\.empate\[1\]\) \?/);
  const rotulo = (regime: (typeof REGIMES)[number]["id"]) => Math.ceil(custoFixoDe({ custoFixo: CUSTO_FIXO_PADRAO, regime }) / porContrato({ operador: 0, regime }).margem);
  const kpi = (regime: (typeof REGIMES)[number]["id"]) => Math.ceil(porContrato({ operador: 0, regime }).empate[0]);
  for (const r of ["simples", "presumido"] as const) assert.equal(rotulo(r), kpi(r), r);
  assert.deepEqual([kpi("simples"), kpi("presumido")], [10, 13]);
  // sem seletor de operador na tela (R$ 0 fixo)
  assert.doesNotMatch(fonte, /aria-label="Operador local"/);
  assert.match(fonte, /const operador = 0;/);
});

test("E622: a projeção é determinística (sem estado parcial): Pessimista no padrão (Simples) = −R$ 110,0 mil; no Presumido −R$ 169,3 mil; nenhum se paga em 36 meses", () => {
  const a = projetar("pessimista", { operador: 0 });
  assert.deepEqual(a, projetar("pessimista", { operador: 0 }));
  assert.equal(Math.round(a.piorCaixa / 100) / 10, -110);
  assert.equal(a.mesPayback, null);
  const p = projetar("pessimista", { operador: 0, regime: "presumido" });
  assert.equal(Math.round(p.piorCaixa / 100) / 10, -169.3);
  assert.equal(p.mesPayback, null);
});

test("E623: a faixa do Gestor (4%, 20+ imóveis ou administradora, cadastro assistido e contato direto) aparece no seletor", () => {
  const g = TAXA_FAIXAS[TAXA_FAIXAS.length - 1];
  assert.equal(g.taxa, 0.04);
  assert.match(g.carteira, /Gestor: 20\+ imóveis ou administradora/);
  assert.equal(g.detalhe, "cadastro assistido e contato direto");
  const fonte = ler("src/config/premissas-financeiras.ts");
  assert.match(fonte, /FAIXAS_COMISSAO_PADRAO\.map\(/, "lidas da regra de cobrança, sem lista própria");
  assert.match(ler("src/components/financeiro/modelo-financeiro.tsx"), /data-testid="faixa-gestor-detalhe"/);
});
