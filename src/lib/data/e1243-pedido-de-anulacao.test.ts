/*
  E1243 (ORDENS-DUET 1213 e 1216; regra do coordenador) — o pedido de anulação continua visível na página de Contratos
  enquanto o chamado estiver aberto. Antes: a confirmação "chamado VN-…" vivia só no estado do componente e morria na
  próxima renderização (o pedido existia, mas a página não o lia). Depois: a leitura dos documentos do contrato junta,
  a cada recibo, o chamado ABERTO que o pede (contexto do contrato + a nota do sistema "[anulacao] pagamento=<id>");
  resolvido ou encerrado, a linha sai.
  Corre a ação REAL (documentosDosContratos) com o Supabase falso (harness ./e1072-teto-harness/loader.mjs).
  Roda: node --test src/lib/data/e1243-pedido-de-anulacao.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

register("./e1072-teto-harness/loader.mjs", import.meta.url);
const { documentosDosContratos } = await import("./documentos-actions.ts");

const CONTRATO = "11111111-2222-4333-8444-555555555555";
const PG = "22222222-3333-4444-8555-666666666666";
const OUTRO_PG = "33333333-4444-4555-8666-777777777777";
const CH = "44444444-5555-4666-8777-888888888888";
const g = globalThis as unknown as { __e1072Sessao: unknown; __e1072Admin: unknown };

function cadeia(resposta: (f: Record<string, unknown>) => { data: unknown; error: unknown }) {
  const filtros: Record<string, unknown> = {};
  const b: Record<string, unknown> = {};
  for (const m of ["select", "order", "is", "not", "limit"]) b[m] = () => b;
  b.eq = (k: string, v: unknown) => ((filtros[k] = v), b);
  b.in = (k: string, v: unknown) => ((filtros[`in:${k}`] = v), b);
  b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta(filtros)).then(ok, ko);
  return b;
}
function sessao() {
  return {
    from: (tabela: string) =>
      cadeia((f) =>
        tabela === "pagamentos_bloco" && f.tipo !== "caucao"
          ? { data: [{ id: PG, contrato_id: CONTRATO, tipo: "aluguel", valor: 2583.33, encargos: [], data_pagamento: "2026-12-20", anulado_motivo: null, contrato_blocos: { numero_bloco: 1, meses: 2, inicio: "2026-12-20", fim: "2027-01-19" } }], error: null }
          : { data: [], error: null },
      ),
  };
}
type Nota = { chamado_id: string; corpo: string; autor: string; interno: boolean };
function admin(o: { status?: string; notas?: Nota[]; falha?: boolean } = {}) {
  const notas = o.notas ?? [{ chamado_id: CH, corpo: `[anulacao] pagamento=${PG}`, autor: "sistema", interno: true }];
  return {
    from: (tabela: string) =>
      cadeia((f) => {
        if (o.falha) return { data: null, error: { message: "falhou" } };
        if (tabela === "chamados") return { data: f.contexto_tipo === "contrato" ? [{ id: CH, numero_publico: "VN-000110", status: o.status ?? "aberto", contexto_id: CONTRATO }] : [], error: null };
        if (tabela === "chamado_mensagens") return { data: notas.filter((n) => (f.autor === undefined || n.autor === f.autor) && (f.interno === undefined || n.interno === f.interno)), error: null };
        return { data: [], error: null };
      }),
  };
}
const recibo = async () => (await documentosDosContratos([CONTRATO]))[CONTRATO].recibos[0] as unknown as { pagamentoId: string; pedidoAnulacao?: string | null };

test("1. o chamado de pedido ABERTO aparece no recibo que ele pede (o número do chamado)", async () => {
  g.__e1072Sessao = sessao();
  g.__e1072Admin = admin();
  assert.equal((await recibo()).pedidoAnulacao, "VN-000110");
});

test("2. em andamento ou à espera da pessoa, continua; resolvido ou encerrado, sai", async () => {
  g.__e1072Sessao = sessao();
  for (const status of ["em_andamento", "aguardando_usuario", "aguardando_aprovacao"]) {
    g.__e1072Admin = admin({ status });
    assert.equal((await recibo()).pedidoAnulacao, "VN-000110", status);
  }
  for (const status of ["resolvido", "encerrado"]) {
    g.__e1072Admin = admin({ status });
    assert.equal((await recibo()).pedidoAnulacao ?? null, null, status);
  }
});

test("3. só a nota do SISTEMA (interna) liga o chamado ao registro; a de outro pagamento não conta", async () => {
  g.__e1072Sessao = sessao();
  g.__e1072Admin = admin({ notas: [{ chamado_id: CH, corpo: `[anulacao] pagamento=${PG}`, autor: "usuario", interno: false }] });
  assert.equal((await recibo()).pedidoAnulacao ?? null, null, "nota de uma pessoa");
  g.__e1072Admin = admin({ notas: [{ chamado_id: CH, corpo: `[anulacao] pagamento=${OUTRO_PG}`, autor: "sistema", interno: true }] });
  assert.equal((await recibo()).pedidoAnulacao ?? null, null, "outro pagamento");
});

test("4. a leitura dos chamados falha: o recibo continua lá, sem a linha (nunca some o documento)", async () => {
  g.__e1072Sessao = sessao();
  g.__e1072Admin = admin({ falha: true });
  const r = await recibo();
  assert.equal(r.pagamentoId, PG);
  assert.equal(r.pedidoAnulacao ?? null, null);
});

test("5. a tela: o dono vê a linha do pedido (e não volta a pedir) enquanto o chamado está aberto", () => {
  const tela = readFileSync(new URL("../../components/documentos/documentos-contrato.tsx", import.meta.url), "utf8");
  assert.match(tela, /data-testid="pedido-anulacao"/);
  assert.match(tela, /anular && r\.pedidoAnulacao && !r\.anulado/);
  assert.match(tela, /anular && !r\.anulado && !r\.pedidoAnulacao && <AnularRegistro/);
});
