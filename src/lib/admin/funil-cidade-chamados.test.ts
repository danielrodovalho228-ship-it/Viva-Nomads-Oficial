/*
  Ordem 7ac560e7 (QA do admin 12/10), F16 e F18: prova de que o funil só estreita com o filtro de cidade e de que
  "chamados" não conta duas coisas diferentes com o mesmo nome. Leitura do código (a consulta roda no banco).
  Roda: node --test src/lib/admin/funil-cidade-chamados.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FUNIL, funil } from "./visao-geral.ts";

const dados = readFileSync("src/lib/data/admin-indicadores.ts", "utf8");

test("F18: toda etapa do funil vem de um indicador x_* calculado pela mesma função, período e cidade", () => {
  const trecho = dados.slice(dados.indexOf("export async function extrasDoPeriodo"), dados.indexOf("export async function extrasDoPeriodo") + 1200);
  for (const f of ["contratosReais(admin, periodo, cidade)", "candidaturasDoPeriodo(admin, periodo, cidade)", "eventosDoPeriodo(admin, periodo, cidade,"]) {
    assert.ok(trecho.includes(f), `extrasDoPeriodo deve passar a cidade: ${f}`);
  }
  assert.equal(FUNIL.length, 6);
});

test("F18: o filtro de cidade dos eventos é feito no banco (eq cidade_chave), nunca somando eventos sem cidade", () => {
  const i = dados.indexOf("export async function eventosDoPeriodo");
  const corpo = dados.slice(i, i + 900);
  assert.match(corpo, /if \(k\) q = q\.eq\("cidade_chave", k\)/);
  assert.doesNotMatch(corpo, /\.or\(.*cidade_chave.*is\.null/);
});

test("F18: com dados fixos, filtrar só tira etapas — o funil calculado não ganha contagem", () => {
  const todas = { x_ev_busca: 3, x_ev_ver_anuncio: 3, x_ev_iniciar_candidatura: 2, x_candidaturas: 1, x_cand_aceitas: 1, x_contratos: 0 };
  const cidade = { x_ev_busca: 2, x_ev_ver_anuncio: 1, x_ev_iniciar_candidatura: 1, x_candidaturas: 1, x_cand_aceitas: 0, x_contratos: 0 };
  const a = funil(todas as never);
  const b = funil(cidade as never);
  a.forEach((e, i) => assert.ok((b[i].valor ?? 0) <= (e.valor ?? 0), `${e.rotulo}: cidade ${b[i].valor} > geral ${e.valor}`));
});

test("F16: o card da home diz 'Solicitações de manutenção', não 'Chamados abertos' (atendimento tem outra contagem)", () => {
  const home = readFileSync("src/lib/admin/visao-geral.ts", "utf8");
  assert.match(home, /rotulo: "Solicitações de manutenção abertas"/);
  assert.doesNotMatch(home, /rotulo: "Chamados abertos"/);
  assert.match(home, /Não é a fila de atendimento/);
});
