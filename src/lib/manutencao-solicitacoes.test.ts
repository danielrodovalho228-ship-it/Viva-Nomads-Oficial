/*
  F27/F28 (ordem dd8422ce): Solicitações lê e cria pelo fluxo real.
  Roda: node --test src/lib/manutencao-solicitacoes.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { camposAoAvancar, linhaParaOrdem, MSG_SEM_CONTRATO_MANUTENCAO, STATUS_CONTRATO_COM_MANUTENCAO } from "./manutencao-solicitacoes.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-10-12T20:00:00Z");

test("linha do banco vira ServiceOrder; valores desconhecidos caem no padrão seguro", () => {
  const o = linhaParaOrdem({ id: "1", category: "hidraulica", priority: "urgente", description: "Vazamento", status: "visto", opened_at: "2026-10-12T10:00:00Z", first_response_at: "2026-10-12T11:00:00Z", resolved_at: null, properties: { title: "Studio Centro" }, tenant_name: "Ana" });
  assert.deepEqual([o.property, o.tenantName, o.category, o.priority, o.status, o.firstResponseAt], ["Studio Centro", "Ana", "hidraulica", "urgente", "visto", "2026-10-12T11:00:00Z"]);
  const x = linhaParaOrdem({ id: "2", category: "<script>", priority: "???", description: "d", status: "lixo", opened_at: "2026-10-12T10:00:00Z", first_response_at: null, resolved_at: null });
  assert.deepEqual([x.category, x.priority, x.status, x.property], ["outros", "media", "aberto", "Imóvel"]);
});

test("avançar status: carimba a primeira resposta uma vez e a resolução no fim; resolvido não avança", () => {
  assert.deepEqual(camposAoAvancar("aberto", null, AGORA), { status: "visto", first_response_at: AGORA.toISOString() });
  assert.deepEqual(camposAoAvancar("visto", "2026-10-12T11:00:00Z", AGORA), { status: "em_andamento" });
  assert.deepEqual(camposAoAvancar("em_andamento", "2026-10-12T11:00:00Z", AGORA), { status: "resolvido", resolved_at: AGORA.toISOString() });
  assert.equal(camposAoAvancar("resolvido", "2026-10-12T11:00:00Z", AGORA), null);
});

test("F27: manutenção só com contrato ativo; sem contrato, estado vazio com a Central de Ajuda", () => {
  assert.deepEqual([...STATUS_CONTRATO_COM_MANUTENCAO], ["ativo", "encerrado_em_acerto"]);
  assert.match(MSG_SEM_CONTRATO_MANUTENCAO, /contrato ativo/);
  const ui = ler("app/(dashboard)/dashboard/solicitacoes/page.tsx");
  assert.match(ui, /data-testid="manutencao-sem-contrato"/);
  assert.match(ui, /href="\/ajuda"/);
  assert.match(ui, /disabled=\{semContrato\}/);
});

test("F28: no modo real a tela lê e grava no banco, não em estado local", () => {
  const ui = ler("app/(dashboard)/dashboard/solicitacoes/page.tsx");
  assert.match(ui, /minhasSolicitacoes\(\)/);
  assert.match(ui, /abrirChamado\(\{[\s\S]*categoria: "manutencao"[\s\S]*contratoId: alvo/);
  assert.match(ui, /avancarSolicitacao\(id\)/);
  // o ramo real sai (return) antes do código de exemplo que só mexe no useState
  const submit = ui.slice(ui.indexOf("async function submit"));
  assert.ok(submit.indexOf("abrirChamado") < submit.indexOf("const novo: ServiceOrder"), "chamado real vem antes do exemplo local");
  assert.ok(submit.indexOf("return;") < submit.indexOf("const novo: ServiceOrder"), "ramo real retorna antes do exemplo local");
});

test("ações do servidor: dono valida autoria; leitura pelo RLS; sem service_role para gravar status", () => {
  const a = ler("lib/data/manutencao-actions.ts");
  assert.match(a, /^"use server";/);
  assert.match(a, /\.eq\("id", id\)\s*\.eq\("owner_id", user\.id\)\s*\.maybeSingle\(\)/);
  assert.match(a, /\.update\(campos\)\s*\.eq\("id", id\)\s*\.eq\("owner_id", user\.id\)/);
  assert.match(a, /if \(!UUID_RE\.test\(id \?\? ""\)\)/);
  assert.match(a, /if \(!user\) return \{ ok: false, error: "Sessão expirada/);
  const upd = a.slice(a.indexOf("export async function avancarSolicitacao"));
  assert.doesNotMatch(upd, /createAdminClient/);
});
