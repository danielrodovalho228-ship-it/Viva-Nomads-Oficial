/*
  E576 — parceria aprovada e ainda não ativada: Papéis mostra "Parceria aprovada — ativar sua página" (com o caminho
  para o painel) e o Início avisa. Roda: node --test src/lib/parceiros/e576-papeis-parceria-aprovada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOTAO_PARCERIA_APROVADA, HREF_ATIVAR_PARCERIA, situacaoParceiro } from "./situacao-conta.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("situação: aprovada sem página × ativo × nenhum", () => {
  assert.equal(situacaoParceiro({ parceiro: null, solicitacao: { status: "aprovada" } }), "aprovada_sem_pagina");
  assert.equal(situacaoParceiro({ parceiro: { status: "rascunho" }, solicitacao: { status: "aprovada" } }), "ativo");
  assert.equal(situacaoParceiro({ parceiro: { status: "publicado" }, solicitacao: null }), "ativo");
  // Página suspensa não reabre a ativação nem conta como ativa.
  assert.equal(situacaoParceiro({ parceiro: { status: "suspenso" }, solicitacao: { status: "aprovada" } }), "nenhum");
  for (const s of ["pendente", "aguardando_email", "recusada"]) assert.equal(situacaoParceiro({ parceiro: null, solicitacao: { status: s } }), "nenhum", s);
  assert.equal(situacaoParceiro({ parceiro: null, solicitacao: null }), "nenhum");
  assert.equal(situacaoParceiro(null), "nenhum");
  assert.equal(BOTAO_PARCERIA_APROVADA, "Parceria aprovada — ativar sua página");
  assert.equal(HREF_ATIVAR_PARCERIA, "/dashboard/parceiro");
});

test("Papéis: o cartão do parceiro usa a situação (aprovada → botão de ativar), não só 'Cadastrar meu serviço'", () => {
  const tela = ler("src/components/account/tela-papeis.tsx");
  assert.match(tela, /situacaoParceiro\(/);
  assert.match(tela, /minhaParceria\(\)/);
  assert.match(tela, /BOTAO_PARCERIA_APROVADA/);
  assert.match(tela, /data-testid="papel-parceiro-aprovada"/);
  assert.match(tela, /href=\{HREF_ATIVAR_PARCERIA\}/);
});

test("Início: aviso da parceria aprovada com o caminho para ativar", () => {
  const inicio = ler("src/app/(dashboard)/dashboard/inicio-dados.tsx");
  // E503: a leitura da parceria sai no 2º lote paralelo do Início (antes, uma espera em série só para ela).
  assert.match(inicio, /minhaParceria\(\), LIMITE_LEITURA_INICIO_MS\)\.catch\(\(\) => null\)/);
  assert.match(inicio, /const parceria = situacaoParceiro\(parceriaLida\);/);
  assert.match(inicio, /data-testid="inicio-parceria-aprovada"/);
  assert.match(inicio, /href=\{HREF_ATIVAR_PARCERIA\}/);
});
