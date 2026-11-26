/*
  E1225 — a caução POR BLOCO (ORDEM-DUET-1120). A regra do Daniel (20/11): caução = 50% de CADA bloco, paga no início de
  cada bloco; contrato_blocos.caucao já guarda uma por bloco. O registro passa a seguir o contrato: uma caução por bloco
  (bloco_id gravado), cada uma com o seu comprovante e a sua confirmação.
  O teto é o ACUMULADO da ORDEM-DUET-1107, calculado na leitura: o que ainda se pode registrar até ao bloco k = a soma
  das cauções dos blocos 1..k − a caução já registrada e ATIVA (com ou sem bloco). Um registro antigo pela soma cobre os
  blocos seguintes até ao valor dele; nenhuma linha que já existe é reescrita.
  Os casos do coordenador, na ação REAL (marcarPagamentoRecebido) com o Supabase falso (harness e1072-teto-harness):
   - 2 × R$ 3.750 com R$ 7.500 registrados (no contrato, sem bloco) → o 2.º bloco não tem nada a registrar;
   - com R$ 3.750 registrados → o 2.º bloco tem R$ 3.750 em aberto (entra com o bloco gravado);
   - um registro acima do teto acumulado → recusado;
   - nada é reescrito: a ação só insere (nunca update) e só a linha nova.
  Mais: o 1.º bloco sem nada registrado; caução ativa já no bloco → "já registrado"; bloco que não é do contrato e
  leitura que falha → recusa (falha fechado).
  ORDEM-DUET-1132 (as correções B do coordenador): a ação usa a MESMA regra da tela (linhasDaCaucaoPorBloco) — só
  entra no 1.º bloco em aberto ("Registre antes a caução do bloco N." nos outros) e só até ao em aberto DESSA linha
  (min(caução do bloco, teto acumulado)); e um registro novo de caução EXIGE o bloco ("Escolha o bloco da caução.").
  As cauções antigas, sem bloco, continuam a contar no teto acumulado; nada é reescrito.
  Roda: node --test src/lib/caucao-por-bloco.test.ts
*/
import { register } from "node:module";
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

register("./data/e1072-teto-harness/loader.mjs", import.meta.url);
const { marcarPagamentoRecebido } = await import("./data/contratos-actions.ts");

const CONTRATO = "11111111-2222-4333-8444-555555555555";
const B1 = "aaaaaaaa-0000-4000-8000-000000000001";
const B2 = "aaaaaaaa-0000-4000-8000-000000000002";
const DE_OUTRO = "aaaaaaaa-0000-4000-8000-000000000009";
const DOIS = [{ id: B1, numero_bloco: 1, caucao: 3750 }, { id: B2, numero_bloco: 2, caucao: 3750 }];
const SEM_CONTA = "Não foi possível conferir a caução deste contrato. Tente de novo em instantes.";
const NADA = "Nada a registrar neste bloco: a caução já registrada cobre este bloco.";
const ANTES = (n: number) => `Registre antes a caução do bloco ${n}.`;
const ESCOLHA = "Escolha o bloco da caução.";
const PASSA = (reais: string) => new RegExp(`^O valor é maior que a caução que falta registrar neste contrato: R\\$\\s${reais.replace(/\./g, "\\.")}\\.$`, "u");

const g = globalThis as unknown as { __e1072Sessao: unknown; __e1072Admin: unknown; __e1072Esperado: unknown };
type Ativa = { id: string; valor: number; bloco_id: string | null };
function sessao(o: { blocos: { id: string; numero_bloco: number; caucao: number }[] | "falha"; ativas?: Ativa[] }) {
  const inseridos: Record<string, unknown>[] = [];
  const atualizados: unknown[] = [];
  return {
    inseridos,
    atualizados,
    auth: { getUser: async () => ({ data: { user: { id: "dono-1" } } }) },
    from(tabela: string) {
      const b: Record<string, unknown> = {};
      const resposta =
        tabela === "contratos"
          ? o.blocos === "falha"
            ? { data: null, error: { message: "leitura falhou" } }
            : { data: { id: CONTRATO, contrato_blocos: o.blocos }, error: null }
          : tabela === "pagamentos_bloco"
            ? { data: o.ativas ?? [], error: null }
            : { data: null, error: { message: tabela } };
      for (const m of ["select", "eq", "is", "in", "order", "limit"]) b[m] = () => b;
      b.maybeSingle = async () => (tabela === "pagamentos_bloco" ? { data: (o.ativas ?? [])[0] ?? null, error: null } : resposta);
      b.single = async () => ({ data: { id: "novo-1" }, error: null });
      b.insert = (linha: Record<string, unknown>) => (inseridos.push(linha), b);
      b.update = (x: unknown) => (atualizados.push(x), b);
      b.upsert = (x: unknown) => (atualizados.push(x), b);
      b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta).then(ok, ko);
      return b;
    },
  };
}
const caucao = (blocoId: string, valor: number) => ({ blocoId, contratoId: CONTRATO, tipo: "caucao" as const, valor, dataPagamento: "2026-12-20" });
const erro = (r: unknown) => (r as { error?: string }).error;

