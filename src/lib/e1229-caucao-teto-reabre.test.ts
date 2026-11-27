/*
  E1229 (ORDEM-DUET-1143): na caução, a anulada SAI do teto acumulado — o teto volta a abrir. Com a caução do bloco 1
  anulada, o bloco 1 volta a ter a caução dele em aberto e um registro novo entra (a anulada não conta como "já
  registrado" nem como valor registrado). Corre a ação REAL com o Supabase falso (harness e1072), que devolve só os
  ativos quando a leitura pede `anulado_em is null` — sem esse filtro, a anulada contaria.
  Roda: node --test src/lib/e1229-caucao-teto-reabre.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

register("./data/e1072-teto-harness/loader.mjs", import.meta.url);
const { marcarPagamentoRecebido } = await import("./data/contratos-actions.ts");

const CONTRATO = "11111111-2222-4333-8444-555555555555";
const B1 = "aaaaaaaa-0000-4000-8000-000000000001";
const B2 = "aaaaaaaa-0000-4000-8000-000000000002";
const g = globalThis as unknown as { __e1072Sessao: unknown; __e1072Admin: unknown; __e1072Esperado: unknown };
type Linha = { id: string; valor: number; bloco_id: string | null; anulado: boolean };

function sessao(linhas: Linha[]) {
  const inseridos: Record<string, unknown>[] = [];
  return {
    inseridos,
    auth: { getUser: async () => ({ data: { user: { id: "dono-1" } } }) },
    from(tabela: string) {
      let soAtivos = false;
      const b: Record<string, unknown> = {};
      const resposta = () =>
        tabela === "contratos"
          ? { data: { id: CONTRATO, contrato_blocos: [{ id: B1, numero_bloco: 1, caucao: 3750 }, { id: B2, numero_bloco: 2, caucao: 3750 }] }, error: null }
          : tabela === "pagamentos_bloco"
            ? { data: linhas.filter((l) => !soAtivos || !l.anulado).map((l) => ({ id: l.id, valor: l.valor, bloco_id: l.bloco_id })), error: null }
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
const caucao = (blocoId: string, valor: number) => ({ blocoId, contratoId: CONTRATO, tipo: "caucao" as const, valor, dataPagamento: "2026-12-20" });

beforeEach(() => {
  g.__e1072Admin = {};
  g.__e1072Esperado = null;
});

test("1. a caução do bloco 1 anulada: o teto reabre e um registro novo no bloco 1 entra", async () => {
  const s = sessao([{ id: "c1", valor: 3750, bloco_id: B1, anulado: true }]);
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B1, 3750));
  assert.equal(r.ok, true);
  assert.equal((r as { jaRegistrado?: boolean }).jaRegistrado, undefined, "a anulada não é 'já registrado'");
  assert.equal(s.inseridos.length, 1);
  assert.equal(s.inseridos[0].bloco_id, B1);
});

test("2. a caução de antes (sem bloco, pela soma) anulada: os dois blocos voltam a abrir pela ordem", async () => {
  const s = sessao([{ id: "antiga", valor: 7500, bloco_id: null, anulado: true }]);
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B1, 3750));
  assert.equal(r.ok, true, "com a antiga ativa, o bloco 1 não teria nada a registrar");
  assert.equal(s.inseridos.length, 1);
});
