/*
  Conferência de entrada e de saída (ordem 404cd213, item 1, parte 1): regras puras.
  Roda: node --test src/lib/conferencia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  JANELA_ENTRADA_HORAS,
  decidirResposta,
  estadoConferencia,
  podeEditarItens,
  prazoEntrada,
  validarItem,
  type RespostaConferencia,
} from "./conferencia.ts";

const R = (parte: "proprietario" | "inquilino", decisao: "confirmou" | "contestou"): RespostaConferencia => ({
  parte,
  decisao,
  motivo: decisao === "contestou" ? "Falta a foto da cozinha" : null,
});

test("entrada: prazo é até 48 h depois do início do contrato", () => {
  assert.equal(JANELA_ENTRADA_HORAS, 48);
  assert.equal(prazoEntrada("2026-11-01T12:00:00Z").toISOString(), "2026-11-03T12:00:00.000Z");
});

test("estado: sem respostas = em andamento; uma confirmou = aguardando a outra; as duas = confirmada", () => {
  assert.equal(estadoConferencia([]), "em_andamento");
  assert.equal(estadoConferencia([R("inquilino", "confirmou")]), "aguardando_outra_parte");
  assert.equal(estadoConferencia([R("inquilino", "confirmou"), R("proprietario", "confirmou")]), "confirmada");
});

test("estado: qualquer contestação = contestada (mesmo se a outra parte confirmou)", () => {
  assert.equal(estadoConferencia([R("inquilino", "contestou")]), "contestada");
  assert.equal(estadoConferencia([R("inquilino", "confirmou"), R("proprietario", "contestou")]), "contestada");
});

test("itens só mudam enquanto ninguém respondeu (imutável depois de confirmado ou contestado)", () => {
  assert.equal(podeEditarItens([]), true);
  assert.equal(podeEditarItens([R("inquilino", "confirmou")]), false);
  assert.equal(podeEditarItens([R("proprietario", "contestou")]), false);
});

test("resposta: cada parte responde uma vez; contestar exige motivo; confirmar sem itens é recusado", () => {
  assert.deepEqual(decidirResposta({ respostas: [], parte: "inquilino", decisao: "confirmou", motivo: "", qtdItens: 3 }), { ok: true, motivo: null });
  const jaRespondeu = decidirResposta({ respostas: [R("inquilino", "confirmou")], parte: "inquilino", decisao: "contestou", motivo: "mudei de ideia", qtdItens: 3 });
  assert.equal(jaRespondeu.ok, false);
  const semMotivo = decidirResposta({ respostas: [], parte: "proprietario", decisao: "contestou", motivo: "  ", qtdItens: 3 });
  assert.equal(semMotivo.ok, false);
  const semItens = decidirResposta({ respostas: [], parte: "proprietario", decisao: "confirmou", motivo: "", qtdItens: 0 });
  assert.equal(semItens.ok, false);
  const comMotivo = decidirResposta({ respostas: [], parte: "proprietario", decisao: "contestou", motivo: "  Parede riscada  ", qtdItens: 3 });
  assert.deepEqual(comMotivo, { ok: true, motivo: "Parede riscada" });
});

test("item: cômodo obrigatório, descrição até 300, foto só do próprio envio, sem 'vistoria'", () => {
  assert.equal(validarItem({ comodo: "Sala", descricao: "Sofá cinza", fotoPath: null }).ok, true);
  assert.equal(validarItem({ comodo: " ", descricao: "x", fotoPath: null }).ok, false);
  assert.equal(validarItem({ comodo: "Sala", descricao: "", fotoPath: null }).ok, false);
  assert.equal(validarItem({ comodo: "Sala", descricao: "a".repeat(301), fotoPath: null }).ok, false);
  assert.equal(validarItem({ comodo: "Sala", descricao: "ok", fotoPath: "../outro/x.jpg" }).ok, false);
  assert.equal(validarItem({ comodo: "Sala", descricao: "ok", fotoPath: "uid/abc.webp" }).ok, true);
});

test("migração 0110: tabelas, RLS só leitura para as partes e imutabilidade no banco", () => {
  const sql = readFileSync("supabase/migrations/0110_conferencia_entrada_saida.sql", "utf8");
  for (const t of ["conferencias", "conferencia_itens", "conferencia_respostas"]) {
    assert.match(sql, new RegExp(`public\\.${t}`));
    assert.match(sql, new RegExp(`alter table public\\.${t} enable row level security`));
  }
  assert.match(sql, /revoke all on public\.conferencias from anon, authenticated/);
  assert.match(sql, /trigger conferencia_respostas_imutavel/);
  assert.match(sql, /trigger conferencia_itens_trava/);
  assert.doesNotMatch(sql, /vistoria/i);
  const aplicar = readFileSync("supabase/producao/aplicar-0110.sql", "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /0110_conferencia_entrada_saida/);
});

test("ações do servidor: só as partes do contrato agem, foto só da própria pasta, sem 'vistoria'", () => {
  const src = readFileSync("src/lib/data/conferencia-actions.ts", "utf8");
  assert.match(src, /^"use server";/);
  assert.equal((src.match(/await parteDoContrato\(/g) ?? []).length, 2);
  assert.match(src, /tenant_id === user\.id \? "inquilino" : donoId === user\.id \? "proprietario" : null/);
  assert.match(src, /startsWith\(`\$\{ctx\.uid\}\/`\)/);
  assert.match(src, /consumirLimite\(/);
  assert.doesNotMatch(src + readFileSync("src/lib/conferencia.ts", "utf8"), /vistoria/i);
});
