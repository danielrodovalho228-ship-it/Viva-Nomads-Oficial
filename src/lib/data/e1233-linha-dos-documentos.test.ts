/*
  E1233 (ORDEM-DUET 1208; lote da ORDEM-1220) — a gramática da linha dos documentos: número · identificação do bloco ·
  TOTAL · período (dd/mm, sem ano). Uma função (textoLinhaRecibo) nas duas listas (dono e morador, ListaDocumentos).
    1.º registro:        REC-2026-000007 · Bloco 1 · R$ 2.583,33 · 01/05 a 31/05
    complementar (≥ 2):  REC-2026-000009 · Bloco 1, registro complementar · R$ 1.525,00 · 20/12 a 19/01
    caução por bloco:    CAU-2026-000004 · Caução do bloco 1 · R$ 3.750,00          (sem período)
    caução antiga:       CAU-2026-000002 · Caução do contrato · R$ 3.200,00
    não emitido:         Recibo em preparação · Bloco 1 · R$ … (no lugar do número)
  O valor é sempre o TOTAL (componentesDoPagamento); "registro complementar" vem da coluna parte (> 1) — o complementar
  continua complementar com a parte 1 anulada; sem mês, meses nem dias.
  Corre a ação REAL (documentosDosContratos) com o Supabase falso (harness ./e1072-teto-harness/loader.mjs).
  Roda: node --test src/lib/data/e1233-linha-dos-documentos.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoLinhaRecibo } from "../documentos-linha.ts";

register("./e1072-teto-harness/loader.mjs", import.meta.url);
const { documentosDosContratos } = await import("./documentos-actions.ts");

const CONTRATO = "11111111-2222-4333-8444-555555555555";
const g = globalThis as unknown as { __e1072Sessao: unknown };
const B1 = { numero_bloco: 1, meses: 1, inicio: "2026-05-01", fim: "2026-05-31" };
const B1b = { numero_bloco: 1, meses: 2, inicio: "2026-12-20", fim: "2027-01-19" };

/**
 * ORDEM-DUET-1240 (fuga L8 da Pista 3): o falso é FIEL ao select — devolve só as colunas que a leitura pede (as de topo;
 * "contrato_blocos(...)" conta como a coluna contrato_blocos). Sem isto, um select sem "parte" passaria aqui e, no banco
 * real, o complementar perderia o "registro complementar" (parteDaColuna(undefined) = 1).
 */
export function colunasDoSelect(sel: string): string[] {
  const out: string[] = [];
  let fundo = 0;
  let atual = "";
  for (const ch of sel) {
    if (ch === "(") fundo += 1;
    if (ch === ")") fundo -= 1;
    if (ch === "," && fundo === 0) {
      out.push(atual);
      atual = "";
    } else atual += ch;
  }
  out.push(atual);
  return out.map((c) => c.trim().split("(")[0].trim()).filter(Boolean);
}
const projetar = (linhas: Record<string, unknown>[], sel: string | null) => {
  if (!sel || sel.trim() === "*") return linhas;
  const cols = colunasDoSelect(sel);
  return linhas.map((l) => Object.fromEntries(cols.filter((c) => c in l).map((c) => [c, l[c]])));
};

function sessao(pagamentos: Record<string, unknown>[], docs: Record<string, unknown>[]) {
  return {
    from(tabela: string) {
      const filtros: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      let sel: string | null = null;
      for (const m of ["in", "order", "is"]) b[m] = () => b;
      b.select = (s: string) => ((sel = s), b);
      b.eq = (k: string, v: unknown) => ((filtros[k] = v), b);
      const resposta = () => {
        if (tabela === "pagamentos_bloco") return filtros.tipo === "caucao" ? { data: [], error: null } : { data: projetar(pagamentos, sel), error: null };
        if (tabela === "documentos_fiscais") return { data: projetar(docs, sel), error: null };
        return { data: [], error: null };
      };
      b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta()).then(ok, ko);
      return b;
    },
  };
}
const pg = (o: Record<string, unknown>) => ({ contrato_id: CONTRATO, tipo: "aluguel", encargos: [], data_pagamento: "2026-05-01", anulado_motivo: null, parte: 1, ...o });
const doc = (pagamento_id: string, numero: string, anulado_motivo: string | null = null) => ({ id: `d-${pagamento_id}`, tipo: "recibo", numero, valor: 0, contrato_id: CONTRATO, pagamento_id, anulado_motivo });

