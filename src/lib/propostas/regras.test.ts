/*
  Propostas (prompt 17): a conta do total e a regra das versões, casos A–J do prompt.
  Roda: node --test src/lib/propostas/regras.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aplicarContraproposta,
  bloqueioContraproposta,
  calcularTotais,
  diferencas,
  fraseMaisTempo,
  mesesDoAnuncio,
  mesesParaFicarMaisTempo,
  mudancasProibidas,
  taxaNoAceite,
  taxaServicoProposta,
  validarTermos,
  venceu,
  type TermosProposta,
} from "./regras.ts";
import { avisoAbaixoDoMinimo, type Negociacao } from "../anuncio/negociacao.ts";

const BASE: TermosProposta = {
  valorBase: 3200,
  descontoPct: 0,
  descontoValor: 0,
  motivoDesconto: null,
  descontoEstadiaPct: 0,
  meses: 4,
  dataEntrada: "2026-11-01",
  condominio: 0,
  consumo: 0,
  limpezasMes: 0,
  valorLimpeza: 0,
  taxaPet: 0,
  limpezaUnica: 0,
};
const NEGOCIA: Negociacao = { aceita: true, itens: ["valor_mensal", "meses", "data_entrada", "limpeza"], descontos: [{ mesesMin: 6, pct: 6 }] };
const LIM = { mesesMin: 1, mesesMax: 6, capacidade: 4 };

test("A — base: R$ 3.200 × 4 + limpeza única R$ 400 = R$ 13.200; taxa 12% = R$ 1.536 só sobre 12.800", () => {
  const t = { ...BASE, limpezaUnica: 400 };
  const tot = calcularTotais(t);
  assert.equal(tot.totalContrato, 13200);
  assert.equal(tot.baseTaxa, 12800);
  assert.equal(taxaServicoProposta(t, 0.12), 1536);
});

test("B — desconto manual de 5% × 6 meses: valor mensal R$ 3.040; total R$ 18.240", () => {
  const tot = calcularTotais({ ...BASE, descontoPct: 5, motivoDesconto: "Estadia longa", meses: 6 });
  assert.equal(tot.valorMensal, 3040);
  assert.equal(tot.totalContrato, 18240);
});

test("C — fora do limite: 8 meses num anúncio de no máximo 6 é recusado", () => {
  const lim = { ...LIM, ...(() => { const m = mesesDoAnuncio(30, 180); return { mesesMin: m.min, mesesMax: m.max }; })() };
  assert.equal(lim.mesesMax, 6);
  assert.match(validarTermos({ ...BASE, meses: 8 }, lim, "2026-10-17")!, /entre 1 e 6/);
  assert.equal(validarTermos(BASE, lim, "2026-10-17"), null);
  assert.match(validarTermos({ ...BASE, dataEntrada: "2026-10-17" }, lim, "2026-10-17")!, /no futuro/);
  assert.match(validarTermos({ ...BASE, valorBase: 0 }, lim, "2026-10-17")!, /maior que zero/);
  assert.match(validarTermos(BASE, lim, "2026-10-17", 5)!, /até 4 pessoas/);
});

test("D — rodadas: a 4ª versão é bloqueada; só aceitar ou recusar", () => {
  const base = { status: "contraproposta" as const, quem: "owner" as const, autorUltimaVersao: "tenant" as const, negociacao: NEGOCIA };
  assert.equal(bloqueioContraproposta({ ...base, versaoAtual: 2 }), null);
  assert.match(bloqueioContraproposta({ ...base, versaoAtual: 3 })!, /3 rodadas/);
  assert.match(bloqueioContraproposta({ ...base, versaoAtual: 1, autorUltimaVersao: "owner" })!, /Aguarde/);
  assert.match(bloqueioContraproposta({ ...base, versaoAtual: 1, status: "aceita" })!, /não está mais/);
});

test("E — faixa: proprietário com 6 imóveis tem 8% congelado no aceite (mesmo que mude de faixa depois)", () => {
  const agora = new Date("2026-10-17T12:00:00Z");
  assert.equal(taxaNoAceite(6, agora), 0.08);
  assert.equal(taxaNoAceite(1, agora), 0.12);
  assert.equal(taxaNoAceite(3, agora), 0.1);
});

test("F — não negocia: o interessado não contrapropõe", () => {
  assert.match(
    bloqueioContraproposta({ status: "vista", versaoAtual: 1, quem: "tenant", autorUltimaVersao: "owner", negociacao: { aceita: false, itens: [], descontos: [] } })!,
    /valor fixo/,
  );
});

test("G — estadia longa: R$ 3.200, faixa 6 meses = 6%, de 4 para 6 meses → R$ 3.008; total R$ 18.048", () => {
  const nova = aplicarContraproposta(BASE, { meses: 6 }, NEGOCIA.descontos);
  assert.equal(nova.descontoEstadiaPct, 6);
  const tot = calcularTotais(nova);
  assert.equal(tot.valorMensal, 3008);
  assert.equal(tot.totalContrato, 18048);
  assert.equal(mesesParaFicarMaisTempo(4, 6, NEGOCIA.descontos), 6);
  assert.equal(mesesParaFicarMaisTempo(6, 6, NEGOCIA.descontos), null);
  assert.equal(mesesParaFicarMaisTempo(2, 6, []), 3);
  assert.equal(fraseMaisTempo(BASE, nova), "Antes: R$ 3.200 × 4 = R$ 12.800 → Agora: R$ 3.008 × 6 = R$ 18.048 (6% de desconto)");
});

test("H — abaixo do mínimo: mínimo 2.950, contraproposta 2.800 → 'tente a partir de R$ 3.000' (nunca 2.950)", () => {
  const aviso = avisoAbaixoDoMinimo(2800, 2950);
  assert.deepEqual(aviso, { tenteAPartirDe: 3000 });
  assert.ok(!JSON.stringify(aviso).includes("2950"));
  assert.equal(avisoAbaixoDoMinimo(3000, 2950), null);
});

test("I — limpeza: de 1 para 2 limpezas/mês (R$ 220 cada) → +R$ 220/mês; o total do contrato confere", () => {
  const v1 = { ...BASE, limpezasMes: 1, valorLimpeza: 220 };
  const v2 = aplicarContraproposta(v1, { limpezasMes: 2 }, []);
  const t1 = calcularTotais(v1);
  const t2 = calcularTotais(v2);
  assert.equal(t2.totalMensal - t1.totalMensal, 220);
  assert.equal(t2.totalContrato, t2.totalMensal * 4);
  assert.equal(t2.baseTaxa, t1.baseTaxa, "limpeza não entra na base da taxa");
});

test("J — item não liberado: só 'meses' liberado → mudar o valor mensal é proibido", () => {
  const nova = aplicarContraproposta(BASE, { valorBase: 3000, meses: 5 }, []);
  assert.deepEqual(mudancasProibidas(BASE, nova, "tenant", ["meses"]), ["Valor mensal"]);
  assert.deepEqual(mudancasProibidas(BASE, aplicarContraproposta(BASE, { meses: 5 }, []), "tenant", ["meses"]), []);
  assert.deepEqual(mudancasProibidas(BASE, nova, "owner", []), [], "o proprietário muda o que quiser");
});

test("histórico: cada item mudado aparece antes → depois", () => {
  const nova = aplicarContraproposta(BASE, { valorBase: 3000, meses: 6 }, NEGOCIA.descontos);
  const d = diferencas(BASE, nova);
  assert.deepEqual(
    d.map((x) => [x.rotulo, x.antes, x.depois]),
    [
      ["Valor mensal", "R$ 3.200", "R$ 3.000"],
      ["Meses", "4 meses", "6 meses"],
      ["Valor mensal com desconto", "R$ 3.200", "R$ 2.820"],
      ["Total do contrato", "R$ 12.800", "R$ 16.920"],
    ],
  );
});

test("validade: só propostas em andamento expiram", () => {
  const agora = new Date("2026-10-20T00:00:00Z");
  assert.equal(venceu("enviada", "2026-10-19T00:00:00Z", agora), true);
  assert.equal(venceu("aceita", "2026-10-19T00:00:00Z", agora), false);
  assert.equal(venceu("vista", "2026-10-21T00:00:00Z", agora), false);
});
