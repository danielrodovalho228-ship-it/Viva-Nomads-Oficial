/*
  PERFIL-B — dados das telas do perfil (mockups perfil-02-avaliacoes e perfil-07-pagamentos): chave Pix de recebimento
  (0236) e avaliações recebidas.
  Roda: node --test src/lib/conta/perfil-b.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mascararChavePix, normalizarChavePix, rotuloTipoChavePix } from "./chave-pix.ts";
import { filtrarAvaliacoes, linhaContextoAvaliacao, resumoAvaliacoes, type AvaliacaoRecebida } from "./avaliacoes-recebidas.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("Pix: CPF e CNPJ com dígito verificador, gravados só com dígitos", () => {
  assert.deepEqual(normalizarChavePix("cpf", "529.982.247-25"), { ok: true, chave: { tipo: "cpf", chave: "52998224725" } });
  assert.equal(normalizarChavePix("cpf", "111.111.111-11").ok, false);
  assert.equal(normalizarChavePix("cpf", "529.982.247-24").ok, false);
  assert.deepEqual(normalizarChavePix("cnpj", "11.222.333/0001-81"), { ok: true, chave: { tipo: "cnpj", chave: "11222333000181" } });
  assert.equal(normalizarChavePix("cnpj", "11.222.333/0001-82").ok, false);
});

test("Pix: e-mail minúsculo, celular +55 com DDD e 9, chave aleatória", () => {
  assert.deepEqual(normalizarChavePix("email", " Ana.Ribeiro@Email.com "), { ok: true, chave: { tipo: "email", chave: "ana.ribeiro@email.com" } });
  assert.equal(normalizarChavePix("email", "ana@").ok, false);
  assert.deepEqual(normalizarChavePix("telefone", "(34) 99876-5432"), { ok: true, chave: { tipo: "telefone", chave: "+5534998765432" } });
  assert.deepEqual(normalizarChavePix("telefone", "+55 34 99876-5432"), { ok: true, chave: { tipo: "telefone", chave: "+5534998765432" } });
  assert.equal(normalizarChavePix("telefone", "(34) 3876-5432").ok, false, "fixo não é chave de celular");
  assert.deepEqual(normalizarChavePix("aleatoria", "123E4567-E89B-12D3-A456-426614174000"), {
    ok: true,
    chave: { tipo: "aleatoria", chave: "123e4567-e89b-12d3-a456-426614174000" },
  });
  assert.equal(normalizarChavePix("aleatoria", "123e4567e89b12d3a456426614174000").ok, false);
});

test("Pix: tipo desconhecido e vazio dizem o que falta", () => {
  assert.deepEqual(normalizarChavePix("boleto", "x"), { ok: false, erro: "Escolha o tipo da chave." });
  assert.deepEqual(normalizarChavePix("cpf", "  "), { ok: false, erro: "Informe a chave Pix." });
});

test("Pix: a tela mostra a chave mascarada (nunca inteira)", () => {
  assert.equal(mascararChavePix({ tipo: "cpf", chave: "52998224725" }), "***.982.247-**");
  assert.equal(mascararChavePix({ tipo: "cnpj", chave: "11222333000181" }), "**.222.333/0001-**");
  assert.equal(mascararChavePix({ tipo: "email", chave: "ana.ribeiro@email.com" }), "a***@email.com");
  assert.equal(mascararChavePix({ tipo: "telefone", chave: "+5534998765432" }), "(34) *****-5432");
  assert.equal(mascararChavePix({ tipo: "aleatoria", chave: "123e4567-e89b-12d3-a456-426614174000" }), "123e…4000");
  assert.equal(rotuloTipoChavePix("telefone"), "Celular");
});

test("0236: tabela só do dono (RLS nas 4 operações, anon sem acesso); aplicar e rollback se registram", () => {
  const sql = ler("supabase/migrations/0236_recebimento_pix.sql");
  assert.match(sql, /enable row level security/);
  assert.match(sql, /revoke all on public\.recebimento_pix from anon/);
  for (const op of ["select", "insert", "update", "delete"]) assert.match(sql, new RegExp(`for ${op} to authenticated`));
  assert.equal((sql.match(/user_id = auth\.uid\(\)/g) ?? []).length, 5);
  assert.match(sql, /check \(tipo in \('cpf', 'cnpj', 'email', 'telefone', 'aleatoria'\)\)/);
  const aplicar = ler("supabase/producao/aplicar-0236.sql");
  assert.match(aplicar, /^-- .*\nbegin;/);
  assert.match(aplicar, /commit;\s*$/);
  assert.match(aplicar, /'20261024000236', '0236_recebimento_pix'/);
  assert.ok(aplicar.includes(sql.slice(sql.indexOf("create table"), sql.indexOf("comment on")).trim()));
  assert.match(ler("supabase/producao/rollback/0236_rollback.sql"), /version = '20261024000236'/);
});

test("ações do Pix: validam no servidor e gravam pela SESSÃO (sem chave de serviço)", () => {
  const acoes = ler("src/lib/data/recebimento-actions.ts");
  assert.match(acoes, /^"use server";/);
  assert.match(acoes, /normalizarChavePix\(tipo, chave\)/);
  assert.doesNotMatch(acoes, /createAdminClient/);
  assert.match(acoes, /onConflict: "user_id"/);
});

const av = (p: Partial<AvaliacaoRecebida>): AvaliacaoRecebida => ({
  id: p.id ?? "a",
  autorNome: "Carlos M.",
  autorFotoUrl: null,
  papelAutor: "inquilino",
  nota: 5,
  comentario: "Estadia tranquila, comunicação ótima.",
  publicadaEm: "2026-10-12T12:00:00Z",
  imovelTitulo: "Casa no Santa Mônica",
  cidade: "Uberlândia",
  resposta: null,
  ...p,
});

test("avaliações: abas Todas / Recentes (90 dias) / Positivas (nota ≥ 4), da mais nova para a mais antiga", () => {
  const agora = Date.parse("2026-10-24T12:00:00Z");
  const lista = [
    av({ id: "velha", publicadaEm: "2026-01-10T12:00:00Z", nota: 5 }),
    av({ id: "nova-3", publicadaEm: "2026-10-20T12:00:00Z", nota: 3 }),
    av({ id: "nova-5", publicadaEm: "2026-10-12T12:00:00Z", nota: 5 }),
  ];
  assert.deepEqual(filtrarAvaliacoes(lista, { aba: "todas", agora }).map((a) => a.id), ["nova-3", "nova-5", "velha"]);
  assert.deepEqual(filtrarAvaliacoes(lista, { aba: "recentes", agora }).map((a) => a.id), ["nova-3", "nova-5"]);
  assert.deepEqual(filtrarAvaliacoes(lista, { aba: "positivas", agora }).map((a) => a.id), ["nova-5", "velha"]);
});

test("avaliações: a busca ignora acento e caixa e olha comentário, autor, imóvel e cidade", () => {
  const lista = [av({ id: "1" }), av({ id: "2", comentario: "Cuidou muito bem do imóvel.", autorNome: "Fernanda L.", cidade: "Goiânia" })];
  assert.deepEqual(filtrarAvaliacoes(lista, { aba: "todas", busca: "COMUNICACAO" }).map((a) => a.id), ["1"]);
  assert.deepEqual(filtrarAvaliacoes(lista, { aba: "todas", busca: "fernanda" }).map((a) => a.id), ["2"]);
  assert.deepEqual(filtrarAvaliacoes(lista, { aba: "todas", busca: "goiania" }).map((a) => a.id), ["2"]);
  assert.deepEqual(filtrarAvaliacoes(lista, { aba: "todas", busca: "nada disso" }), []);
});

test("avaliações: linha de contexto e resumo", () => {
  assert.equal(linhaContextoAvaliacao(av({})), "Recebida em 12 out 2026 · Casa no Santa Mônica · Uberlândia");
  assert.equal(linhaContextoAvaliacao(av({ imovelTitulo: null, cidade: null })), "Recebida em 12 out 2026");
  assert.equal(linhaContextoAvaliacao(av({ publicadaEm: null, imovelTitulo: null, cidade: null })), "");
  assert.deepEqual(resumoAvaliacoes([av({ nota: 5 }), av({ nota: 4, resposta: "Obrigado" })]), { media: 4.5, n: 2, semResposta: 1 });
  assert.deepEqual(resumoAvaliacoes([]), { media: 0, n: 0, semResposta: 0 });
});

test("avaliações: a leitura usa a sessão para as avaliações e só o nome curto de quem avaliou", () => {
  const dados = ler("src/lib/data/avaliacoes-recebidas.ts");
  assert.match(dados, /supabase\s*\.from\("avaliacoes"\)[\s\S]*?\.eq\("alvo_id", user\.id\)[\s\S]*?\.eq\("status", "publicada"\)/);
  assert.match(dados, /nomeCurto\(/);
  assert.match(dados, /signAvatarPath\(/);
  const pagina = ler("src/app/(dashboard)/dashboard/avaliacoes/page.tsx");
  assert.match(pagina, /avaliacoesRecebidas\(\)/);
  for (const t of ["avaliacao-autor", "avaliacao-contexto", "avaliacoes-aba-", "avaliacoes-busca"]) assert.ok(pagina.includes(t), t);
});

test("spec do PERFIL-B aponta as telas e as divergências", () => {
  const spec = ler("docs/specs/perfil-dados.md");
  for (const t of ["perfil-02-avaliacoes", "perfil-07-pagamentos", "0236", "Cartão", "anfitriões"]) assert.ok(spec.includes(t), t);
});
