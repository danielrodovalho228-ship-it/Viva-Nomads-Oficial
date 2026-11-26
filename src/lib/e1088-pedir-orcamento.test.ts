/*
  E1088 — o botão "Pedir orçamento" volta ao morador depois do contrato (linha Proposta, ESPEC-E1088 aprovada).
  Regra: candidatura ACEITA, SEM orçamento em aberto, e TODOS os contratos dessa candidatura assinados pelas duas
  partes (ou nenhum). O contrato CANCELADO não conta (ORDEM-605, caso 10). Até lá, a 2.ª estadia nasce pela proposta
  do dono, como hoje.
  Uma regra só (podePedirOrcamento), usada pela action do servidor e pelo cartão de /dashboard/candidaturas; a
  listagem expõe TODOS os contratos de cada candidatura (com o E1086 há mais de um) e se há orçamento em aberto.
  Roda: node --test src/lib/e1088-pedir-orcamento.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contratoDoSelo, podePedirOrcamento, type ContratoDoPedido } from "./pedido-ref.ts";

const ler = (p: string) => readFileSync(p, "utf8");
const ASSINADO = "2026-11-20T12:00:00Z";
const dosDois = { status: "ativo", assinadoProprietarioEm: ASSINADO, assinadoInquilinoEm: ASSINADO };
const semAssinatura = { status: "ativo", assinadoProprietarioEm: null, assinadoInquilinoEm: null };
const soDono = { status: "ativo", assinadoProprietarioEm: ASSINADO, assinadoInquilinoEm: null };
const soMorador = { status: "ativo", assinadoProprietarioEm: null, assinadoInquilinoEm: ASSINADO };
const canceladoSemAssinar = { status: "cancelado", assinadoProprietarioEm: null, assinadoInquilinoEm: null };

// A tabela da ESPEC-E1088 (casos 1 a 9) e o caso 10 do Gerente (ORDEM-605).
const CASOS: { n: number; situacao: string; temOrcamentoAberto: boolean; contratos: ContratoDoPedido[]; botao: boolean }[] = [
  { n: 1, situacao: "aceita", temOrcamentoAberto: false, contratos: [], botao: true },
  { n: 2, situacao: "aceita", temOrcamentoAberto: true, contratos: [], botao: false },
  { n: 3, situacao: "aceita", temOrcamentoAberto: false, contratos: [dosDois], botao: true },
  { n: 4, situacao: "aceita", temOrcamentoAberto: false, contratos: [soDono], botao: false },
  { n: 5, situacao: "aceita", temOrcamentoAberto: false, contratos: [soMorador], botao: false },
  { n: 6, situacao: "aceita", temOrcamentoAberto: false, contratos: [dosDois, semAssinatura], botao: false },
  { n: 7, situacao: "aceita", temOrcamentoAberto: false, contratos: [dosDois, dosDois], botao: true },
  { n: 8, situacao: "aceita", temOrcamentoAberto: true, contratos: [dosDois], botao: false },
  { n: 9, situacao: "enviada", temOrcamentoAberto: false, contratos: [], botao: false },
  { n: 10, situacao: "aceita", temOrcamentoAberto: false, contratos: [dosDois, canceladoSemAssinar], botao: true },
];

for (const c of CASOS) {
  test(`caso ${c.n}: ${c.situacao}, orçamento ${c.temOrcamentoAberto ? "aberto" : "não"}, ${c.contratos.length} contrato(s) → botão ${c.botao ? "sim" : "não"}`, () => {
    assert.equal(podePedirOrcamento({ situacao: c.situacao, temOrcamentoAberto: c.temOrcamentoAberto, contratos: c.contratos }), c.botao);
  });
}

test("caso 9, as outras situações que não são 'aceita' também não pedem", () => {
  for (const situacao of ["em_analise", "recusada", "cancelada", "expirada"]) {
    assert.equal(podePedirOrcamento({ situacao, temOrcamentoAberto: false, contratos: [] }), false, situacao);
  }
});

test("caso 10, o cancelado só sai da conta: cancelado sozinho = nenhum contrato (sim); cancelado + um por assinar = não", () => {
  assert.equal(podePedirOrcamento({ situacao: "aceita", temOrcamentoAberto: false, contratos: [canceladoSemAssinar] }), true);
  assert.equal(podePedirOrcamento({ situacao: "aceita", temOrcamentoAberto: false, contratos: [canceladoSemAssinar, soDono] }), false);
});

test("ligação, a action: lê as duas colunas de assinatura e o status de cada contrato, não só a contagem", () => {
  const src = ler("src/lib/data/pedido-orcamento-actions.ts");
  assert.match(src, /from\("contratos"\)\.select\("status, assinado_proprietario_em, assinado_inquilino_em"\)\.eq\("lead_id", l\.id\)/);
  assert.doesNotMatch(src, /from\("contratos"\)\.select\("id", \{ count: "exact", head: true \}\)/);
  assert.match(src, /podePedirOrcamento\(\{[\s\S]*?contratos:/);
  assert.doesNotMatch(src, /temContrato/);
  // Fica igual: a leitura que falha recusa (nunca vira "pode pedir").
  assert.match(src, /if \(aberto\.error \|\| contratos\.error\) return \{ ok: false/);
});

test("ligação, o cartão: usa a mesma regra do servidor, não '!c.contrato'", () => {
  const pagina = ler("src/app/(dashboard)/dashboard/candidaturas/page.tsx");
  assert.match(pagina, /podePedirOrcamento\(\{ situacao: c\.situacao\.chave, temOrcamentoAberto: c\.temOrcamentoAberto, contratos: c\.contratosDoPedido \}\)/);
  assert.doesNotMatch(pagina, /c\.situacao\.chave === "aceita" && !c\.contrato/);
});

test("ligação, a listagem: todos os contratos de cada candidatura e o orçamento em aberto, não um só por candidatura", () => {
  const src = ler("src/lib/data/leads-actions.ts");
  const i = src.indexOf("export async function listMinhasCandidaturas");
  const corpo = src.slice(i, src.indexOf("\n}\n", i));
  assert.match(corpo, /contratosDoPedido: contratosDoLead\.get\(r\.id\) \?\? \[\]/);
  assert.match(corpo, /temOrcamentoAberto:/);
  assert.match(corpo, /\.in\("status", ORCAMENTO_ABERTO\)/);
  // O selo do cartão continua a ser o do contrato mais recente.
  assert.match(corpo, /contrato: contratoDoLead\.get\(r\.id\) \?\? null/);
});

/* ── O selo do cartão (ORDEM-DUET-728): o contrato que manda no selo é o mesmo que conta na regra ─────────────────── */
test("selo: entre os contratos que contam (não cancelados), manda o mais recente — não o último que a consulta devolve", () => {
  const antigo = { id: "c-antigo", status: "ativo", created_at: "2026-10-01T10:00:00Z" };
  const novo = { id: "c-novo", status: "ativo", created_at: "2026-11-20T10:00:00Z" };
  assert.equal(contratoDoSelo([novo, antigo])?.id, "c-novo");
  assert.equal(contratoDoSelo([antigo, novo])?.id, "c-novo", "a ordem da consulta não decide");
});

test("selo: o cancelado não manda enquanto houver um contrato que conta, mesmo sendo o mais recente", () => {
  const valido = { id: "c-valido", status: "ativo", created_at: "2026-10-01T10:00:00Z" };
  const cancelado = { id: "c-cancelado", status: "cancelado", created_at: "2026-11-25T10:00:00Z" };
  assert.equal(contratoDoSelo([cancelado, valido])?.id, "c-valido");
});

test("selo: só cancelados → o mais recente deles (o cartão não perde o selo); nenhum → sem selo", () => {
  const c1 = { id: "c1", status: "cancelado", created_at: "2026-10-01T10:00:00Z" };
  const c2 = { id: "c2", status: "cancelado", created_at: "2026-11-01T10:00:00Z" };
  assert.equal(contratoDoSelo([c1, c2])?.id, "c2");
  assert.equal(contratoDoSelo([]), null);
});

test("ligação: a listagem escolhe o contrato do selo pela regra e lê a data de criação", () => {
  const leads = ler("src/lib/data/leads-actions.ts");
  assert.match(leads, /\.select\(`id, lead_id, created_at, \$\{COLUNAS_ESTADO_CONTRATO\}`\)/);
  assert.match(leads, /contratoDoSelo\(/);
});