beforeEach(() => {
  g.__e1072Admin = {};
  g.__e1072Esperado = null;
});

test("1. 2 × R$ 3.750 com R$ 7.500 registrados → o 2.º bloco não tem nada a registrar (recusa, sem gravar)", async () => {
  const s = sessao({ blocos: DOIS, ativas: [{ id: "antiga", valor: 7500, bloco_id: null }] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B2, 3750));
  assert.equal(r.ok, false);
  assert.equal(erro(r), NADA);
  assert.equal(s.inseridos.length, 0);
  assert.equal(s.atualizados.length, 0, "a linha antiga não é reescrita");
});

test("2. com R$ 3.750 registrados → o 2.º bloco tem R$ 3.750 em aberto: entra, com o bloco gravado", async () => {
  const s = sessao({ blocos: DOIS, ativas: [{ id: "antiga", valor: 3750, bloco_id: null }] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B2, 3750));
  assert.equal(r.ok, true);
  assert.equal(s.inseridos.length, 1);
  assert.equal(s.inseridos[0].tipo, "caucao");
  assert.equal(s.inseridos[0].bloco_id, B2, "a caução fica no bloco");
  assert.equal(s.inseridos[0].valor, 3750);
  assert.equal(s.atualizados.length, 0, "a linha antiga não é reescrita");
});

test("3. acima do teto acumulado → recusado, dizendo o que falta", async () => {
  const s = sessao({ blocos: DOIS, ativas: [{ id: "antiga", valor: 3750, bloco_id: null }] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B2, 3750.01));
  assert.equal(r.ok, false);
  assert.match(erro(r) ?? "", PASSA("3.750"));
  assert.equal(s.inseridos.length, 0);
});

test("4. o 1.º bloco sem nada registrado: o teto é a caução do bloco 1 (não a soma)", async () => {
  let s = sessao({ blocos: DOIS });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B1, 7500));
  assert.equal(r.ok, false, "até ao bloco 1, só R$ 3.750");
  assert.match(erro(r) ?? "", PASSA("3.750"));
  assert.equal(s.inseridos.length, 0);
  s = sessao({ blocos: DOIS });
  g.__e1072Sessao = s;
  assert.equal((await marcarPagamentoRecebido(caucao(B1, 3750))).ok, true);
  assert.equal(s.inseridos[0].bloco_id, B1);
});

test("5. o 2.º bloco depois do 1.º registrado no bloco: R$ 3.750 em aberto", async () => {
  const s = sessao({ blocos: DOIS, ativas: [{ id: "c1", valor: 3750, bloco_id: B1 }] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B2, 3750));
  assert.equal(r.ok, true);
  assert.equal(s.inseridos[0].bloco_id, B2);
});

test("6. já há caução ativa NESTE bloco → 'já registrado', sem gravar", async () => {
  const s = sessao({ blocos: DOIS, ativas: [{ id: "c1", valor: 3750, bloco_id: B1 }] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B1, 3750));
  assert.equal(r.ok, true);
  assert.equal((r as { jaRegistrado?: boolean }).jaRegistrado, true);
  assert.equal((r as { id?: string }).id, "c1");
  assert.equal(s.inseridos.length, 0);
});

test("7. o bloco não é deste contrato → recusa (falha fechado), sem gravar", async () => {
  const s = sessao({ blocos: DOIS });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(DE_OUTRO, 100));
  assert.equal(r.ok, false);
  assert.equal(erro(r), SEM_CONTA);
  assert.equal(s.inseridos.length, 0);
});

test("8. a leitura falha → recusa (falha fechado), sem gravar", async () => {
  const s = sessao({ blocos: "falha" });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B2, 100));
  assert.equal(r.ok, false);
  assert.equal(erro(r), SEM_CONTA);
  assert.equal(s.inseridos.length, 0);
});

test("9. (1132) com o bloco 1 vazio, uma chamada direta para o bloco 2 é recusada: registre antes o bloco 1", async () => {
  const s = sessao({ blocos: DOIS });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B2, 3750));
  assert.equal(r.ok, false);
  assert.equal(erro(r), ANTES(1));
  assert.equal(s.inseridos.length, 0);
});

test("10. (1132) no bloco 2, acima da caução DO BLOCO 2 é recusado, mesmo com o acumulado maior", async () => {
  // O bloco 1 tem o seu registro (menor que a caução dele): até ao bloco 2, o acumulado é 7.500 − 1.000 = 6.500, mas o
  // bloco 2 só pede R$ 3.750.
  const s = sessao({ blocos: DOIS, ativas: [{ id: "c1", valor: 1000, bloco_id: B1 }] });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao(B2, 4000));
  assert.equal(r.ok, false);
  assert.match(erro(r) ?? "", PASSA("3.750"));
  assert.equal(s.inseridos.length, 0);
});

test("11. (1132) um registro novo de caução sem bloco é recusado: escolha o bloco", async () => {
  const s = sessao({ blocos: DOIS });
  g.__e1072Sessao = s;
  const r = await marcarPagamentoRecebido(caucao("", 3750));
  assert.equal(r.ok, false);
  assert.equal(erro(r), ESCOLHA);
  assert.equal(s.inseridos.length, 0);
});