async function linhas() {
  g.__e1072Sessao = sessao(
    [
      pg({ id: "p1", valor: 2583.33, contrato_blocos: B1 }),
      pg({ id: "p0", valor: 2000, parte: 1, contrato_blocos: B1b, anulado_motivo: "registro em duplicidade" }),
      pg({ id: "p2", valor: 0, parte: 2, contrato_blocos: B1b, encargos: [{ rotulo: "Contas do período", valor: 1275 }, { rotulo: "Limpeza de preparação", valor: 250 }] }),
      pg({ id: "c1", tipo: "caucao", valor: 3750, contrato_blocos: B1, encargos: [{ rotulo: "Contas do período", valor: 99 }] }),
      pg({ id: "c0", tipo: "caucao", valor: 3200, contrato_blocos: null }),
      pg({ id: "p3", valor: 3200, contrato_blocos: B1 }),
    ],
    [doc("p1", "REC-2026-000007"), doc("p0", "REC-2026-000008", "registro em duplicidade"), doc("p2", "REC-2026-000009"), doc("c1", "CAU-2026-000004"), doc("c0", "CAU-2026-000002")],
  );
  const r = (await documentosDosContratos([CONTRATO]))[CONTRATO];
  return Object.fromEntries(r.recibos.map((x) => [x.pagamentoId, textoLinhaRecibo(x)]));
}

test("1. o 1.º registro: número · Bloco 1 · total · período dd/mm", async () => {
  assert.equal((await linhas()).p1, "REC-2026-000007 · Bloco 1 · R$ 2.583,33 · 01/05 a 31/05");
});

test("2. o complementar (parte 2) — e continua complementar com a parte 1 anulada; o valor é o TOTAL", async () => {
  const l = await linhas();
  assert.equal(l.p2, "REC-2026-000009 · Bloco 1, registro complementar · R$ 1.525,00 · 20/12 a 19/01");
  assert.equal(l.p0, "REC-2026-000008 · Bloco 1 · R$ 2.000,00 · 20/12 a 19/01", "a parte 1 (anulada) é o 1.º registro");
});

test("3. a caução por bloco: sem período; os encargos não contam", async () => {
  assert.equal((await linhas()).c1, "CAU-2026-000004 · Caução do bloco 1 · R$ 3.750,00");
});

test("4. a caução antiga (sem bloco): 'Caução do contrato'", async () => {
  assert.equal((await linhas()).c0, "CAU-2026-000002 · Caução do contrato · R$ 3.200,00");
});

test("5. não emitido: 'Recibo em preparação' no lugar do número", async () => {
  assert.equal((await linhas()).p3, "Recibo em preparação · Bloco 1 · R$ 3.200,00 · 01/05 a 31/05");
});

test("6. sem mês, meses nem dias, e sem ano no período", async () => {
  for (const l of Object.values(await linhas())) {
    assert.doesNotMatch(l, /\bm[eê]s(es)?\b|\bdias?\b/i, l);
    assert.doesNotMatch(l, /\d{2}\/\d{2}\/\d{4}/, l);
  }
});

test("7. as duas listas (dono e morador) usam a mesma função com a linha inteira; a ação lê a parte da coluna", () => {
  const tela = readFileSync(new URL("../../components/documentos/documentos-contrato.tsx", import.meta.url), "utf8");
  assert.match(tela, /\{textoLinhaRecibo\(r\)\}/);
  const acoes = readFileSync(new URL("./documentos-actions.ts", import.meta.url), "utf8");
  assert.match(acoes, /parteDaColuna\(/);
  for (const f of ["../../app/(dashboard)/dashboard/contratos/contratos-client.tsx", "../../app/(dashboard)/dashboard/locacoes/locacoes-client.tsx"]) {
    assert.match(readFileSync(new URL(f, import.meta.url), "utf8"), /<ListaDocumentos [^>]*recibos=/);
  }
});

test("8. (ORDEM-DUET-1240, L8) o select da ação pede a coluna parte; o falso só devolve o que o select pede", () => {
  const acoes = readFileSync(new URL("./documentos-actions.ts", import.meta.url), "utf8");
  const sel = /\.from\("pagamentos_bloco"\)\s*\.select\("([^"]+)"\)\s*\.in\("contrato_id", ids\)\s*\.eq\("confirmado_pelo_inquilino", true\)/.exec(acoes)?.[1] ?? "";
  assert.ok(colunasDoSelect(sel).includes("parte"), `a leitura dos registros confirmados pede "parte": ${sel}`);
  assert.deepEqual(colunasDoSelect("id, tipo, contrato_blocos(numero_bloco, inicio)"), ["id", "tipo", "contrato_blocos"]);
});
