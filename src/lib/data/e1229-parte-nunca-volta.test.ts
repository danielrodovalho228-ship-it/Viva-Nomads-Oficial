/*
  E1229 (ORDENS-DUET 1143 e 1160; condição do coordenador) — um número de parte dado não volta.
  Antes: a próxima parte era calculada só sobre os registros ATIVOS do bloco; com a parte 2 anulada, um registro novo
  voltava a ser a parte 2 (o índice único só olha os ativos, e deixava). Depois: o próximo número é o MAIOR já dado no
  bloco, ativo ou anulado, mais 1 — o complementar que sobra mantém o número dele, e o novo recebe o seguinte.
  Corre a ação REAL (marcarPagamentoRecebido) com o Supabase falso (harness ./e1072-teto-harness/loader.mjs).
  Roda: node --test src/lib/data/e1229-parte-nunca-volta.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

register("./e1072-teto-harness/loader.mjs", import.meta.url);
const { marcarPagamentoRecebido } = await import("./contratos-actions.ts");

const CONTRATO = "11111111-2222-4333-8444-555555555555";
const BLOCO = "aaaaaaaa-0000-4000-8000-000000000001";
const ESPERADO = { aluguel: 3000, contas: 300, limpeza: 200, total: 3500 };
const g = globalThis as unknown as { __e1072Sessao: unknown; __e1072Admin: unknown; __e1072Esperado: unknown };

type Linha = { id: string; parte: number; valor: number; encargos: unknown; anulado: boolean };
/** O Supabase falso: a leitura com `.is("anulado_em", null)` vê só os ativos; sem ela, todos os do bloco. */
function sessao(linhas: Linha[], falhaTodas = false) {
  const inseridos: Record<string, unknown>[] = [];
  return {
    inseridos,
    auth: { getUser: async () => ({ data: { user: { id: "dono-1" } } }) },
    from(tabela: string) {
      let soAtivos = false;
      const b: Record<string, unknown> = {};
      const resposta = () =>
        tabela === "pagamentos_bloco" && falhaTodas && !soAtivos
          ? { data: null, error: { message: "falhou a leitura das partes" } }
          : tabela === "pagamentos_bloco"
          ? { data: linhas.filter((l) => !soAtivos || !l.anulado).map((l) => ({ id: l.id, parte: l.parte, valor: l.valor, encargos: l.encargos })), error: null }
          : tabela === "contratos"
            ? { data: { id: CONTRATO, prazo_total_dias: 60, contrato_blocos: [{ id: BLOCO, numero_bloco: 1, meses: 2, inicio: "2026-12-01", fim: "2027-01-29", valor: 3000 }] }, error: null }
            : { data: null, error: { message: tabela } };
      for (const m of ["select", "eq", "in", "order", "limit"]) b[m] = () => b;
      b.is = (col: string, v: unknown) => ((soAtivos = soAtivos || (col === "anulado_em" && v === null)), b);
      b.maybeSingle = async () => resposta();
      b.single = async () => ({ data: { id: "novo-1" }, error: null });
      b.insert = (linha: Record<string, unknown>) => (inseridos.push(linha), b);
      b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta()).then(ok, ko);
      return b;
    },
  };
}
const registro = (valor: number) => ({ blocoId: BLOCO, contratoId: CONTRATO, tipo: "aluguel" as const, valor, dataPagamento: "2026-12-20" });

beforeEach(() => {
  g.__e1072Admin = {};
  g.__e1072Esperado = ESPERADO;
});

test("1. com a parte 2 anulada (a 1 ativa), um registro novo é a parte 3 — nunca reaproveita o 2", async () => {
  const s = sessao([
    { id: "p1", parte: 1, valor: 2000, encargos: [], anulado: false },
    { id: "p2", parte: 2, valor: 500, encargos: [], anulado: true },
  ]);
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(registro(500));
  assert.equal(r.ok, true);
  assert.equal(s.inseridos.length, 1);
  assert.equal(s.inseridos[0].parte, 3);
});

test("2. com a parte 1 anulada e nenhuma ativa, o registro novo é a parte 2", async () => {
  const s = sessao([{ id: "p1", parte: 1, valor: 3000, encargos: [], anulado: true }]);
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(registro(3000));
  assert.equal(r.ok, true);
  assert.equal(s.inseridos[0].parte, 2);
});

test("3. a parte 1 anulada, a 2 (complementar) ativa: o novo é a parte 3, e a 2 continua a 2", async () => {
  const s = sessao([
    { id: "p1", parte: 1, valor: 2000, encargos: [], anulado: true },
    { id: "p2", parte: 2, valor: 500, encargos: [], anulado: false },
  ]);
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(registro(500));
  assert.equal(r.ok, true);
  assert.equal(s.inseridos[0].parte, 3);
});

test("4. sem nada no bloco, a parte 1 (como antes)", async () => {
  const s = sessao([]);
  g.__e1072Sessao = s;
  assert.equal((await marcarPagamentoRecebido(registro(3000))).ok, true);
  assert.equal(s.inseridos[0].parte, 1);
});

test("5. (PC, ORDEM-DUET-1170) a leitura de todas as partes falha: o registro é recusado — nunca grava com um número adivinhado", async () => {
  const s = sessao([{ id: "p1", parte: 1, valor: 2000, encargos: [], anulado: true }], true);
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(registro(500));
  assert.equal(r.ok, false);
  assert.equal(s.inseridos.length, 0, "nada gravado");
});
