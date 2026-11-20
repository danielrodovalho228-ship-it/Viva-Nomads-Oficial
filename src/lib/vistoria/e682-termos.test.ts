/* E682 — o avaliador declara os PRÓPRIOS termos (valor, prazo de entrega, prazo de resposta); o dono vê na lista de escolha.
   Roda: node --test src/lib/vistoria/e682-termos.test.ts */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { PRAZO_RESPOSTA_PADRAO_HORAS, linhaDeTermos, validarTermos } from "./escolha.ts";
import { designacaoVencida } from "./regras.ts";

const ler = (p: string) => readFileSync(p, "utf8");

test("termos válidos: valor > 0, entrega de 1 a 30 dias, resposta de 1 a 72 horas", () => {
  const r = validarTermos({ valor: 350, prazoEntregaDias: 5, prazoRespostaHoras: 12 });
  assert.deepEqual(r, { ok: true, valor: 350, prazoEntregaDias: 5, prazoRespostaHoras: 12 });
});

test("termos inválidos são recusados com a causa", () => {
  assert.equal(validarTermos({ valor: 0, prazoEntregaDias: 5, prazoRespostaHoras: 12 }).ok, false);
  assert.equal(validarTermos({ valor: 300, prazoEntregaDias: 31, prazoRespostaHoras: 12 }).ok, false);
  assert.equal(validarTermos({ valor: 300, prazoEntregaDias: 2.5, prazoRespostaHoras: 12 }).ok, false);
  assert.equal(validarTermos({ valor: 300, prazoEntregaDias: 5, prazoRespostaHoras: 0 }).ok, false);
  assert.equal(validarTermos({ valor: 300, prazoEntregaDias: 5, prazoRespostaHoras: 73 }).ok, false);
});

test("a linha da lista mostra só a conduta publicada: nem preço nem prazo (E682)", () => {
  const com = linhaDeTermos({ notaConduta: 4.5, avaliacoesConduta: 7 });
  assert.equal(com, "conduta 4,5 · 7 avaliações feitas");
  assert.doesNotMatch(com, /R\$|entrega|dias|\bh\b/);
  const sem = linhaDeTermos({ notaConduta: null, avaliacoesConduta: 0 });
  assert.equal(sem, "sem avaliações de conduta ainda");
});

test("o prazo para o avaliador responder é o que ELE declarou (padrão 24 h); recusa ou silêncio devolvem ao dono, sem rodízio", () => {
  const t0 = "2026-11-07T10:00:00Z";
  assert.equal(PRAZO_RESPOSTA_PADRAO_HORAS, 24);
  assert.equal(designacaoVencida(t0, new Date("2026-11-07T21:59:00Z"), 12), false);
  assert.equal(designacaoVencida(t0, new Date("2026-11-07T22:00:00Z"), 12), true);
  assert.equal(designacaoVencida(t0, new Date("2026-11-08T09:59:00Z")), false); // padrão 24 h
  assert.equal(designacaoVencida(t0, new Date("2026-11-08T10:00:00Z")), true);
});

test("a migração é aditiva (3 colunas com limites) e o aplicar/rollback existem", () => {
  const mig = ler("supabase/migrations/0325_termos_do_avaliador_e682.sql").replace(/--[^\n]*/g, "");
  assert.match(mig, /add column if not exists preco_proprio numeric\(10, 2\)/);
  assert.match(mig, /add column if not exists prazo_entrega_dias integer/);
  assert.match(mig, /add column if not exists prazo_resposta_horas integer/);
  assert.doesNotMatch(mig, /\bdrop\b|\bdelete\b|\btruncate\b|AUTOMACOES_ATIVO/i);
  assert.match(ler("supabase/producao/aplicar-0325.sql"), /20261107000325/);
  assert.match(ler("supabase/producao/rollback/0325_rollback.sql"), /drop column if exists preco_proprio/);
});

test("o cron de designações usa o prazo declarado e a ação do avaliador salva os termos (atrás da chave)", () => {
  const servidor = ler("src/lib/vistoria/servidor.ts");
  assert.match(servidor, /prazo_resposta_horas/);
  const acoes = ler("src/lib/vistoria/actions.ts");
  const f = acoes.slice(acoes.indexOf("export async function salvarMeusTermos"));
  assert.match(f, /vistoriaAtiva\(\)/);
  assert.match(f, /validarTermos\(/);
  assert.match(f, /preco_proprio/);
});

test("a lista do dono mostra os termos e a conduta publicada de cada avaliador e continua dentro do bloco já existente (sem tela nova)", () => {
  const bloco = ler("src/components/vistoria/bloco-avaliacao-dono.tsx");
  assert.match(bloco, /linhaDeTermos\(/);
  assert.match(bloco, /avaliadores_publicos/);
});
