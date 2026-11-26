/*
  (B) da nota do desenho da pilha (ORDENS-DUET 1096, 1098 e 1107) — o teto do registro da CAUÇÃO.
  Antes: o registro da caução gravava o valor que o dono declarasse, sem teto nenhum (o aluguel do bloco tinha teto
  desde o #4084; a caução não). Depois: um registro de caução nunca passa do que ainda falta registrar — a soma das
  cauções dos blocos do contrato (contrato_blocos.caucao) menos a caução já registrada e ATIVA; e, como no aluguel, sem
  essa conta lida não grava (falha fechado).
  A conta é a ACUMULADA da ORDEM-DUET-1107 (cauçãoEmAbertoAte), escrita já para o E1225 (caução por bloco): até ao bloco
  k, a soma das cauções dos blocos 1..k menos o registrado ativo. Neste avulso o registro é um por contrato, por isso o
  teto é o do último bloco (a soma inteira).
  A ação REAL (marcarPagamentoRecebido) corre com o Supabase falso (harness de src/lib/data/e1072-teto-harness).
  ORDEM-DUET-1112 (os ajustes do coordenador): a recusa diz o motivo. Acima do teto, diz o valor que falta (R$ X); um
  contrato com caução 0 em todos os blocos lidos (a garantia é outra, por exemplo seguro-fiança) diz que não tem caução;
  a lista de blocos vazia é falta de leitura, não teto zero — a mensagem da falha de leitura.
  ORDEM-DUET-1115: o R$ X sai pelo formatBRLExato da casa (@/lib/precos): "R$ 7.500" inteiro, "R$ 2.750,50" com centavos.
  ORDEM-DUET-1132 (correção 2 do coordenador; asserções alteradas com julgamento registado): um registro NOVO de
  caução exige o bloco (E1225) — o caminho sem bloco deixou de gravar ("Escolha o bloco da caução."). Os casos da
  ação passam a chamar com o bloco 1 e conferem as mesmas regras (o teto, a falha fechada, a caução 0, a lista vazia,
  os centavos); o teto de cada caso é o da linha do bloco (min(caução do bloco, acumulado)). A função pura não muda.
  Roda: node --test src/lib/caucao-teto-pela-soma.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as teto from "./caucao-teto.ts";

register("./data/e1072-teto-harness/loader.mjs", import.meta.url);
const { marcarPagamentoRecebido } = await import("./data/contratos-actions.ts");

const cauçãoEmAbertoAte = (teto as unknown as { caucaoEmAbertoAte?: (b: { numero: number; caucao: number }[], registrado: number, ateBloco?: number) => number }).caucaoEmAbertoAte;

test("a conta acumulada (ORDEM-DUET-1107): até ao bloco k, as cauções dos blocos 1..k menos o registrado ativo", () => {
  assert.equal(typeof cauçãoEmAbertoAte, "function", "caucao-teto exporta caucaoEmAbertoAte");
  const blocos = [{ numero: 2, caucao: 3750 }, { numero: 1, caucao: 3750 }];
  assert.equal(cauçãoEmAbertoAte!(blocos, 0), 7500, "sem registro: a soma inteira");
  assert.equal(cauçãoEmAbertoAte!(blocos, 7500, 2), 0, "R$ 7.500 na entrada: o 2º bloco não pede nada");
  assert.equal(cauçãoEmAbertoAte!(blocos, 3750, 2), 3750, "R$ 3.750: o 2º bloco tem R$ 3.750 em aberto");
  assert.equal(cauçãoEmAbertoAte!(blocos, 3750, 1), 0, "até ao 1º bloco, R$ 3.750 cobrem-no");
  assert.equal(cauçãoEmAbertoAte!(blocos, 1000, 1), 2750, "um registro menor deixa a diferença no 1º bloco");
  assert.equal(cauçãoEmAbertoAte!(blocos, 9000), 0, "nunca negativo");
});

// ── a ação real ────────────────────────────────────────────────────────────────────────────────────────────────
const CONTRATO = "11111111-2222-4333-8444-555555555555";
const g = globalThis as unknown as { __e1072Sessao: unknown; __e1072Admin: unknown; __e1072Esperado: unknown };
function sessao(o: { blocos: { numero_bloco: number; caucao: number }[] | "falha"; ativas?: { id: string; valor: number; bloco_id?: string | null }[] }) {
  const inseridos: Record<string, unknown>[] = [];
  return {
    inseridos,
    auth: { getUser: async () => ({ data: { user: { id: "dono-1" } } }) },
    from(tabela: string) {
      const b: Record<string, unknown> = {};
      const resposta =
        tabela === "contratos"
          ? o.blocos === "falha"
            ? { data: null, error: { message: "leitura falhou" } }
            : { data: { id: CONTRATO, contrato_blocos: o.blocos.map((b) => ({ id: idDoBloco(b.numero_bloco), ...b })) }, error: null }
          : tabela === "pagamentos_bloco"
            ? { data: o.ativas ?? [], error: null }
            : { data: null, error: { message: tabela } };
      for (const m of ["select", "eq", "is", "in", "order", "limit"]) b[m] = () => b;
      b.maybeSingle = async () => (tabela === "pagamentos_bloco" ? { data: (o.ativas ?? [])[0] ?? null, error: null } : resposta);
      b.single = async () => ({ data: { id: "novo-1" }, error: null });
      b.insert = (linha: Record<string, unknown>) => (inseridos.push(linha), b);
      b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta).then(ok, ko);
      return b;
    },
  };
}
const idDoBloco = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const B1 = idDoBloco(1);
// ORDEM-DUET-1132: o registro novo de caução leva o bloco (o 1, o 1.º em aberto).
const caucao = (valor: number, blocoId = B1) => ({ blocoId, contratoId: CONTRATO, tipo: "caucao" as const, valor, dataPagamento: "2026-12-20" });
const PASSA = (reais: string) => new RegExp(`^O valor é maior que a caução que falta registrar neste contrato: R\\$\\s${reais.replace(/\./g, "\\.")}\\.$`, "u");
const SEM_CAUCAO = "Este contrato não tem caução: a garantia é outra (por exemplo, seguro-fiança).";
const SEM_CONTA = "Não foi possível conferir a caução deste contrato. Tente de novo em instantes.";
const DOIS = [{ numero_bloco: 1, caucao: 3750 }, { numero_bloco: 2, caucao: 3750 }];

beforeEach(() => {
  g.__e1072Admin = {};
  g.__e1072Esperado = null;
});

test("1. acima do que falta no bloco (a caução do bloco 1, dentro da soma) → recusado, não grava", async () => {
  const s = sessao({ blocos: DOIS });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(3750.01));
  assert.equal(r.ok, false);
  assert.match((r as { error?: string }).error ?? "", PASSA("3.750"), "a recusa diz o valor que falta registrar");
  assert.equal(s.inseridos.length, 0);
});

test("2. igual ao que falta no bloco → aceito (grava a caução do bloco 1)", async () => {
  const s = sessao({ blocos: DOIS });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(3750));
  assert.equal(r.ok, true);
  assert.equal(s.inseridos.length, 1);
  assert.equal(s.inseridos[0].tipo, "caucao");
  assert.equal(s.inseridos[0].bloco_id, B1);
  assert.equal(s.inseridos[0].valor, 3750);
});

test("3. contrato de 1 bloco: o teto é a caução do bloco", async () => {
  let s = sessao({ blocos: [{ numero_bloco: 1, caucao: 3750 }] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(3800));
  assert.equal(r.ok, false);
  assert.match((r as { error?: string }).error ?? "", PASSA("3.750"));
  assert.equal(s.inseridos.length, 0);
  s = sessao({ blocos: [{ numero_bloco: 1, caucao: 3750 }] });
  g.__e1072Sessao = s;
  assert.equal((await marcarPagamentoRecebido(caucao(3750))).ok, true);
  assert.equal(s.inseridos.length, 1);
});

test("4. a conta do contrato não se lê → recusa (falha fechado), não grava", async () => {
  const s = sessao({ blocos: "falha" });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(100));
  assert.equal(r.ok, false);
  assert.equal((r as { error?: string }).error, SEM_CONTA);
  assert.equal(s.inseridos.length, 0);
});

test("5. já há caução ativa no bloco → 'já registrado', como antes (o clique duplo não vira erro de teto)", async () => {
  const s = sessao({ blocos: DOIS, ativas: [{ id: "c1", valor: 3750, bloco_id: B1 }] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(3750));
  assert.equal(r.ok, true);
  assert.equal((r as { jaRegistrado?: boolean }).jaRegistrado, true);
  assert.equal(s.inseridos.length, 0);
});

test("6. caução 0 em todos os blocos lidos (a garantia é outra) → recusa dizendo que o contrato não tem caução", async () => {
  const s = sessao({ blocos: [{ numero_bloco: 1, caucao: 0 }, { numero_bloco: 2, caucao: 0 }] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(1500));
  assert.equal(r.ok, false);
  assert.equal((r as { error?: string }).error, SEM_CAUCAO);
  assert.equal(s.inseridos.length, 0);
});

test("7. a lista de blocos vem vazia → é falta de leitura, não teto zero: a mensagem da falha de leitura", async () => {
  const s = sessao({ blocos: [] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(1500));
  assert.equal(r.ok, false);
  assert.equal((r as { error?: string }).error, SEM_CONTA);
  assert.equal(s.inseridos.length, 0);
});

test("8. (ORDEM-DUET-1115) um teto com centavos sai exato na recusa: R$ 2.750,50", async () => {
  const s = sessao({ blocos: [{ numero_bloco: 1, caucao: 2750.5 }] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(2800));
  assert.equal(r.ok, false);
  assert.match((r as { error?: string }).error ?? "", PASSA("2.750,50"));
  assert.equal(s.inseridos.length, 0);
});
