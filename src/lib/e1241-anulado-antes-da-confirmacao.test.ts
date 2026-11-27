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
];

test("1. só os anulados antes da confirmação; o motivo quando houver (decide a data, não o motivo)", () => {
  assert.equal(typeof mod.anuladosAntesDaConfirmacao, "function");
  const r = mod.anuladosAntesDaConfirmacao!(ROWS, (x) => `Parte ${x.parte}`);
  assert.deepEqual(r, [
    { id: "b", rotulo: "Parte 2", motivo: "registro em duplicidade" },
    { id: "d", rotulo: "Parte 4", motivo: null },
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
