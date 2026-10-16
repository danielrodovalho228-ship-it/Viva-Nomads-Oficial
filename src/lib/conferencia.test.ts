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
  mesclarItens,
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
  assert.equal((src.match(/await parteDoContrato\(/g) ?? []).length, 5);
  assert.match(src, /tenant_id === user\.id \? "inquilino" : donoId === user\.id \? "proprietario" : null/);
  assert.match(src, /startsWith\(`\$\{ctx\.uid\}\/`\)/);
  assert.match(src, /consumirLimite\(/);
  assert.doesNotMatch(src + readFileSync("src/lib/conferencia.ts", "utf8"), /vistoria/i);
});

// ---- Parte 2: laudo independente e foto por cômodo (ordem d3c60126) ----
import { LAUDO_MAX_BYTES, FOTO_CONFERENCIA_MAX_BYTES, validarLaudo, validarFotoConferencia, fonteDaConferencia } from "./conferencia.ts";

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const EXE = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);

test("laudo independente: só PDF de verdade, até 15 MB, não vazio", () => {
  assert.equal(LAUDO_MAX_BYTES, 15 * 1024 * 1024);
  assert.deepEqual(validarLaudo({ bytes: PDF, tamanho: 200_000 }), { ok: true, tipo: "application/pdf", ext: "pdf" });
  assert.equal(validarLaudo({ bytes: EXE, tamanho: 200_000 }).ok, false); // "laudo.pdf" que é executável
  assert.equal(validarLaudo({ bytes: JPG, tamanho: 200_000 }).ok, false); // laudo é PDF
  assert.equal(validarLaudo({ bytes: PDF, tamanho: LAUDO_MAX_BYTES + 1 }).ok, false);
  assert.equal(validarLaudo({ bytes: PDF, tamanho: 0 }).ok, false);
});

test("foto do cômodo: JPG/PNG/WebP até 8 MB; PDF e executável recusados", () => {
  assert.equal(FOTO_CONFERENCIA_MAX_BYTES, 8 * 1024 * 1024);
  assert.equal(validarFotoConferencia({ bytes: JPG, tamanho: 1000 }).ok, true);
  assert.equal(validarFotoConferencia({ bytes: PDF, tamanho: 1000 }).ok, false);
  assert.equal(validarFotoConferencia({ bytes: EXE, tamanho: 1000 }).ok, false);
  assert.equal(validarFotoConferencia({ bytes: JPG, tamanho: FOTO_CONFERENCIA_MAX_BYTES + 1 }).ok, false);
});

test("laudo independente prevalece sobre as fotos quando existe", () => {
  assert.equal(fonteDaConferencia(false), "fotos");
  assert.equal(fonteDaConferencia(true), "laudo_independente");
});

test("migração 0117: laudo em tabela com RLS, imutável, bucket privado; produção idempotente com rollback", () => {
  const sql = readFileSync("supabase/migrations/0117_conferencia_laudo.sql", "utf8");
  assert.match(sql, /public\.conferencia_laudos/);
  assert.match(sql, /alter table public\.conferencia_laudos enable row level security/);
  assert.match(sql, /'conferencia', 'conferencia', false/);
  assert.match(sql, /conferencia_laudos_imutavel/);
  const prod = readFileSync("supabase/producao/aplicar-0117.sql", "utf8");
  assert.match(prod, /^begin;/m);
  assert.match(prod, /commit;/);
  assert.match(prod, /schema_migrations/);
  assert.match(prod, /0117_conferencia_laudo/);
  assert.match(readFileSync("supabase/producao/rollback/0117_rollback.sql", "utf8"), /drop table if exists public\.conferencia_laudos/);
});

test("ações: arquivos validados no servidor e nunca a palavra 'vistoria' em texto de tela", () => {
  const acoes = readFileSync("src/lib/data/conferencia-actions.ts", "utf8");
  assert.match(acoes, /validarLaudo\b/);
  assert.match(acoes, /validarFotoConferencia\b/);
  assert.match(acoes, /export async function anexarLaudoConferencia/);
  assert.match(acoes, /export async function enviarFotoConferencia/);
  const tela = readFileSync("src/components/contrato/conferencia-contrato.tsx", "utf8");
  assert.doesNotMatch(tela, /vistoria/i);
  assert.match(tela, /laudo independente/i);
  assert.match(readFileSync("src/components/contrato/contrato-detalhe.tsx", "utf8"), /ConferenciaContrato/);
});

test("mesclarItens: o item recém-registrado aparece na hora e não repete quando o servidor já o traz", () => {
  const sala = { id: "a", parte: "proprietario" as const, comodo: "Sala", descricao: "Sofá", fotoUrl: null, criadoEm: "2026-10-16T01:00:00Z" };
  const quarto = { id: "b", parte: "inquilino" as const, comodo: "Quarto", descricao: "Cama", fotoUrl: null, criadoEm: "2026-10-16T02:00:00Z" };
  // Servidor ainda vazio (página não recarregou): o item local aparece.
  assert.deepEqual(mesclarItens([], [sala]), [sala]);
  // Servidor já traz o item: sem repetir, ordem do mais antigo ao mais novo.
  assert.deepEqual(mesclarItens([sala], [sala, quarto]), [sala, quarto]);
  assert.deepEqual(mesclarItens([quarto, sala], []), [sala, quarto]);
});

test("ações: registrar item devolve o item e atualiza as duas telas (locações e contratos)", () => {
  const acoes = readFileSync("src/lib/data/conferencia-actions.ts", "utf8");
  assert.match(acoes, /return \{ ok: true, id: item\.id, item \}/);
  const trecho = acoes.slice(acoes.indexOf("export async function registrarItemConferencia"), acoes.indexOf("export async function responderConferencia"));
  assert.match(trecho, /revalidatePath\("\/dashboard\/contratos"\)/);
});
