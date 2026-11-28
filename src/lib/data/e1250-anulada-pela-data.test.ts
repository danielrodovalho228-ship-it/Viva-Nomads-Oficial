/*
  E1250 (ESPEC-E1250 da Fable; ORDENS-DUET 1265, 1295 e 1297) — na lista de Documentos do contrato, a linha está ANULADA
  quando há DATA de anulação, no documento ou no pagamento. O motivo passa a ser só o texto do selo.
   - decisor puro: anulacaoDaLinha (src/lib/documentos-linha.ts) — anulada se o documento tem data, OU o pagamento tem;
     o motivo é o do lado com data (primeiro o documento, depois o pagamento); o motivo de um lado sem data é ignorado;
   - o texto do selo: "Anulado: {motivo}", ou "Anulado" sem motivo — UMA só função (textoDoSeloAnulado, do E1241);
   - as duas linhas (ReciboView, DocumentoView) passam a dois campos: a decisão (anulada) e o motivo (motivoAnulacao).
  FORA (ORDEM-DUET 1265): "Recibo em preparação" numa linha anulada; o pagamento com dois documentos.
  Corre a ação REAL (documentosDosContratos) com o Supabase falso FIEL (só as colunas pedidas; ORDEM-DUET 1240).
  Os casos 2, 3, 6, 7, 9, 12 e 13 falham no código de antes (a mordida da especificação).
  Roda: node --test src/lib/data/e1250-anulada-pela-data.test.ts
*/
import { register } from "node:module";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoLinhaRecibo } from "../documentos-linha.ts";
import { textoDoSeloAnulado } from "../anulados-antes-da-confirmacao.ts";

register("./e1072-teto-harness/loader.mjs", import.meta.url);
const { documentosDosContratos } = await import("./documentos-actions.ts");
const linha = (await import("../documentos-linha.ts")) as unknown as {
  anulacaoDaLinha?: (p: { documento?: { anuladoEm?: string | null; motivo?: string | null } | null; pagamento?: { anuladoEm?: string | null; motivo?: string | null } | null }) => { anulada: boolean; motivo: string | null };
};

const CONTRATO = "11111111-2222-4333-8444-555555555555";
const PG = "22222222-3333-4444-8555-666666666666";
const CH = "44444444-5555-4666-8777-888888888888";
const EM = "2026-11-20T12:00:00.000Z";
const B1 = { numero_bloco: 1, meses: 1, inicio: "2026-05-01", fim: "2026-05-31" };
const g = globalThis as unknown as { __e1072Sessao: unknown; __e1072Admin: unknown };

