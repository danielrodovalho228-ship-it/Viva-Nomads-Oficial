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

// E1098 (ORDEM-DUET-505): pelo mockup, o estado é um selo do cabeçalho e "Aberto em" é uma linha do cartão Detalhes
// (antes iam os dois no subtítulo). A hora continua pelo formatador de Brasília (dataEHora usa dataBRT e horaBRT).
test("detalhe do admin mostra o estado no cabeçalho e 'Aberto em' nos Detalhes", () => {
  const src = ler("../../app/(dashboard)/admin/atendimento/[id]/chamado-client.tsx");
  assert.match(src, /data-testid="chamado-status">[\s\S]{0,160}\{rotuloStatus\(c\.status\)\}/);
  assert.match(src, /<Linha k="Aberto em" v=\{dataEHora\(c\.criado_em\)\} \/>/);
});
