/*
  E1241 (ORDEM-DUET 1213, item 3; MAPA-E1241, secção 3 e dúvida 1) — o registro anulado ANTES da confirmação do morador
  sumia das listas dos dois sem marca nenhuma. Passa a aparecer, só a linha e o selo "Anulado: {motivo}" (sem botões),
  onde cada um o viu pela última vez: "Registros por confirmar" do dono e "Pagamentos para confirmar" do morador.
  O selo decide-se pela data da anulação (anulado_em); o motivo aparece quando houver.
  Amarra: o anulado entra por um caminho ao lado (anuladosPendentes), nunca pela lista de pagamentos — totais, o que
  falta pagar e a numeração das partes continuam sem ele.
  Roda: node --test src/lib/e1241-anulado-antes-da-confirmacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

type Fn = (rows: Record<string, unknown>[], rotuloDe: (r: Record<string, unknown>) => string) => { id: string; rotulo: string; motivo: string | null }[];
const mod = (await import("./anulados-antes-da-confirmacao.ts").catch(() => ({}))) as { anuladosAntesDaConfirmacao?: Fn; textoDoSeloAnulado?: (m: string | null) => string };
const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

const ROWS = [
  { id: "a", parte: 1, anulado_em: null, confirmado_pelo_inquilino: false, anulado_motivo: null },
  { id: "b", parte: 2, anulado_em: "2026-11-27T10:00:00Z", confirmado_pelo_inquilino: false, anulado_motivo: "registro em duplicidade" },
  { id: "c", parte: 3, anulado_em: "2026-11-27T11:00:00Z", confirmado_pelo_inquilino: true, anulado_motivo: "valor errado" },
  { id: "d", parte: 4, anulado_em: "2026-11-27T12:00:00Z", confirmado_pelo_inquilino: false, anulado_motivo: "  " },
  // Um anulado antigo sem motivo gravado: o selo decide-se pela data, não pelo motivo (mata "filtrar por anulado_motivo").
  { id: "e", parte: 5, anulado_em: "2026-11-27T13:00:00Z", confirmado_pelo_inquilino: false, anulado_motivo: null },
];

test("1. só os anulados antes da confirmação; o motivo quando houver (decide a data, não o motivo)", () => {
  assert.equal(typeof mod.anuladosAntesDaConfirmacao, "function");
  const r = mod.anuladosAntesDaConfirmacao!(ROWS, (x) => `Parte ${x.parte}`);
  assert.deepEqual(r, [
    { id: "b", rotulo: "Parte 2", motivo: "registro em duplicidade" },
    { id: "d", rotulo: "Parte 4", motivo: null },
    { id: "e", rotulo: "Parte 5", motivo: null },
  ]);
});

test("2. o texto do selo: 'Anulado: {motivo}', ou 'Anulado' sem motivo", () => {
  assert.equal(mod.textoDoSeloAnulado!("registro em duplicidade"), "Anulado: registro em duplicidade");
  assert.equal(mod.textoDoSeloAnulado!(null), "Anulado");
});

test("3. as duas leituras dão o caminho ao lado, e a lista de pagamentos continua sem os anulados", () => {
  const acoes = ler("./data/contratos-actions.ts");
  assert.equal((acoes.match(/anuladosPendentes: anuladosAntesDaConfirmacao\(/g) ?? []).length, 2, "morador e dono");
  assert.equal((acoes.match(/\.filter\(\(pg\) => !pg\.anulado_em\)\)\.map\(\(pg\) => toPagamento/g) ?? []).length, 2, "a lista de pagamentos não muda");
});

test("4. as telas mostram a linha com o selo, sem botão de anular nem de confirmar", () => {
  const dono = ler("../app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  assert.match(dono, /contrato\.anuladosPendentes/);
  assert.match(dono, /data-testid="registro-anulado-pendente"/);
  const docs = ler("../components/documentos/documentos-contrato.tsx");
  assert.match(docs, /export function ConfirmarPagamentos\(\{ pagamentos, anulados = \[\] \}/);
  assert.match(docs, /data-testid="pagamento-anulado-pendente"/);
  const morador = ler("../app/(dashboard)/dashboard/locacoes/locacoes-client.tsx");
  assert.match(morador, /<ConfirmarPagamentos pagamentos=\{l\.pagamentos\} anulados=\{l\.anuladosPendentes\} \/>/);
  for (const [nome, src, id] of [["dono", dono, "registro-anulado-pendente"], ["morador", docs, "pagamento-anulado-pendente"]] as const) {
    const i = src.indexOf(`data-testid="${id}"`);
    const li = src.slice(i, src.indexOf("</li>", i));
    assert.doesNotMatch(li, /AnularRegistro|<Button/, `${nome}: sem botões`);
    assert.match(li, /textoDoSeloAnulado\(/, `${nome}: o selo`);
  }
});

// ── ORDEM-DUET 1237: a linha do anulado antes da confirmação é a forma curta da gramática ──────────────────────────────
// "Bloco {n} · R$ {total} · {dd/mm} a {dd/mm}" + o selo — sem número de recibo e sem "em preparação" (nunca terá recibo).
const linhas = (await import("./anulados-antes-da-confirmacao.ts").catch(() => ({}))) as { linhaDoAnulado?: (pg: Record<string, unknown>) => string };

test("5. (ORDEM-DUET 1237) a linha do anulado: Bloco · TOTAL · período, sem número nem 'em preparação'", () => {
  assert.equal(typeof linhas.linhaDoAnulado, "function");
  const b = { numero_bloco: 2, meses: 2, inicio: "2026-12-20", fim: "2027-01-19" };
  assert.equal(linhas.linhaDoAnulado!({ tipo: "aluguel", valor: 6400, parte: 1, encargos: [], contrato_blocos: b }), "Bloco 2 · R$ 6.400,00 · 20/12 a 19/01");
  assert.equal(
    linhas.linhaDoAnulado!({ tipo: "aluguel", valor: 0, parte: 2, encargos: [{ rotulo: "Contas do período", valor: 550 }, { rotulo: "Limpeza de preparação", valor: 250 }], contrato_blocos: b }),
    "Bloco 2, registro complementar · R$ 800,00 · 20/12 a 19/01",
    "o TOTAL do complementar",
  );
  assert.equal(linhas.linhaDoAnulado!({ tipo: "caucao", valor: 3200, encargos: [{ rotulo: "Contas do período", valor: 99 }], contrato_blocos: b }), "Caução do bloco 2 · R$ 3.200,00");
  const acoes = readFileSync(new URL("./data/contratos-actions.ts", import.meta.url), "utf8");
  assert.equal((acoes.match(/anuladosAntesDaConfirmacao\([^\n]*, linhaDoAnulado\)/g) ?? []).length, 2, "dono e morador");
});
