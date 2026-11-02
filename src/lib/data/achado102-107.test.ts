/*
  Varredura de erros e estados vazios (rodada 22, lote 1 das leituras restantes) — leitura que falha nunca vira "vazio".
  Achado 102 (média): aprovações pendentes → "nenhum cartão" escondia aprovações; rota responde 503.
  Achado 103 (média): rascunho da IA no atendimento → sem a conversa/perfil/contrato, a IA escreveria às cegas.
  Achado 104 (baixa): calendário importado → "Calendário não encontrado" para link que existe.
  Achado 105 (baixa): visualizações do dono → "0 visualizações" por engano.
  Achado 106 (baixa): estado do contrato no Fechamento → "não existe" logo depois de registrar.
  Achado 107 (baixa): nomes e imóveis nas listas do admin → em branco.
  Sem ação neste lote (justificado): ativacoesDe (upsert idempotente, o checklist decide pelo fato), atividadeRecente
  (o chamador já trata), autoresDasAvaliacoes (selos só positivos, falha fechada), cartaoPeloCurto (cai em /buscar),
  dadosDoCartao (imagem do cartão sem foto, sem decisão).
  Roda: node --test src/lib/data/achado102-107.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const fn = (s: string, de: string) => {
  const i = s.indexOf(de);
  const j = s.indexOf("\nexport ", i + 1);
  return s.slice(i, j < 0 ? undefined : j);
};

test("achado 102: aprovações lançam; a rota responde 503; o motor já recusa sem os cartões", () => {
  assert.match(fn(ler("src/lib/agentes/aprovacoes-servidor.ts"), "export async function listarPendentesAdmin"), /if \(error\) throw new Error\(/);
  assert.match(ler("src/app/api/admin/aprovacoes/route.ts"), /listarPendentesAdmin\(sessao\)\.catch\(\(\) => null\);\s*if \(!cartoes\) return NextResponse\.json\(\{ erro: [^}]+\}, \{ status: 503/);
  assert.match(ler("src/lib/agentes/motor.ts"), /d\.aprovacoesPendentes\(\)\.catch\(\(\) => null\)/);
});

test("achado 103: rascunho da IA não sai sem chamado, conversa, perfil e contratos", () => {
  const s = ler("src/lib/atendimento/viva-servidor.ts");
  const f = fn(s, "export async function sugerirRascunho");
  assert.equal(f.match(/throw new Error\(MSG_RASCUNHO_SEM_LEITURA\)/g)?.length, 3);
  assert.match(s, /sugerirRascunho\(c\.id\)\.catch\(\(\) => null\)/);
  assert.match(ler("src/lib/data/atendimento-actions.ts"), /if \(s === "falhou"\) return \{ ok: false, error: "Não foi possível ler o chamado agora\. Tente de novo\." \};/);
});

test("achado 104: calendário importado lança; atualizar e remover pedem 'Tente de novo'", () => {
  assert.match(fn(ler("src/lib/calendario/importar-servidor.ts"), "export async function importacaoPorId"), /if \(error\) throw new Error\(/);
  const a = ler("src/lib/data/calendario-importacao-actions.ts");
  assert.equal(a.match(/if \(d === "falhou"\) return \{ ok: false, erro: MSG_CALENDARIO_SEM_LEITURA \};/g)?.length, 2);
});

test("achados 105–107: visualizações, estado do contrato e nomes do admin lançam", () => {
  const v = fn(ler("src/lib/data/desempenho-anuncio.ts"), "export async function visualizacoesDoDono");
  assert.match(v, /if \(e1\) throw new Error\(/);
  assert.match(v, /if \(e2\) throw new Error\(/);
  assert.match(ler("src/app/(dashboard)/dashboard/page.tsx"), /visualizacoesDoDono\(agora\)\.catch\(\(\) => null\)/);
  assert.match(fn(ler("src/lib/data/contratos-actions.ts"), "export async function lerEstadoDoContrato"), /if \(error\) throw new Error\(/);
  const i = ler("src/lib/data/admin-indicadores.ts");
  assert.match(fn(i, "export async function nomesCurtos"), /if \(error\) throw new Error\(/);
  assert.match(fn(i, "export async function imovelDosLeads"), /if \(error\) throw new Error\(/);
});
