/*
  Visão geral do /admin: período, variação honesta, MRR, funil e CSV.
  Roda: node --test src/lib/admin/visao-geral.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolverPeriodo,
  variacao,
  razao,
  mrr,
  funil,
  csvVisaoGeral,
  BLOCOS,
  formatar,
  num,
} from "./visao-geral.ts";

const HOJE = "2026-10-05";

test("períodos fixos terminam hoje e contam dias inclusivos", () => {
  assert.deepEqual(resolverPeriodo({ periodo: "7" }, HOJE), { id: "7", inicio: "2026-09-29", fim: HOJE, dias: 7 });
  assert.equal(resolverPeriodo({ periodo: "90" }, HOJE).inicio, "2026-07-08");
  assert.deepEqual(resolverPeriodo({ periodo: "ano" }, HOJE), { id: "ano", inicio: "2026-01-01", fim: HOJE, dias: 278 });
});

test("período inválido cai em 30 dias", () => {
  for (const q of [{}, { periodo: "xyz" }, { periodo: "custom" }, { periodo: "custom", de: "2026-02-31", ate: "2026-03-10" }, { periodo: "custom", de: "2026-10-01", ate: "2026-09-01" }]) {
    const p = resolverPeriodo(q, HOJE);
    assert.equal(p.id, "30");
    assert.equal(p.dias, 30);
  }
});

test("personalizado: fim no futuro vira hoje; longo demais é recusado", () => {
  assert.deepEqual(resolverPeriodo({ periodo: "custom", de: "2026-09-01", ate: "2026-12-31" }, HOJE), {
    id: "custom",
    inicio: "2026-09-01",
    fim: HOJE,
    dias: 35,
  });
  assert.equal(resolverPeriodo({ periodo: "custom", de: "2020-01-01", ate: HOJE }, HOJE).id, "30");
});

test("variação nunca dá 0% nem ∞ com anterior zero", () => {
  assert.deepEqual(variacao(10, 0), { pct: null, direcao: "sobe", texto: "antes: 0" });
  assert.deepEqual(variacao(0, 0), { pct: null, direcao: "igual", texto: "igual" });
  assert.equal(variacao(null, 3).texto, "—");
  assert.equal(variacao(15, 10).texto, "+50%");
  assert.equal(variacao(5, 10).texto, "-50%");
  assert.equal(variacao(1, 3).pct, -66.7);
});

test("razão com denominador zero é null (a tela mostra —)", () => {
  assert.equal(razao(0, 0), null);
  assert.equal(razao(3, 0), null);
  assert.equal(razao(null, 4), null);
  assert.equal(razao(1, 4), 0.25);
  assert.equal(formatar(razao(0, 0), "pct"), "—");
});

test("num() limpa lixo do JSON", () => {
  assert.equal(num("12"), 12);
  assert.equal(num("NaN"), null);
  assert.equal(num(undefined), null);
  assert.equal(num(""), null);
});

test("MRR pela fonte única de preços; Gestor fica à parte", () => {
  assert.deepEqual(mrr({ essential: 2, pro: 1, free: 5, gestor: 1 }), { valor: 49 * 2 + 129, ativas: 9, semPreco: 1 });
  assert.deepEqual(mrr(null), { valor: null, ativas: 0, semPreco: 0 });
  assert.deepEqual(mrr({}), { valor: 0, ativas: 0, semPreco: 0 });
});

test("nenhum indicador produz NaN/Infinity com tudo zerado ou vazio", () => {
  for (const m of [{}, Object.fromEntries(Object.keys(EXEMPLO).map((k) => [k, 0]))]) {
    for (const b of BLOCOS)
      for (const ind of b.indicadores) {
        const v = ind.calc(m);
        assert.ok(v === null || Number.isFinite(v), `${ind.chave} = ${v}`);
        assert.doesNotMatch(formatar(v, ind.formato), /NaN|Infinity/);
      }
  }
});

test("funil: % sobre a etapa anterior, sem dividir por zero", () => {
  const f = funil({ buscas: 100, visualizacoes: 40, candidaturas_iniciadas: 0, candidaturas: 0, candidaturas_aceitas: 0, contratos: 0 });
  assert.equal(f[0].daAnterior, null);
  assert.equal(f[1].daAnterior, 0.4);
  assert.equal(f[2].daAnterior, 0);
  assert.equal(f[3].daAnterior, null); // anterior era 0
});

test("CSV tem cabeçalho, uma linha por indicador e nota do aluguel", () => {
  const csv = csvVisaoGeral(EXEMPLO, {}, resolverPeriodo({ periodo: "30" }, HOJE), "uberlandia");
  const linhas = csv.split("\n");
  assert.match(linhas[0], /período 2026-09-06 a 2026-10-05 · cidade: uberlandia/);
  assert.equal(linhas[1], "bloco;indicador;atual;anterior;variacao;formula");
  assert.equal(linhas.length, 2 + BLOCOS.reduce((s, b) => s + b.indicadores.length, 0));
  assert.match(csv, /não passa pela plataforma/);
  assert.doesNotMatch(csv, /NaN|Infinity/);
});

const EXEMPLO = {
  novos_proprietarios: 2,
  novos_inquilinos: 3,
  cadastros_iniciados: 10,
  cadastros_concluidos: 5,
  anuncios_novos: 1,
  anuncios_publicados_evento: 1,
  anuncios_iniciados: 4,
  buscas: 120,
  visualizacoes: 50,
  favoritos: 3,
  candidaturas_iniciadas: 8,
  candidaturas: 6,
  pedidos: 2,
  candidaturas_decididas: 4,
  candidaturas_aceitas: 2,
  horas_mediana_decisao: 20.5,
  pedidos_com_resposta: 1,
  contratos: 1,
  comissao_gerada: 360,
  comissao_recebida: 0,
  comissoes_pagas: 0,
  aluguel_contratado: 3000,
  chamados: 0,
  chamados_resolvidos: 0,
  horas_mediana_1a_resposta: null,
};
