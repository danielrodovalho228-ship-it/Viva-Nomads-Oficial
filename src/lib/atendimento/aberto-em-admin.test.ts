/*
  Ordem af66a9b1 (F14, parte 2): "Aberto em" no cabeçalho do chamado do admin e na lista de chamados.
  Roda: node --test src/lib/atendimento/aberto-em-admin.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("lista de chamados do admin mostra 'Aberto em' ao lado do status", () => {
  const src = ler("../../app/(dashboard)/admin/atendimento/atendimento-client.tsx");
  // Prompt 29, item 11: no admin, pelo formatador único de Brasília (BRT na lista).
  assert.match(src, /Aberto em \{dataHoraBRT\(c\.criado_em, \{ tabela: true \}\)\}/);
  assert.match(src, /data-testid="chamado-aberto-em"/);
});

test("cabeçalho do detalhe do admin mostra 'Aberto em' junto do status", () => {
  const src = ler("../../app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx");
  assert.match(src, /subtitle=\{`[^`]*STATUS\[c\.status\][^`]*Aberto em \$\{dataHoraBRT\(c\.criado_em\)\}/);
});
