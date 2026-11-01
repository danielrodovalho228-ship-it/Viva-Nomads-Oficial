/*
  E415 — a prova feita na hora credita o item no resultado da Qualificação (rascunho reaberto pelo botão "Qualificação").
  Roda: node --test src/lib/anuncio/qualificacao-nivel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHAVES_CONFORTO } from "../../config/conforto-minimo.ts";
import { nivelDaQualificacao, type ProvasDoRascunho } from "./qualificacao-nivel.ts";
import { nivelDoResultado } from "./qualificacao-conforto.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const AGORA = new Date("2026-11-01T15:00:00Z");
const TUDO = [...CHAVES_CONFORTO];
const vazio: ProvasDoRascunho = { itens: [], medidas: [], ruido: null, bloqueadas: [] };
const foto = (chave: string, fotoStatus: "pendente" | "aceita" | "recusada" = "pendente") => ({ chave, declarado: true, fotoPath: `u/${chave}.jpg`, fotoStatus, fotoOrigem: "camera" as const });

test("sem rascunho salvo: o mesmo resultado de antes (só pelas respostas)", () => {
  const r = nivelDaQualificacao(TUDO, {}, null, AGORA);
  const antes = nivelDoResultado(TUDO, {});
  assert.equal(r.nivel, antes.nivel);
  assert.deepEqual(r.paraSubir, antes.paraSubir);
  assert.deepEqual(r.provados, []);
  assert.equal(nivelDaQualificacao(TUDO.slice(1), {}, null, AGORA).nivel, null);
});

test("E415: foto feita na hora (em análise) credita o item — sai do 'para subir' e entra em 'já provado'", () => {
  const sem = nivelDaQualificacao(TUDO, {}, vazio, AGORA);
  assert.equal(sem.nivel, "Essencial");
  assert.equal(sem.proximo, "Conforto");
  assert.ok(sem.paraSubir.includes("2 jogos de roupa de cama"));
  const com = nivelDaQualificacao(TUDO, {}, { ...vazio, itens: [foto("sono_dois_jogos")] }, AGORA);
  assert.ok(!com.paraSubir.includes("2 jogos de roupa de cama"), "o item provado não aparece mais como falta");
  assert.deepEqual(com.provados, ["2 jogos de roupa de cama"]);
  assert.equal(com.paraSubir.length, sem.paraSubir.length - 1);
  // Aceita pelo atendimento: também conta.
  assert.deepEqual(nivelDaQualificacao(TUDO, {}, { ...vazio, itens: [foto("sono_dois_jogos", "aceita")] }, AGORA).provados, ["2 jogos de roupa de cama"]);
});

test("foto recusada ou item com pendência aberta não credita", () => {
  const recusada = nivelDaQualificacao(TUDO, {}, { ...vazio, itens: [foto("sono_dois_jogos", "recusada")] }, AGORA);
  assert.deepEqual(recusada.provados, []);
  assert.ok(recusada.paraSubir.includes("2 jogos de roupa de cama"));
  const bloqueada = nivelDaQualificacao(TUDO, {}, { ...vazio, itens: [foto("sono_dois_jogos")], bloqueadas: ["sono_dois_jogos"] }, AGORA);
  assert.deepEqual(bloqueada.provados, []);
});

test("o que as respostas já dizem segue fora da lista (E179), com ou sem provas", () => {
  const r = nivelDaQualificacao(TUDO, { cozinha: "micro" }, vazio, AGORA);
  assert.ok(!r.paraSubir.includes("Micro-ondas"));
});

test("sem o essencial: sem nível, mesmo com fotos de Conforto", () => {
  const r = nivelDaQualificacao(TUDO.slice(1), {}, { ...vazio, itens: [foto("sono_dois_jogos")] }, AGORA);
  assert.equal(r.nivel, null);
  assert.equal(r.proximo, null);
});

test("tela: o resultado usa as provas do rascunho; a página lê com entradaNivelDoCadastro", () => {
  const tela = ler("src/app/(dashboard)/dashboard/imoveis/novo/qualificacao.tsx");
  assert.match(tela, /nivelDaQualificacao\(conforto, respostas, provas, agora\)/);
  assert.match(tela, /data-testid="qualificacao-provados"/);
  assert.doesNotMatch(tela, /nivelDoResultado\(/);
  const pagina = ler("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx");
  assert.match(pagina, /const idProvasQual = mostrarQualificacao \? imovelId : null;/);
  assert.match(pagina, /entradaNivelDoCadastro\(idProvasQual\)/);
  assert.match(pagina, /provas=\{provasDaQualificacao\}/);
});
