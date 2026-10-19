/*
  Complemento do #884 (prova em produção, 19/10): pagamento sem repetição, Caução do contrato, anulação da duplicidade
  e o número público do contrato (VN-CT-…) numa função só.
  Roda: node --test src/lib/pagamento-sem-repeticao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { numeroPublicoContrato } from "./contrato-ref.ts";
import { rotuloPagamentoBloco } from "./pagamento-bloco.ts";
import { refContratoVN } from "./fiscal/fila-falhas.ts";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const migracao = ler("../../supabase/migrations/0182_pagamento_sem_repeticao.sql");
const aplicar = ler("../../supabase/producao/aplicar-0182.sql");
const rollback = ler("../../supabase/producao/rollback/0182_rollback.sql");

test("item 4: número público do contrato numa função só (PDF, e-mail, fila, conferência)", () => {
  assert.equal(numeroPublicoContrato("11281a61-7ea6-4b8a-a8df-495e8eb5c682"), "VN-CT-11281A61");
  assert.equal(refContratoVN("11281a61-7ea6-4b8a-a8df-495e8eb5c682"), "VN-CT-11281A61");
  const emitir = ler("./fiscal/emitir.ts");
  assert.match(emitir, /contratoRef: numeroPublicoContrato\(partes\.contratoId\)/);
  assert.doesNotMatch(emitir, /`CT-\$\{/, "o formato antigo CT-… saiu do PDF e do e-mail");
  assert.match(ler("./data/contratos-actions.ts"), /numero: numeroPublicoContrato\(/);
  assert.match(migracao, /'VN-CT-' \|\| upper\(left\(d\.contrato_id::text, 8\)\)/, "conferência pública no mesmo formato");
});

test("item 1 (banco): uma Caução ativa por contrato e um valor mensal ativo por bloco", () => {
  for (const sql of [migracao, aplicar]) {
    assert.match(sql, /create unique index if not exists pagamentos_bloco_uma_caucao\s+on public\.pagamentos_bloco \(contrato_id\) where tipo = 'caucao' and anulado_em is null/);
    assert.match(sql, /create unique index if not exists pagamentos_bloco_um_valor_mensal\s+on public\.pagamentos_bloco \(bloco_id\) where tipo = 'aluguel' and anulado_em is null/);
    assert.match(sql, /add column if not exists anulado_em timestamptz/);
  }
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /^commit;/m);
  assert.match(aplicar, /'20261019000182'/);
  assert.match(rollback, /drop index if exists public\.pagamentos_bloco_uma_caucao/);
});

test("item 1 (servidor): conflito do índice devolve o registro existente com 'Este recebimento já foi registrado'", () => {
  const acoes = ler("./data/contratos-actions.ts");
  const corpo = acoes.slice(acoes.indexOf("export async function marcarPagamentoRecebido"), acoes.indexOf("async function pagamentoJaRegistrado"));
  assert.match(corpo, /error\.code === "23505"/);
  assert.match(corpo, /jaRegistrado: true, mensagem: MSG_JA_REGISTRADO/);
  assert.match(acoes, /const MSG_JA_REGISTRADO = "Este recebimento já foi registrado";/);
});

test("item 1 (tela): envio trava no 1º clique, botão desabilitado enquanto envia, formulário fecha no sucesso", () => {
  const tela = ler("../app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  assert.match(tela, /if \(enviando\.current\) return;\s*enviando\.current = true;/);
  assert.match(tela, /onClick=\{salvar\} disabled=\{saving\}/);
  assert.match(tela, /setOpen\(false\);\s*setDone\(true\);/);
});

test("item 2: Caução é do contrato — grava sem bloco e o rótulo nunca é 'Caução do bloco N'", () => {
  assert.equal(rotuloPagamentoBloco({ tipo: "caucao", valor: 6400, bloco: { numero: 1, meses: 2, inicio: null, fim: null } }), "Caução do contrato — R$ 6.400");
  assert.equal(rotuloPagamentoBloco({ tipo: "caucao", valor: 6400 }), "Caução do contrato — R$ 6.400");
  const acoes = ler("./data/contratos-actions.ts");
  assert.match(acoes, /bloco_id: tipo === "caucao" \? null : input\.blocoId/);
  // Regressão do laboratório (t230): a Caução sem bloco não pode cair no atalho de "exemplo" e sair sem gravar.
  assert.match(acoes, /\(\(input\.tipo \?\? "aluguel"\) === "aluguel" && !UUID_RE\.test\(input\.blocoId\)\)/);
  assert.match(migracao, /alter column bloco_id drop not null/);
  assert.match(migracao, /\(tipo = 'caucao' and bloco_id is null\) or \(tipo = 'aluguel' and bloco_id is not null\)/);
  const tela = ler("../app/(dashboard)/dashboard/contratos/contratos-client.tsx");
  assert.match(tela, /Caução do contrato — \{formatBRL\(caucaoTotal\)\}/);
  for (const f of [tela, ler("./pagamento-bloco.ts"), ler("../components/documentos/documentos-contrato.tsx")]) {
    assert.doesNotMatch(f, /Caução do bloco|Caução \(50%\)/);
  }
});

test("item 3: limpeza só de contas de teste, anula (nunca apaga) e o documento anulado sai da fila", () => {
  for (const sql of [migracao, aplicar]) {
    assert.match(sql, /join public\.profiles pr on pr\.id = p\.marcado_por and pr\.is_teste/);
    assert.match(sql, /set anulado_em = now\(\), anulado_motivo = 'registro em duplicidade'/);
    assert.doesNotMatch(sql, /delete from public\.(documentos_fiscais|pagamentos_bloco)/i);
    assert.match(sql, /update public\.documentos_falhas f\s+set resolvido_em = now\(\)/);
  }
  const emitir = ler("./fiscal/emitir.ts");
  assert.match(emitir, /if \(pg\.anulado_em\) return \{ ok: false, motivo: "pagamento anulado" \}/);
  const lista = ler("../components/documentos/documentos-contrato.tsx");
  assert.match(lista, /Anulado: \{motivo\}/);
  assert.match(lista, /href=\{`\/api\/documentos\/\$\{d\.id\}`\}/, "o PDF continua acessível");
});
