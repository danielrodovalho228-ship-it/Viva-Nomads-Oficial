/* Roda: node --test src/lib/funil/regras.test.ts — Prompt 50: fórmulas do funil com massa (contas de teste fora). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { FORMULAS, buscaPedido, contaIntencao, mediana, ordenarPorQueda, rascunhoPublicado, semanas, solicitacaoAprovacao, verificacaoPorDegrau, visitaConta, type Conta, type Etapa } from "./regras.ts";

const P = { de: "2026-10-16T00:00:00Z", ate: "2026-10-23T00:00:00Z" };
const em = (d: number, h = 12) => `2026-10-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00Z`;

test("cada etapa tem a fórmula escrita", () => {
  for (const f of Object.values(FORMULAS)) assert.ok(f.formula.length > 20 && f.rotulo.length > 5);
});

test("visita → conta e conta → intenção: sessões distintas, contas de teste fora", () => {
  const visitas = [
    ...Array.from({ length: 20 }, (_, i) => ({ sessao: `s${i}`, em: em(18), teste: false })),
    { sessao: "s0", em: em(19), teste: false }, // mesma sessão: conta uma
    { sessao: "t1", em: em(18), teste: true },
    { sessao: "antes", em: em(10), teste: false }, // fora do período
  ];
  const contas: Conta[] = [
    { id: "a", criadaEm: em(18), respondeuIntencao: true, teste: false },
    { id: "b", criadaEm: em(19), respondeuIntencao: true, teste: false },
    { id: "c", criadaEm: em(20), respondeuIntencao: false, teste: false },
    { id: "d", criadaEm: em(20), respondeuIntencao: false, teste: false },
    { id: "teste", criadaEm: em(20), respondeuIntencao: true, teste: true },
  ];
  const v = visitaConta(visitas, contas, P);
  assert.equal(v.valor, 20); // 4 / 20
  assert.deepEqual(v.base, { de: 4, total: 20 });
  const c = contaIntencao(contas, P);
  assert.equal(c.valor, 50);
  assert.deepEqual(c.ids, ["c", "d"]); // o clique abre quem ainda não respondeu
});

test("busca → 1º pedido: mediana em horas; rascunho → publicado em %", () => {
  const m = buscaPedido(
    [
      { id: "m1", primeiraBuscaEm: em(17, 10), primeiroPedidoEm: em(17, 12), teste: false }, // 2 h
      { id: "m2", primeiraBuscaEm: em(17, 10), primeiroPedidoEm: em(18, 10), teste: false }, // 24 h
      { id: "m3", primeiraBuscaEm: em(17, 10), primeiroPedidoEm: em(17, 16), teste: false }, // 6 h
      { id: "t", primeiraBuscaEm: em(17, 10), primeiroPedidoEm: em(17, 11), teste: true },
      { id: "sem", primeiraBuscaEm: em(17, 10), primeiroPedidoEm: null, teste: false },
    ],
    P,
  );
  assert.equal(m.valor, 6);
  assert.equal(m.base.total, 3);
  const r = rascunhoPublicado(
    [
      { id: "r1", iniciadoEm: em(17), publicadoEm: em(18), teste: false },
      { id: "r2", iniciadoEm: em(17), publicadoEm: null, teste: false },
      { id: "r3", iniciadoEm: em(18), publicadoEm: null, teste: false },
      { id: "r4", iniciadoEm: em(18), publicadoEm: em(19), teste: true },
    ],
    P,
  );
  assert.equal(r.valor, 33.3);
  assert.deepEqual(r.ids, ["r2", "r3"]);
});

test("parceiro: tempo de resposta da Viva (mediana das decididas no período)", () => {
  const s = solicitacaoAprovacao(
    [
      { id: "p1", criadaEm: em(16, 10), decididaEm: em(16, 14), teste: false },
      { id: "p2", criadaEm: em(16, 10), decididaEm: em(17, 10), teste: false },
      { id: "p3", criadaEm: em(17, 10), decididaEm: null, teste: false },
    ],
    P,
  );
  assert.equal(s.valor, 14);
});

test("verificação % por degrau", () => {
  const { etapa, degraus } = verificacaoPorDegrau(
    [
      { usuarioId: "u1", tentativas: [{ em: em(17), ok: true }], filaHumana: false, teste: false },
      { usuarioId: "u2", tentativas: [{ em: em(17), ok: false }, { em: em(17, 13), ok: true }], filaHumana: false, teste: false },
      { usuarioId: "u3", tentativas: [{ em: em(17), ok: false }, { em: em(17, 13), ok: false }], filaHumana: true, teste: false },
      { usuarioId: "u4", tentativas: [{ em: em(18), ok: false }], filaHumana: false, teste: false },
      { usuarioId: "t", tentativas: [{ em: em(18), ok: true }], filaHumana: false, teste: true },
    ],
    P,
  );
  assert.equal(etapa.valor, 50);
  assert.deepEqual(degraus.map((d) => [d.degrau, d.n, d.pct]), [["iniciou", 4, 100], ["aprovada_1a", 1, 25], ["aprovada_2a", 1, 25], ["fila_humana", 1, 25]]);
});

test("topo = maior queda na semana (pontos para %, variação relativa para horas)", () => {
  const e = (chave: Etapa["chave"], tipo: Etapa["tipo"], valor: number | null): Etapa => ({ chave, rotulo: "", formula: "", tipo, valor, base: { de: 0, total: 0 }, ids: [] });
  const ordem = ordenarPorQueda(
    [e("visita_conta", "percentual", 18), e("conta_intencao", "percentual", 40), e("busca_pedido", "horas", 30), e("verificacao", "percentual", null)],
    [e("visita_conta", "percentual", 20), e("conta_intencao", "percentual", 55), e("busca_pedido", "horas", 20), e("verificacao", "percentual", 60)],
  );
  // conta→intenção caiu 15 pontos; busca→pedido piorou 50%; visita→conta 2 pontos.
  assert.deepEqual(ordem.map((x) => x.chave), ["busca_pedido", "conta_intencao", "visita_conta", "verificacao"]);
  assert.equal(ordem[3].queda, null);
});

test("mediana e semanas", () => {
  assert.equal(mediana([]), null);
  assert.equal(mediana([3, 1, 2]), 2);
  assert.equal(mediana([4, 1, 2, 3]), 2.5);
  const s = semanas(new Date("2026-10-23T12:00:00Z"));
  assert.equal(s.atual.de, "2026-10-16T12:00:00.000Z");
  assert.equal(s.anterior.ate, s.atual.de);
});
