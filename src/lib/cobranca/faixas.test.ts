import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assinaturaIsentaComissao,
  comissaoPrimeiroAluguel,
  compararOpcoes,
  faixaPorImoveisAtivos,
  mensalidadePorImoveis,
  proximaFaixa,
  taxaNaAssinatura,
} from "./faixas.ts";

test("comissão do primeiro aluguel por faixa (4.320)", () => {
  assert.equal(comissaoPrimeiroAluguel(4320, 0.12), 518.4);
  assert.equal(comissaoPrimeiroAluguel(4320, 0.1), 432);
  assert.equal(comissaoPrimeiroAluguel(4320, 0.08), 345.6);
  assert.equal(comissaoPrimeiroAluguel(4320, 0.06), 259.2);
  assert.equal(comissaoPrimeiroAluguel(4320, 0.04), 172.8);
});

test("renovação não paga; entradas inválidas = 0", () => {
  assert.equal(comissaoPrimeiroAluguel(4320, 0.12, true), 0);
  assert.equal(comissaoPrimeiroAluguel(-1, 0.12), 0);
  assert.equal(comissaoPrimeiroAluguel(4320, Number.NaN), 0);
});

test("faixas pelo nº de imóveis ativos (limites)", () => {
  const t = (n: number) => faixaPorImoveisAtivos(n).taxa;
  assert.deepEqual([t(0), t(1), t(2), t(3), t(5), t(6), t(15), t(16), t(30), t(31), t(200)],
    [0.12, 0.12, 0.12, 0.1, 0.1, 0.08, 0.08, 0.06, 0.06, 0.04, 0.04]);
});

test("próxima faixa: 'ative mais 1 imóvel'; topo = null", () => {
  assert.deepEqual(proximaFaixa(2), { faltam: 1, taxa: 0.1 });
  assert.deepEqual(proximaFaixa(1), { faltam: 2, taxa: 0.1 });
  assert.equal(proximaFaixa(31), null);
});

test("faixa sobe na hora; queda mantém a taxa antiga por 30 dias", () => {
  const queda = { taxaAnterior: 0.1, em: new Date("2026-10-01T00:00:00Z") };
  const dentro = taxaNaAssinatura({ imoveisAtivos: 2, assinadoEm: new Date("2026-10-20T00:00:00Z"), queda });
  assert.equal(dentro.taxa, 0.1);
  assert.equal(dentro.origem, "faixa_com_queda_recente");
  const fora = taxaNaAssinatura({ imoveisAtivos: 2, assinadoEm: new Date("2026-11-01T00:00:00Z"), queda });
  assert.equal(fora.taxa, 0.12);
  const sobe = taxaNaAssinatura({ imoveisAtivos: 3, assinadoEm: new Date("2026-10-02T00:00:00Z") });
  assert.equal(sobe.taxa, 0.1);
});

test("override do admin exige motivo e validade; vencido ou sem motivo é ignorado", () => {
  const base = { imoveisAtivos: 1, assinadoEm: new Date("2026-10-10T00:00:00Z") };
  const ok = taxaNaAssinatura({ ...base, fixadaPeloAdmin: { taxa: 0.05, motivo: "negociação", validoAte: new Date("2026-12-31T00:00:00Z") } });
  assert.equal(ok.taxa, 0.05);
  assert.equal(ok.origem, "admin");
  const vencido = taxaNaAssinatura({ ...base, fixadaPeloAdmin: { taxa: 0.05, motivo: "x", validoAte: new Date("2026-10-01T00:00:00Z") } });
  assert.equal(vencido.taxa, 0.12);
  const semMotivo = taxaNaAssinatura({ ...base, fixadaPeloAdmin: { taxa: 0.05, motivo: "  ", validoAte: new Date("2026-12-31T00:00:00Z") } });
  assert.equal(semMotivo.taxa, 0.12);
});

test("assinatura: faixas de mensalidade e carência de 90 dias; flag desligada = nunca isenta", () => {
  assert.deepEqual([1, 2, 3, 5, 6, 10, 11, 20, 21, 50].map((n) => mensalidadePorImoveis(n)), [149, 149, 299, 299, 499, 499, 799, 799, 999, 999]);
  const desde = new Date("2026-01-01T00:00:00Z");
  const em = (d: string) => new Date(d);
  assert.equal(assinaturaIsentaComissao({ flagAtiva: true, assinaturaDesde: desde, assinadoEm: em("2026-04-01T00:00:00Z") }), true);
  assert.equal(assinaturaIsentaComissao({ flagAtiva: true, assinaturaDesde: desde, assinadoEm: em("2026-03-31T00:00:00Z") }), false);
  assert.equal(assinaturaIsentaComissao({ flagAtiva: false, assinaturaDesde: desde, assinadoEm: em("2027-01-01T00:00:00Z") }), false);
  assert.equal(assinaturaIsentaComissao({ flagAtiva: true, assinaturaDesde: null, assinadoEm: em("2027-01-01T00:00:00Z") }), false);
});

test("comparador: 3,5 contratos/ano × comissão vs 12 mensalidades", () => {
  assert.deepEqual(compararOpcoes(1, 4320), { comissaoAno: 1814.4, assinaturaAno: 1788 });
});