function colunasDoSelect(sel: string): string[] {
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

type Linha = Record<string, unknown>;
/** O falso FIEL: aplica eq/is aos dados e devolve só as colunas que o select pede. */
function sessao(t: { pagamentos?: Linha[]; docs?: Linha[]; falha?: boolean }) {
  return {
    from(tabela: string) {
      const filtros: ((l: Linha) => boolean)[] = [];
      let sel: string | null = null;
      const b: Record<string, unknown> = {};
      for (const m of ["in", "order"]) b[m] = () => b;
      b.select = (s: string) => ((sel = s), b);
      b.eq = (k: string, v: unknown) => (filtros.push((l) => l[k] === v), b);
      b.is = (k: string, v: unknown) => (filtros.push((l) => (l[k] ?? null) === v), b);
      const resposta = () => {
        if (t.falha && tabela === "documentos_fiscais") return { data: null, error: { message: "falhou" } };
        const fonte = tabela === "pagamentos_bloco" ? (t.pagamentos ?? []) : tabela === "documentos_fiscais" ? (t.docs ?? []) : [];
        const linhas = fonte.filter((l) => filtros.every((f) => f(l)));
        const cols = sel ? colunasDoSelect(sel) : null;
        return { data: cols ? linhas.map((l) => Object.fromEntries(cols.filter((c) => c in l).map((c) => [c, l[c]]))) : linhas, error: null };
      };
      b.then = (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) => Promise.resolve(resposta()).then(ok, ko);
      return b;
    },
  };
}
function adminComPedido() {
  const cadeia = (r: (f: Record<string, unknown>) => unknown) => {
    const f: Record<string, unknown> = {};
    const b: Record<string, unknown> = {};
    for (const m of ["select", "in"]) b[m] = () => b;
    b.eq = (k: string, v: unknown) => ((f[k] = v), b);
    b.then = (ok: (v: unknown) => unknown) => Promise.resolve(r(f)).then(ok);
    return b;
  };
  return {
    from: (tabela: string) =>
      cadeia(() =>
        tabela === "chamados"
          ? { data: [{ id: CH, numero_publico: "VN-000110", status: "aberto", contexto_id: CONTRATO }], error: null }
          : tabela === "chamado_mensagens"
            ? { data: [{ chamado_id: CH, corpo: `[anulacao] pagamento=${PG}` }], error: null }
            : { data: [], error: null },
      ),
  };
}

type Lado = { em: string | null; motivo: string | null };
const pagamento = (p: Lado, o: Linha = {}) => ({ id: PG, contrato_id: CONTRATO, tipo: "aluguel", parte: 1, valor: 2583.33, encargos: [{ rotulo: "Contas do período", valor: 100 }], data_pagamento: "2026-05-01", confirmado_pelo_inquilino: true, anulado_em: p.em, anulado_motivo: p.motivo, contrato_blocos: B1, ...o });
const documento = (d: Lado, pagamentoId: string | null = PG) => ({ id: "d1", tipo: "recibo", numero: "REC-2026-000007", valor: 2683.33, periodo_inicio: null, periodo_fim: null, criado_em: "2026-05-02", contrato_id: CONTRATO, pagamento_id: pagamentoId, anulado_em: d.em, anulado_motivo: d.motivo });

type Recibo = { pagamentoId: string; documentoId: string | null; numero: string | null; total: number; anulada?: boolean; motivoAnulacao?: string | null; pedidoAnulacao?: string | null; tipo: string; inicio: string | null; fim: string | null; bloco: number | null; parte: number };
async function recibo(p: Lado, d: Lado | null) {
  g.__e1072Admin = null;
  g.__e1072Sessao = sessao({ pagamentos: [pagamento(p)], docs: d ? [documento(d)] : [] });
  return (await documentosDosContratos([CONTRATO]))[CONTRATO].recibos[0] as unknown as Recibo;
}
async function outro(d: Lado) {
  g.__e1072Admin = null;
  g.__e1072Sessao = sessao({ docs: [{ ...documento(d, null), tipo: "termo_devolucao", numero: "TER-2026-000001" }] });
  return (await documentosDosContratos([CONTRATO]))[CONTRATO].documentos[0] as unknown as { anulada?: boolean; motivoAnulacao?: string | null };
}
/** O que a tela mostra: o selo (texto) só com a decisão; o botão de anular (dono) só sem ela. */
const tela = (r: { anulada?: boolean; motivoAnulacao?: string | null }) => ({ selo: r.anulada ? textoDoSeloAnulado(r.motivoAnulacao ?? null) : null, botao: !r.anulada });

const NADA: Lado = { em: null, motivo: null };

// ——— o decisor puro ———
test("0. anulacaoDaLinha: pela DATA; o motivo do lado com data (documento primeiro); o motivo sem data é ignorado", () => {
  assert.equal(typeof linha.anulacaoDaLinha, "function");
  const a = linha.anulacaoDaLinha!;
  assert.deepEqual(a({ documento: { anuladoEm: EM, motivo: "A" }, pagamento: { anuladoEm: EM, motivo: "B" } }), { anulada: true, motivo: "A" });
  assert.deepEqual(a({ documento: { anuladoEm: null, motivo: "A" }, pagamento: { anuladoEm: EM, motivo: "B" } }), { anulada: true, motivo: "B" });
  assert.deepEqual(a({ documento: { anuladoEm: EM, motivo: "  " } }), { anulada: true, motivo: null }, "sem letras, vazio");
  assert.deepEqual(a({ documento: { anuladoEm: null, motivo: "A" } }), { anulada: false, motivo: null });
  assert.deepEqual(a({}), { anulada: false, motivo: null });
  assert.equal(textoDoSeloAnulado(null), "Anulado");
  assert.equal(textoDoSeloAnulado("valor errado"), "Anulado: valor errado");
});

// ——— Recibos (pagamento confirmado) ———
test("1. documento com data e motivo → selo com o motivo; sem botão", async () => {
  assert.deepEqual(tela(await recibo(NADA, { em: EM, motivo: "registro em duplicidade" })), { selo: "Anulado: registro em duplicidade", botao: false });
});
test("2. documento com data e SEM motivo → selo 'Anulado'; sem botão", async () => {
  assert.deepEqual(tela(await recibo(NADA, { em: EM, motivo: null })), { selo: "Anulado", botao: false });
});
test("3. documento SEM data e com motivo → sem selo; com botão", async () => {
  assert.deepEqual(tela(await recibo(NADA, { em: null, motivo: "registro em duplicidade" })), { selo: null, botao: true });
});
test("4. sem documento; pagamento com data e motivo → selo com o motivo; sem botão", async () => {
  assert.deepEqual(tela(await recibo({ em: EM, motivo: "valor errado" }, null)), { selo: "Anulado: valor errado", botao: false });
});
test("5. documento sem data e sem motivo; pagamento com data e motivo → selo com o motivo do pagamento", async () => {
  assert.deepEqual(tela(await recibo({ em: EM, motivo: "valor errado" }, NADA)), { selo: "Anulado: valor errado", botao: false });
});
test("6. sem documento; pagamento com data e SEM motivo → selo 'Anulado'; sem botão", async () => {
  assert.deepEqual(tela(await recibo({ em: EM, motivo: null }, null)), { selo: "Anulado", botao: false });
});
test("7. sem documento; pagamento SEM data e com motivo (confirmado, com motivo por engano) → sem selo; com botão", async () => {
  assert.deepEqual(tela(await recibo({ em: null, motivo: "valor errado" }, null)), { selo: null, botao: true });
});
test("8. os dois com data → o motivo do documento primeiro", async () => {
  assert.deepEqual(tela(await recibo({ em: EM, motivo: "motivo B" }, { em: EM, motivo: "motivo A" })), { selo: "Anulado: motivo A", botao: false });
});
test("9. documento sem data com 'motivo A'; pagamento com data e 'motivo B' → selo 'motivo B' (o do lado com data)", async () => {
  assert.deepEqual(tela(await recibo({ em: EM, motivo: "motivo B" }, { em: null, motivo: "motivo A" })), { selo: "Anulado: motivo B", botao: false });
});
test("10. sem documento; pagamento sem data e sem motivo → sem selo; com botão", async () => {
  assert.deepEqual(tela(await recibo(NADA, null)), { selo: null, botao: true });
});

// ——— Outros documentos (sem pagamento) ———
test("11. data e motivo → selo com o motivo", async () => {
  assert.equal(tela(await outro({ em: EM, motivo: "emitido em duplicidade" })).selo, "Anulado: emitido em duplicidade");
});
test("12. data e SEM motivo → selo 'Anulado'", async () => {
  assert.equal(tela(await outro({ em: EM, motivo: null })).selo, "Anulado");
});
test("13. SEM data e com motivo → sem selo", async () => {
  assert.equal(tela(await outro({ em: null, motivo: "emitido em duplicidade" })).selo, null);
});
test("14. sem data e sem motivo → sem selo", async () => {
  assert.equal(tela(await outro(NADA)).selo, null);
});

// ——— Os vizinhos que não podem mudar ———
const TELA = readFileSync(new URL("../../components/documentos/documentos-contrato.tsx", import.meta.url), "utf8");
test("15. a linha 'Anulação pedida à Central' (E1243): com pedido aberto e sem anulação aparece; some com a anulação", async () => {
  g.__e1072Sessao = sessao({ pagamentos: [pagamento(NADA)] });
  g.__e1072Admin = adminComPedido();
  const r = (await documentosDosContratos([CONTRATO]))[CONTRATO].recibos[0] as unknown as Recibo;
  assert.equal(r.pedidoAnulacao, "VN-000110");
  assert.equal(r.anulada, false);
  assert.match(TELA, /anular && r\.pedidoAnulacao && !r\.anulada && \(/, "a linha do pedido só sem a anulação");
});
test("16. o botão de anular: só para o dono (anular), só sem anulação e sem pedido aberto", () => {
  assert.match(TELA, /\{anular && !r\.anulada && !r\.pedidoAnulacao && <AnularRegistro pagamentoId=\{r\.pagamentoId\} confirmado \/>\}/);
});
test("17. o texto da linha (E1233): número, bloco, total e período iguais, com e sem anulação", async () => {
  const viva = textoLinhaRecibo(await recibo(NADA, NADA));
  assert.equal(viva, "REC-2026-000007 · Bloco 1 · R$ 2.683,33 · 01/05 a 31/05");
  assert.equal(textoLinhaRecibo(await recibo({ em: EM, motivo: null }, { em: EM, motivo: null })), viva);
});
test("18. 'Baixar recibo (PDF)' continua na linha anulada: o documento existiu", async () => {
  assert.equal((await recibo(NADA, { em: EM, motivo: "x" })).documentoId, "d1");
  assert.match(TELA, /\{r\.documentoId \? \(\s*<a href=\{`\/api\/documentos\/\$\{r\.documentoId\}`\}/, "o link depende só do documento, não da anulação");
});
test("19. o total da linha: o valor mais os encargos, igual com e sem anulação", async () => {
  assert.equal((await recibo(NADA, null)).total, 2683.33);
  assert.equal((await recibo({ em: EM, motivo: null }, null)).total, 2683.33);
});
test("20. a caução confirmada da mesma leitura não conta o pagamento anulado (pela data)", async () => {
  g.__e1072Admin = null;
  g.__e1072Sessao = sessao({
    pagamentos: [
      pagamento(NADA, { id: "c1", tipo: "caucao", valor: 3750, encargos: [] }),
      pagamento({ em: EM, motivo: null }, { id: "c2", tipo: "caucao", valor: 3750, encargos: [] }),
    ],
  });
  assert.equal((await documentosDosContratos([CONTRATO]))[CONTRATO].caucaoConfirmada, 3750);
});
test("21. o registro anulado ANTES da confirmação continua fora desta lista (ela só lê os confirmados)", async () => {
  g.__e1072Admin = null;
  g.__e1072Sessao = sessao({ pagamentos: [pagamento({ em: EM, motivo: "duplicado" }, { confirmado_pelo_inquilino: false })] });
  assert.equal((await documentosDosContratos([CONTRATO]))[CONTRATO].recibos.length, 0);
});
test("22. a leitura que falha: a tela avisa (falhou), não mostra lista vazia", async () => {
  g.__e1072Admin = null;
  g.__e1072Sessao = sessao({ pagamentos: [pagamento(NADA)], falha: true });
  assert.equal((await documentosDosContratos([CONTRATO]))[CONTRATO].falhou, true);
});

// ——— Estático ———
const ACOES = readFileSync(new URL("./documentos-actions.ts", import.meta.url), "utf8");
test("23. na leitura, a decisão não lê mais o motivo: nenhum anulado_motivo fora da chamada do decisor (e dos selects)", () => {
  const semTextos = ACOES.replace(/"[^"\n]*"/g, '""');
  const semDecisor = semTextos.replace(/anulacaoDaLinha\(\{[\s\S]*?\}\)/g, "");
  assert.doesNotMatch(semDecisor, /anulado_motivo/);
  assert.equal((ACOES.match(/anulacaoDaLinha\(\{/g) ?? []).length, 2, "o recibo e o outro documento");
});
test("24. a leitura dos pagamentos confirmados pede a data de anulação", () => {
  const sel = /\.from\("pagamentos_bloco"\)\s*\.select\("([^"]+)"\)\s*\.in\("contrato_id", ids\)\s*\.eq\("confirmado_pelo_inquilino", true\)\s*\.order/.exec(ACOES)?.[1] ?? "";
  assert.ok(colunasDoSelect(sel).includes("anulado_em"), sel);
});
test("25. no componente, o selo, o botão e a linha do pedido leem a DECISÃO, não o texto; o texto vem da função única", () => {
  assert.match(TELA, /\{r\.anulada && <SeloAnulado motivo=\{r\.motivoAnulacao\} \/>\}/);
  assert.match(TELA, /\{d\.anulada && <SeloAnulado motivo=\{d\.motivoAnulacao\} \/>\}/);
  assert.doesNotMatch(TELA, /\b[rd]\.anulado\b/, "nenhum uso do campo antigo");
  const selo = TELA.slice(TELA.indexOf("function SeloAnulado("));
  assert.match(selo.slice(0, 400), /motivo: string \| null/, "o selo aceita motivo vazio");
  assert.match(selo.slice(0, 400), /\{textoDoSeloAnulado\(motivo\)\}/);
});
