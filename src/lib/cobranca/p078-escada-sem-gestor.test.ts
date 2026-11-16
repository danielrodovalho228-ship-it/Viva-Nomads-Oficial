/*
  Prompt 078 (decisão do Daniel, 16/11/2026) — lançar sem o Plano Gestor público de 4%.
  A escada pública é 1–2 = 12% · 3–5 = 10% · 6–15 = 8% · 16 ou mais = 6%. Carteira a partir de 20 imóveis ou
  administradora: sem taxa publicada, "fale com a Viva" (condições caso a caso, pela taxa fixada pelo admin).
  Roda: node --test src/lib/cobranca/p078-escada-sem-gestor.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as regra from "./regra.ts";
import * as planos from "../../config/planos.ts";
import { FRASE_ESCADA_TAXAS } from "../../config/textos-regulados.ts";

const { FAIXAS_COMISSAO_PADRAO, faixaPorImoveisAtivos, taxaNaAssinatura, proximaFaixa, escadaTaxasTexto, TEXTO_REGRA_UNICA, DESCRICAO_PRECOS } = regra;
const ler = (p: string) => readFileSync(p, "utf8");
const DIA = 86_400_000;
const hoje = new Date("2026-11-16T12:00:00Z");

test("078: a escada padrão tem 4 faixas e a última, sem teto, é 16 ou mais = 6%", () => {
  assert.deepEqual(
    FAIXAS_COMISSAO_PADRAO.map((f) => [f.minImoveis, f.maxImoveis, f.taxa]),
    [[1, 2, 0.12], [3, 5, 0.1], [6, 15, 0.08], [16, null, 0.06]],
  );
  assert.ok(FAIXAS_COMISSAO_PADRAO.every((f) => !("gestor" in f)), "nenhuma faixa padrão é 'gestor'");
  assert.equal("FAIXA_GESTOR" in regra, false, "FAIXA_GESTOR saiu da regra");
});

test("078: faixaPorImoveisAtivos para 1, 2, 3, 5, 6, 15, 16, 19, 20, 50 e 500", () => {
  const esperado: [number, number][] = [[1, 12], [2, 12], [3, 10], [5, 10], [6, 8], [15, 8], [16, 6], [19, 6], [20, 6], [50, 6], [500, 6]];
  for (const [n, pct] of esperado) assert.equal(Math.round(faixaPorImoveisAtivos(n).taxa * 100), pct, `${n} imóveis`);
  assert.equal(proximaFaixa(16), null, "na última faixa não há próxima");
  assert.deepEqual(proximaFaixa(15), { faltam: 1, taxa: 0.06 });
});

test("078: conta de administradora com 3 imóveis paga 10%, não 4% (o tipo da conta não escolhe faixa)", () => {
  // O servidor não manda mais o tipo da conta para a regra; mesmo que alguém mande, a regra ignora.
  const e = { tipo: "novo" as const, imoveisAtivos: 3, assinadoEm: hoje, administradora: true };
  const t = taxaNaAssinatura(e);
  assert.equal(t.taxa, 0.1);
  assert.equal(t.origem, "faixa");
  const servidor = ler("src/lib/cobranca/taxa-servidor.ts");
  assert.doesNotMatch(servidor, /administradora:/, "taxaDoDonoAgora não passa o tipo da conta");
  assert.doesNotMatch(servidor, /gestor: true/, "a faixa sem teto da tabela não é marcada como Gestor");
  assert.doesNotMatch(ler("src/lib/cobranca/regra.ts"), /e\.administradora/);
});

test("078: taxa fixada pelo admin (4% com motivo e validade) vence a faixa; vencida, volta a faixa", () => {
  const fixada = { taxa: 0.04, motivo: "Parceira fundadora (E566)", validoAte: new Date(hoje.getTime() + 30 * DIA) };
  const valida = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: hoje, fixadaPeloAdmin: fixada });
  assert.equal(valida.taxa, 0.04);
  assert.equal(valida.origem, "admin");
  assert.equal(valida.faixaNoFechamento.taxa, 0.1, "a faixa do fechamento continua registrada");
  const vencida = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: hoje, fixadaPeloAdmin: { ...fixada, validoAte: new Date(hoje.getTime() - DIA) } });
  assert.equal(vencida.taxa, 0.1);
  assert.equal(vencida.origem, "faixa");
  const semMotivo = taxaNaAssinatura({ tipo: "novo", imoveisAtivos: 3, assinadoEm: hoje, fixadaPeloAdmin: { ...fixada, motivo: " " } });
  assert.equal(semMotivo.taxa, 0.1, "sem motivo a fixação não vale");
});

test("078: congelamento — proposta com taxa_congelada = 0.04 continua com 4%", () => {
  assert.ok(planos.TAXAS_HISTORICAS.includes(0.04), "o 0,04 fica nas taxas históricas");
  assert.equal(planos.taxaDoContrato(0.04, null), 0.04);
  assert.equal(planos.taxaDoContrato("0.04", "free"), 0.04);
  assert.equal(planos.taxaDoContrato(0.06, null), 0.06);
});

test("078: a linha de carteiras é fonte única, com o 20 vindo de constante, sem taxa", () => {
  assert.equal(planos.CARTEIRAS_MINIMO_IMOVEIS, 20);
  assert.equal(planos.TEXTO_CARTEIRAS, "Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.");
  assert.match(ler("src/config/planos.ts"), /TEXTO_CARTEIRAS = `Carteira a partir de \$\{CARTEIRAS_MINIMO_IMOVEIS\} imóveis/);
  assert.doesNotMatch(planos.TEXTO_CARTEIRAS, /%/);
  for (const saiu of ["PORTA_GESTOR_TEXTO", "GESTOR_PRECO", "GESTOR_TEXTO", "GESTOR_RESUMO", "GESTOR_DIFERENCIAIS"]) {
    assert.equal(saiu in planos, false, `${saiu} saiu de config/planos`);
  }
});

test("078: os textos da escada saem da regra — 16 ou mais = 6%, 'até 6%', e a linha de carteiras no lugar do Gestor", () => {
  assert.equal(escadaTaxasTexto(), "1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16 ou mais imóveis: 6%");
  assert.equal(regra.escadaTaxasCurta(), "1–2 = 12%, 3–5 = 10%, 6–15 = 8%, 16 ou mais = 6%");
  assert.match(TEXTO_REGRA_UNICA, /menor a taxa \(até 6%\)/);
  assert.match(DESCRICAO_PRECOS, /até 6%/);
  assert.equal(FRASE_ESCADA_TAXAS, `Quanto mais imóveis ativos, menor a taxa: ${escadaTaxasTexto()}. ${planos.TEXTO_CARTEIRAS}`);
  for (const t of [TEXTO_REGRA_UNICA, DESCRICAO_PRECOS, FRASE_ESCADA_TAXAS, escadaTaxasTexto()]) {
    assert.doesNotMatch(t, /Gestor|(?<![\d,.])4\s?%/);
  }
  // Nenhum número da escada escrito à mão nos textos da regra.
  const fonte = ler("src/lib/cobranca/regra.ts");
  assert.match(fonte, /TEXTO_REGRA_UNICA =\s*`[^`]*\$\{TAXA_MENOR_TEXTO\}/);
  assert.match(fonte, /DESCRICAO_PRECOS =\s*`[^`]*\$\{TAXA_MENOR_TEXTO\}/);
});
