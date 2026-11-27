/*
  E1067 — fusão do #4078, ORDEM-DUET-1202 (D3b): a linha do recibo em "Documentos do contrato" leva o TOTAL do registro
  (valor + encargos, ORDEM-DUET-1194), provado no COMPORTAMENTO: a ação REAL (documentosDosContratos) com um Supabase
  falso e um registro COM encargos (contas do período e limpeza) — o mutante que mantém a chamada e passa encargos vazios
  volta a mostrar só o componente do aluguel e cai aqui.
  Roda: node --test src/lib/data/e1067-linha-recibo-total.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { textoLinhaRecibo } from "../documentos-linha.ts";

register("./e1072-teto-harness/loader.mjs", import.meta.url);
const { documentosDosContratos } = await import("./documentos-actions.ts");

const CONTRATO = "11111111-2222-4333-8444-555555555555";
const g = globalThis as unknown as { __e1072Sessao: unknown };

/** O Supabase falso da sessão: as quatro leituras da ação. */
function sessao(pagamentos: Record<string, unknown>[]) {
  return {
    from(tabela: string) {
      const filtros: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      for (const m of ["select", "in", "order", "is"]) b[m] = () => b;
      b.eq = (k: string, v: unknown) => ((filtros[k] = v), b);
      const resposta = () => {
        if (tabela === "pagamentos_bloco") {
          if (filtros.tipo === "caucao") return { data: [], error: null };
          return { data: pagamentos, error: null };
        }
        return { data: [], error: null };
      };
      b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta()).then(ok, ko);
      return b;
    },
  };
}

test("1. um registro COM encargos: a linha leva o TOTAL (aluguel + contas + limpeza), não só o componente", async () => {
  g.__e1072Sessao = sessao([
    {
      id: "pg-1",
      contrato_id: CONTRATO,
      tipo: "aluguel",
      valor: 2583.33,
      encargos: [
        { rotulo: "Contas do período", valor: 310 },
        { rotulo: "Limpeza de preparação", valor: 250 },
      ],
      data_pagamento: "2026-12-20",
      anulado_motivo: null,
      contrato_blocos: { numero_bloco: 1, meses: 2, inicio: "2026-12-20", fim: "2027-01-19" },
    },
  ]);
  const r = (await documentosDosContratos([CONTRATO]))[CONTRATO];
  assert.equal(r.recibos.length, 1);
  const rec = r.recibos[0];
  assert.equal(rec.total, 3143.33, "o total do registro, com os encargos");
  // E1233 (ORDEM-DUET 1208, asserção alterada): a identificação do bloco e o período dd/mm sem ano.
  assert.equal(textoLinhaRecibo(rec), "Recibo em preparação · Bloco 1 · R$ 3.143,33 · 20/12 a 19/01");
});

test("2. a caução: o valor dela (os encargos não contam), sem período", async () => {
  g.__e1072Sessao = sessao([
    { id: "pg-2", contrato_id: CONTRATO, tipo: "caucao", valor: 1292, encargos: [{ rotulo: "Contas do período", valor: 99 }], data_pagamento: "2026-12-20", anulado_motivo: null, contrato_blocos: null },
  ]);
  const rec = (await documentosDosContratos([CONTRATO]))[CONTRATO].recibos[0];
  assert.equal(rec.total, 1292);
  // E1233 (ORDEM-DUET 1208, asserção alterada): sem bloco, a caução é "do contrato".
  assert.equal(textoLinhaRecibo(rec), "Recibo em preparação · Caução do contrato · R$ 1.292,00");
});
