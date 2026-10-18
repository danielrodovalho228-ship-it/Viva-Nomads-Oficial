/*
  Conferência de entrada e de saída (ordem 404cd213, item 1, parte 1): regras puras.
  Roda: node --test src/lib/conferencia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  erroTamanhoLaudo,
  JANELA_ENTRADA_HORAS,
  janelaEncerrada,
  decidirResposta,
  mesclarItens,
  mesclarLaudo,
  mesclarRespostas,
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

test("itens: cada parte edita até responder; com as duas respostas nada mais muda (ordem 99c7c1e0)", () => {
  assert.equal(podeEditarItens([], "inquilino"), true);
  // o inquilino respondeu: o proprietário ainda registra, o inquilino não
  assert.equal(podeEditarItens([R("inquilino", "confirmou")], "proprietario"), true);
  assert.equal(podeEditarItens([R("inquilino", "confirmou")], "inquilino"), false);
  assert.equal(podeEditarItens([R("proprietario", "contestou")], "inquilino"), true);
  // as duas responderam: tudo congelado
  assert.equal(podeEditarItens([R("inquilino", "confirmou"), R("proprietario", "confirmou")], "proprietario"), false);
  assert.equal(podeEditarItens([R("inquilino", "confirmou"), R("proprietario", "contestou")], "inquilino"), false);
});

const AMBOS = { proprietario: 2, inquilino: 1 };

test("resposta: cada parte responde uma vez; contestar exige motivo; confirmar sem itens é recusado", () => {
  assert.deepEqual(decidirResposta({ respostas: [], parte: "inquilino", decisao: "confirmou", motivo: "", itensPorParte: AMBOS }), { ok: true, motivo: null });
  const jaRespondeu = decidirResposta({ respostas: [R("inquilino", "confirmou")], parte: "inquilino", decisao: "contestou", motivo: "mudei de ideia", itensPorParte: AMBOS });
  assert.equal(jaRespondeu.ok, false);
  const semMotivo = decidirResposta({ respostas: [], parte: "proprietario", decisao: "contestou", motivo: "  ", itensPorParte: AMBOS });
  assert.equal(semMotivo.ok, false);
  const semItens = decidirResposta({ respostas: [], parte: "proprietario", decisao: "confirmou", motivo: "", itensPorParte: { proprietario: 0, inquilino: 0 } });
  assert.equal(semItens.ok, false);
  const comMotivo = decidirResposta({ respostas: [], parte: "proprietario", decisao: "contestou", motivo: "  Parede riscada  ", itensPorParte: AMBOS });
  assert.deepEqual(comMotivo, { ok: true, motivo: "Parede riscada" });
});

test("resposta: parte que responde antes de a outra registrar é recusada (caso negativo da ordem 99c7c1e0)", () => {
  const antes = decidirResposta({ respostas: [], parte: "inquilino", decisao: "confirmou", motivo: "", itensPorParte: { proprietario: 0, inquilino: 3 } });
  assert.equal(antes.ok, false);
  assert.match(antes.ok ? "" : antes.erro, /outra parte/);
  // depois de a outra registrar, passa
  assert.equal(decidirResposta({ respostas: [], parte: "inquilino", decisao: "confirmou", motivo: "", itensPorParte: { proprietario: 1, inquilino: 3 } }).ok, true);
  // janela de 48 h da entrada fechada: responde mesmo sem a outra parte, desde que tenha item próprio
  assert.equal(decidirResposta({ respostas: [], parte: "inquilino", decisao: "confirmou", motivo: "", itensPorParte: { proprietario: 0, inquilino: 3 }, janelaEncerrada: true }).ok, true);
  assert.equal(decidirResposta({ respostas: [], parte: "inquilino", decisao: "confirmou", motivo: "", itensPorParte: { proprietario: 2, inquilino: 0 }, janelaEncerrada: true }).ok, false);
});

test("janela: só a entrada tem prazo de 48 h", () => {
  const inicio = "2026-11-01T12:00:00Z";
  assert.equal(janelaEncerrada("entrada", inicio, new Date("2026-11-03T11:59:00Z")), false);
  assert.equal(janelaEncerrada("entrada", inicio, new Date("2026-11-03T12:01:00Z")), true);
  assert.equal(janelaEncerrada("entrada", null, new Date("2030-01-01T00:00:00Z")), false);
  assert.equal(janelaEncerrada("saida", inicio, new Date("2030-01-01T00:00:00Z")), false);
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

test("mesclarRespostas: a resposta que a pessoa acabou de dar vale na hora e não repete quando o servidor já a traz", () => {
  const minha = { parte: "inquilino" as const, decisao: "confirmou" as const, motivo: null, decididoEm: "2026-10-16T03:00:00Z" };
  const doDono = { parte: "proprietario" as const, decisao: "confirmou" as const, motivo: null, decididoEm: "2026-10-16T04:00:00Z" };
  // Servidor ainda sem resposta (página não recarregou): a minha aparece e o estado muda.
  assert.deepEqual(mesclarRespostas([], [minha]), [minha]);
  assert.equal(estadoConferencia(mesclarRespostas([], [minha])), "aguardando_outra_parte");
  // Servidor já traz a minha: uma só por parte, vale a do servidor.
  assert.deepEqual(mesclarRespostas([minha], [minha]), [minha]);
  assert.equal(estadoConferencia(mesclarRespostas([doDono], [minha])), "confirmada");
});

test("tela: depois de confirmar ou contestar, a resposta entra na tela sem esperar o recarregamento", () => {
  const tela = readFileSync("src/components/contrato/conferencia-contrato.tsx", "utf8");
  assert.match(tela, /mesclarRespostas\(/);
  const acoes = readFileSync("src/lib/data/conferencia-actions.ts", "utf8");
  const trecho = acoes.slice(acoes.indexOf("export async function responderConferencia"), acoes.indexOf("export interface ConferenciaView"));
  assert.match(trecho, /resposta:/);
});

test("laudo: o tamanho é conferido antes do envio (acima de 15 MB nem sobe)", () => {
  assert.equal(erroTamanhoLaudo(15 * 1024 * 1024), null);
  assert.equal(erroTamanhoLaudo(15 * 1024 * 1024 + 1), "O laudo deve ter até 15 MB.");
  assert.equal(erroTamanhoLaudo(0), "Arquivo vazio.");
});

test("mesclarLaudo: o laudo recém-anexado aparece na hora e o do servidor (com link) prevalece quando chega", () => {
  const local = { url: null, parte: "proprietario" as const, criadoEm: "2026-10-17T14:00:00Z" };
  const servidor = { url: "https://x/laudo.pdf", parte: "proprietario" as const, criadoEm: "2026-10-17T14:00:01Z" };
  assert.equal(mesclarLaudo(null, null), null);
  assert.deepEqual(mesclarLaudo(null, local), local);
  assert.deepEqual(mesclarLaudo(servidor, local), servidor);
});

test("ações: anexar laudo devolve o laudo para a tela mostrá-lo na hora (lab t85 teste 4)", () => {
  const acoes = readFileSync("src/lib/data/conferencia-actions.ts", "utf8");
  const trecho = acoes.slice(acoes.indexOf("export async function anexarLaudoConferencia"), acoes.indexOf("export async function conferenciasDoContrato"));
  assert.match(trecho, /return \{ ok: true, laudo:/);
});

test("migração 0168: itens congelam por parte e produção registra a migração (ordem 99c7c1e0)", () => {
  const sql = readFileSync("supabase/migrations/0168_conferencia_itens_por_parte.sql", "utf8");
  assert.match(sql, /create or replace function public\.conferencia_itens_trava/);
  assert.match(sql, /r\.parte = minha/);
  assert.match(sql, />= 2/);
  const aplicar = readFileSync("supabase/producao/aplicar-0168.sql", "utf8");
  assert.match(aplicar, /^begin;/m);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /0168_conferencia_itens_por_parte/);
  assert.match(aplicar, /where not exists/);
  assert.match(readFileSync("supabase/producao/rollback/0168_rollback.sql", "utf8"), /0168/);
  assert.doesNotMatch(sql, /vistoria/i);
});

test("ação: a parte que respondeu não registra mais itens; a resposta pede itens das duas partes e a janela", () => {
  const src = readFileSync("src/lib/data/conferencia-actions.ts", "utf8");
  assert.match(src, /podeEditarItens\(\(respostas \?\? \[\]\) as RespostaConferencia\[\], ctx\.parte\)/);
  assert.match(src, /itensPorParte/);
  assert.match(src, /janelaEncerrada\(input\.tipo, ctx\.inicio\)/);
});
