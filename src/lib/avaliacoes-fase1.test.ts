/*
  Avaliações, fase 1 (0089): regras puras + conferência da migração.
  Roda: node --test src/lib/avaliacoes-fase1.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contemOfensa, LIMITE_COMENTARIO, OFENSAS } from "./avaliacoes.ts";

const SQL = readFileSync(new URL("../../supabase/migrations/0089_avaliacoes_fase1.sql", import.meta.url), "utf8");
const codigo = SQL.replace(/--.*$/gm, "");

test("filtro de ofensa: pega com e sem acento e maiúscula; não pega palavra maior que contém o termo", () => {
  for (const t of ["Proprietário ESCROTO", "que merda de imóvel", "vagabunda", "Desgraçado", "fdp"]) assert.ok(contemOfensa(t), t);
  for (const t of ["Ótima casa, macacão de chuva no armário", "Recomendo, tudo limpo", "cuidadoso com o imóvel", "computador ok", null, ""]) assert.ok(!contemOfensa(t), String(t));
});

test("a lista de ofensas do site é a MESMA da função do banco", () => {
  const lista = /contem_ofensa[\s\S]*?\\m\(([^)]+(?:\[[^\]]+\][^)|]*)*[^)]*)\)\\M/.exec(SQL)?.[1] ?? "";
  assert.deepEqual(lista.split("|"), [...OFENSAS]);
});

test("limite de 500 caracteres igual no site e no banco", () => {
  assert.equal(LIMITE_COMENTARIO, 500);
  for (const c of ["comentario_publico", "nota_privada_parte", "nota_privada_viva"]) assert.match(codigo, new RegExp(`${c} text check \\(char_length\\(${c}\\) <= 500\\)`));
});

test("0089: trava se alguma tabela antiga tiver linha; uma tabela só; colunas pedidas", () => {
  assert.match(codigo, /reviews tem % linha\(s\): migração interrompida/);
  assert.match(codigo, /property_reviews tem % linha\(s\)/);
  assert.match(codigo, /avaliacoes tem % linha\(s\)/);
  for (const t of ["drop table public.reviews;", "drop table public.property_reviews;", "drop table public.avaliacoes;"]) assert.ok(codigo.includes(t), t);
  assert.doesNotMatch(codigo, /author_name/);
  for (const c of ["contrato_id uuid not null", "autor_id", "alvo_id", "papel_autor", "imovel_id", "nota_geral int", "notas_categorias jsonb", "etiquetas text[]", "recomendaria boolean", "comentario_publico", "nota_privada_parte", "nota_privada_viva", "enviada_em", "publicada_em", "criado_em", "unique (contrato_id, autor_id)"])
    assert.ok(codigo.includes(c), c);
  assert.match(codigo, /status in \('rascunho', 'enviada', 'publicada', 'em_moderacao', 'removida'\)/);
});

test("0089: notas privadas nunca saem para anon/logado; sem DELETE; INSERT só com pode_avaliar", () => {
  const sel = /grant select \(([^)]+)\)\s+on public\.avaliacoes to anon, authenticated/.exec(codigo)?.[1] ?? "";
  assert.ok(sel.includes("comentario_publico"));
  for (const c of ["nota_privada_parte", "nota_privada_viva", "moderacao_motivo"]) assert.ok(!sel.includes(c), c);
  assert.doesNotMatch(codigo, /grant[^;]*delete[^;]*to (anon|authenticated)/i);
  assert.match(codigo, /for insert to authenticated\s+with check \(autor_id = auth\.uid\(\) and status in \('rascunho', 'enviada', 'em_moderacao'\) and public\.pode_avaliar\(contrato_id, alvo_id\)\)/);
  assert.match(codigo, /for select to anon, authenticated\s+using \(status = 'publicada'\)/);
  assert.match(codigo, /now\(\) <= c\.encerrado_em \+ interval '14 days'/);
  assert.match(codigo, /Avaliação enviada não pode ser alterada/);
  assert.match(codigo, /grant execute on function public\.publicar_avaliacoes\(uuid\) to service_role;/);
});

test("0089: às cegas — publica quando a outra parte enviou ou quando vencem os 14 dias; filtro manda para moderação", () => {
  assert.match(codigo, /b\.status in \('enviada', 'em_moderacao', 'publicada'\)/);
  assert.match(codigo, /c\.encerrado_em \+ interval '14 days' <= now\(\)/);
  assert.match(codigo, /contem_contato\(new\.comentario_publico, true\)[\s\S]*new\.status := 'em_moderacao'/);
  assert.match(codigo, /contem_ofensa\(new\.comentario_publico\)/);
});

test("0089: Fernanda vira Confiança e Reputação e continua planejada", () => {
  assert.match(codigo, /set cargo = 'Confiança e Reputação',/);
  assert.match(codigo, /briefing = 'Antifraude de cadastros e moderação das avaliações entre inquilino e proprietário: filtra ofensas e dados pessoais, detecta avaliação falsa ou retaliação, calcula a reputação e os selos\.'/);
  assert.doesNotMatch(codigo, /status = 'ativo'[\s\S]*where slug = 'fernanda'/);
});
