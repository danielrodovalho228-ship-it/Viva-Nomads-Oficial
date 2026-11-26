/*
  E1072 — nota do desenho da pilha (ORDENS-DUET 1054 e 1095): o teto vale para TODO o registro, incluindo o 1º.
  Antes: só o registro COMPLEMENTAR (parte 2 em diante) era conferido contra o que o contrato diz que o bloco custa
  ("O valor passa do que falta registrar neste bloco."); o 1º registro gravava o que o dono declarasse, mesmo acima do
  bloco (Dúvida 5 do #4084). Depois: o 1º registro também não passa do que o contrato diz que o bloco custa (aluguel,
  contas do período e limpeza de preparação, cada um); e, como no complementar, sem a conta do contrato lida não grava.
  Corre a ação REAL (marcarPagamentoRecebido) com o Supabase falso (harness em ./e1072-teto-harness/loader.mjs).
  Roda: node --test src/lib/data/e1072-teto-todo-registro.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

register("./e1072-teto-harness/loader.mjs", import.meta.url);
const { marcarPagamentoRecebido } = await import("./contratos-actions.ts");

const CONTRATO = "11111111-2222-4333-8444-555555555555";
const BLOCO = "aaaaaaaa-0000-4000-8000-000000000001";
// O contrato provado ao vivo em 20/11: o 1º bloco de 31 dias custa 2.583,33 + contas 310,00 + limpeza 250,00.
const ESPERADO = { aluguel: 2583.33, contas: 310, limpeza: 250, total: 3143.33 };
const g = globalThis as unknown as { __e1072Sessao: unknown; __e1072Admin: unknown; __e1072Esperado: unknown };

type Ativo = { id: string; parte: number; valor: number; encargos: unknown };
function sessao(ativos: Ativo[]) {
  const inseridos: Record<string, unknown>[] = [];
  const s = {
    inseridos,
    auth: { getUser: async () => ({ data: { user: { id: "dono-1" } } }) },
    from(tabela: string) {
      const b: Record<string, unknown> = {};
      const resposta =
        tabela === "pagamentos_bloco"
          ? { data: ativos, error: null }
          : tabela === "contratos"
            ? { data: { id: CONTRATO, prazo_total_dias: 31, contrato_blocos: [{ id: BLOCO, numero_bloco: 1, meses: 1, inicio: "2026-12-20", fim: "2027-01-19", valor: 2583.33 }] }, error: null }
            : { data: null, error: { message: tabela } };
      for (const m of ["select", "eq", "is", "in", "order"]) b[m] = () => b;
      b.maybeSingle = async () => resposta;
      b.single = async () => ({ data: { id: "novo-1" }, error: null });
      b.insert = (linha: Record<string, unknown>) => (inseridos.push(linha), b);
      b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta).then(ok, ko);
      return b;
    },
  };
  return s;
}
const registro = (valor: number, contas = 0, limpeza = 0) => ({
  blocoId: BLOCO, contratoId: CONTRATO, tipo: "aluguel" as const, valor, dataPagamento: "2026-12-20", componentes: { contas, limpeza },
});

beforeEach(() => {
  g.__e1072Admin = {};
  g.__e1072Esperado = ESPERADO;
});

test("1. o 1º registro acima do aluguel do bloco é recusado — não grava nada", async () => {
  const s = sessao([]);
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(registro(3000, 310, 250));
  assert.deepEqual(r, { ok: false, error: "O valor passa do que falta registrar neste bloco." });
  assert.equal(s.inseridos.length, 0);
});

test("2. o 1º registro com contas ou limpeza acima das do bloco também é recusado", async () => {
  for (const [contas, limpeza] of [[400, 250], [310, 300]]) {
    const s = sessao([]);
    g.__e1072Sessao = s;
    const r = await marcarPagamentoRecebido(registro(2583.33, contas, limpeza));
    assert.equal(r.ok, false, `contas ${contas}, limpeza ${limpeza}`);
    assert.equal(s.inseridos.length, 0);
  }
});

test("3. o 1º registro dentro do bloco (inteiro ou só uma parte) grava, com parte 1", async () => {
  for (const [valor, contas, limpeza] of [[2583.33, 310, 250], [2500, 0, 0]]) {
    const s = sessao([]);
    g.__e1072Sessao = s;
    const r = await marcarPagamentoRecebido(registro(valor, contas, limpeza));
    assert.equal(r.ok, true, `${valor}`);
    assert.equal(s.inseridos.length, 1);
    assert.equal(s.inseridos[0].parte, 1);
    assert.equal(s.inseridos[0].valor, valor);
  }
});

test("4. sem a conta do contrato lida, o 1º registro não grava (como o complementar)", async () => {
  const s = sessao([]);
  g.__e1072Sessao = s;
  g.__e1072Esperado = "falha";
  const r = await marcarPagamentoRecebido(registro(2583.33, 310, 250));
  assert.equal(r.ok, false);
  assert.equal(s.inseridos.length, 0);
});

test("5. o complementar continua como estava: recusa o que passa do que falta e grava o resto com a parte seguinte", async () => {
  const ativos = [{ id: "p1", parte: 1, valor: 2583.33, encargos: [] }];
  let s = sessao(ativos);
  g.__e1072Sessao = s;
  assert.equal((await marcarPagamentoRecebido(registro(10, 0, 0))).ok, false, "aluguel já todo registrado");
  assert.equal(s.inseridos.length, 0);
  s = sessao(ativos);
  g.__e1072Sessao = s;
  assert.equal((await marcarPagamentoRecebido(registro(0, 310, 250))).ok, true);
  assert.equal(s.inseridos[0].parte, 2);
});
