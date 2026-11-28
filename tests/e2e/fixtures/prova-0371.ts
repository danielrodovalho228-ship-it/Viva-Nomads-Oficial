import postgres from "postgres";
import { randomBytes, randomUUID } from "node:crypto";

/*
  E1248 / 0371 (ESPEC-E1248 v11, secções 3.6 e 9-A; ORDEM-DUET 1355, decisão 2; regra da casa: a trava que afirma
  comportamento é EXECUTADA num banco descartável) — a prova executada da 0371, no desenho das provas 0368 a 0370. Cria
  um BANCO descartável no servidor Postgres, monta lá `caucao_acertos` NA FORMA DE ANTES DA 0371 (a 0036: as colunas, o
  check dos quatro estados, o índice do contrato, a RLS e a política "acertos: partes") com dois acertos — um à espera
  e um contestado ANTES do E1248, sem motivo — e corre lá a 0371, o aplicar e o rollback de produção TAL COMO ESTÃO. No
  fim, o banco é apagado. Os três tempos:
   - APLICA: sem erro; as linhas que existiam ficam iguais; as 14 colunas novas nascem vazias, com o tipo certo; os dois
     índices da rotina de hora a hora existem; as regras mordem; a política e a RLS ficam como estavam;
   - REAPLICA: sem efeito (sem erro; o mesmo retrato das colunas, regras, índices e políticas; o registo uma vez);
   - ROLLBACK: com dados gravados nas colunas novas, FALHA sem mudar nada; limpo, repõe TUDO — colunas, regras, índices e
     políticas iguais às de antes — e tira o registo; depois, aplica de novo sem erro.
*/
const FORMA_DE_ANTES = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, name text);
  delete from supabase_migrations.schema_migrations;
  do $r$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  end $r$;
  create schema if not exists auth;
  drop table if exists public.caucao_acertos, public.chamados, public.contratos, auth.users cascade;
  create table auth.users (id uuid primary key default gen_random_uuid());
  create table public.contratos (id uuid primary key default gen_random_uuid());
  create table public.chamados (id uuid primary key default gen_random_uuid());
  create or replace function public.pode_ver_contrato(c_id uuid) returns boolean language sql stable as $f$ select true $f$;
  create table public.caucao_acertos (
    id uuid primary key default gen_random_uuid(),
    contrato_id uuid not null references public.contratos (id) on delete cascade,
    tipo text not null check (tipo in ('devolucao_integral','desconto')),
    caucao_total numeric(12,2) not null,
    valor_devolvido numeric(12,2),
    data_devolucao date,
    meio text,
    status text not null default 'aguardando_confirmacao'
      check (status in ('aguardando_confirmacao','devolvida_integral','desconto_confirmado','desconto_contestado')),
    registrado_por uuid not null references auth.users (id),
    confirmado_em timestamptz,
    created_at timestamptz not null default now()
  );
  create index caucao_acertos_contrato_idx on public.caucao_acertos (contrato_id);
  alter table public.caucao_acertos enable row level security;
  create policy "acertos: partes" on public.caucao_acertos for all to authenticated
    using (public.pode_ver_contrato(contrato_id)) with check (public.pode_ver_contrato(contrato_id));
`;

const VERSAO = "20261128000371";
export const COLUNAS_NOVAS = [
  "aviso_em", "lembrete_em", "confirmacao_via", "contestacao_motivo", "contestado_em", "chamado_id", "central_decisao",
  "central_decidido_em", "central_decidido_por", "central_motivo", "comprovante_path", "comprovante_pedido_em",
  "comprovante_anexado_em", "comprovante_lembrete_em",
] as const;

export type ProvaDa0371 = {
  aplica: { erroMigracao: string | null; erro: string | null; iguais: boolean; vazias: boolean; tipos: Record<string, string | null>; indices: string[]; politicasIguais: boolean; rls: boolean };
  reaplica: { erroMigracao: string | null; erro: string | null; mesmoRetrato: boolean; registos: number; nome: string | null };
  regras: { aceites: Record<string, string | null>; recusadas: Record<string, string | null> };
  rollbackComDados: { erro: string | null; colunas: number; registo: number; dadoFica: boolean };
  rollback: { erro: string | null; colunasIguais: boolean; regrasIguais: boolean; indicesIguais: boolean; politicasIguais: boolean; registo: number };
  aplicaDeNovo: { erro: string | null; colunas: number };
};

const noBanco = (url: string, banco: string): string => {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
};

/** Corre a 0371, o aplicar e o rollback (os arquivos de produção, sem mudar um carácter) num banco descartável. */
export async function provarA0371(urlDoServidor: string, migracao: string, aplicar: string, rollback: string): Promise<ProvaDa0371> {
  const banco = `prova_0371_${randomBytes(4).toString("hex")}`;
  const adm = postgres(urlDoServidor, { max: 1, onnotice: () => undefined });
  try {
    await adm.unsafe(`create database ${banco}`);
    const db = postgres(noBanco(urlDoServidor, banco), { max: 1, onnotice: () => undefined });
    try {
      return await osCasos(db, migracao, aplicar, rollback);
    } finally {
      await db.end();
    }
  } finally {
    await adm.unsafe(`drop database if exists ${banco} with (force)`).catch(() => undefined);
    await adm.end();
  }
}

const ids = { contrato: "11111111-1111-4111-8111-111111111111", dono: "22222222-2222-4222-8222-222222222222", espera: "33333333-3333-4333-8333-333333333333", antigo: "44444444-4444-4444-8444-444444444444" };

async function semear(db: postgres.Sql) {
  await db.unsafe(FORMA_DE_ANTES);
  await db.unsafe(`insert into auth.users (id) values ('${ids.dono}'); insert into public.contratos (id) values ('${ids.contrato}');`);
  // Um à espera e um CONTESTADO ANTES DO E1248, sem motivo: a regra do motivo é por hora, não por estado.
  await db.unsafe(`insert into public.caucao_acertos (id, contrato_id, tipo, caucao_total, valor_devolvido, data_devolucao, meio, status, registrado_por) values
    ('${ids.espera}', '${ids.contrato}', 'devolucao_integral', 3200, 3200, '2026-11-20', 'pix', 'aguardando_confirmacao', '${ids.dono}'),
    ('${ids.antigo}', '${ids.contrato}', 'desconto', 3200, 2000, '2026-11-10', 'pix', 'desconto_contestado', '${ids.dono}')`);
}
const retratoLinhas = async (db: postgres.Sql) =>
  JSON.stringify(await db`select id, contrato_id, tipo, caucao_total, valor_devolvido, data_devolucao, meio, status, registrado_por, confirmado_em, created_at from public.caucao_acertos order by id`);
const colunas = async (db: postgres.Sql) =>
  JSON.stringify(await db`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'caucao_acertos' order by column_name`);
const regras = async (db: postgres.Sql) =>
  JSON.stringify(await db`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.caucao_acertos'::regclass order by conname`);
const indices = async (db: postgres.Sql) => (await db<{ indexname: string; indexdef: string }[]>`select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'caucao_acertos' order by indexname`);
const politicas = async (db: postgres.Sql) =>
  JSON.stringify(await db`select policyname, permissive, roles, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'caucao_acertos' order by policyname`);
const quantasNovas = async (db: postgres.Sql) =>
  Number((await db`select count(*)::int as n from information_schema.columns where table_schema = 'public' and table_name = 'caucao_acertos' and column_name = any(${COLUNAS_NOVAS as unknown as string[]})`)[0].n);
const registos = async (db: postgres.Sql) => db<{ name: string }[]>`select name from supabase_migrations.schema_migrations where version = ${VERSAO}`;

async function osCasos(db: postgres.Sql, mig: string, apl: string, rb: string): Promise<ProvaDa0371> {
  const tentar = async (texto: string): Promise<string | null> => {
    try {
      await db.unsafe(texto);
      return null;
    } catch (e) {
      await db.unsafe("rollback").catch(() => undefined);
      return e instanceof Error ? e.message : String(e);
    }
  };

  // A migração crua, duas vezes (sobre a forma de antes).
  await semear(db);
  const erroMig1 = await tentar(mig);
  const erroMig2 = await tentar(mig);

  // O aplicar de produção, do zero.
  await semear(db);
  const linhasAntes = await retratoLinhas(db);
  const colunasAntes = await colunas(db);
  const regrasAntes = await regras(db);
  const indicesAntes = JSON.stringify(await indices(db));
  const politicasAntes = await politicas(db);
  const erro1 = await tentar(apl);
  const tiposR = await db<{ c: string; t: string }[]>`select column_name as c, data_type as t from information_schema.columns where table_schema = 'public' and table_name = 'caucao_acertos' and column_name = any(${COLUNAS_NOVAS as unknown as string[]})`;
  const tipos: Record<string, string | null> = Object.fromEntries(COLUNAS_NOVAS.map((c) => [c, tiposR.find((r) => r.c === c)?.t ?? null]));
  // Sem as colunas (a 0371 por aplicar), a contagem levanta erro: vazias fica false e o caso cai pela asserção.
  let vazias = false;
  try {
    const [r] = await db.unsafe(`select count(*)::int as n from public.caucao_acertos where ${COLUNAS_NOVAS.map((c) => `${c} is not null`).join(" or ")}`);
    vazias = Number(r.n) === 0;
  } catch {
    vazias = false;
  }
  const [rls] = await db`select relrowsecurity as r from pg_class where oid = 'public.caucao_acertos'::regclass`;
  const aplica = {
    erroMigracao: erroMig1,
    erro: erro1,
    iguais: (await retratoLinhas(db)) === linhasAntes,
    vazias,
    tipos,
    indices: (await indices(db)).map((i) => i.indexname).filter((n) => n !== "caucao_acertos_contrato_idx" && n !== "caucao_acertos_pkey"),
    politicasIguais: (await politicas(db)) === politicasAntes,
    rls: !!rls?.r,
  };
  const retratoDepois = JSON.stringify([await colunas(db), await regras(db), await indices(db), await politicas(db)]);
  const erro2 = await tentar(apl);
  const reg = await registos(db);
  const reaplica = { erroMigracao: erroMig2, erro: erro2, mesmoRetrato: JSON.stringify([await colunas(db), await regras(db), await indices(db), await politicas(db)]) === retratoDepois, registos: reg.length, nome: reg[0]?.name ?? null };

  // As regras (cada uma numa linha nova; o erro de cada uma, ou null).
  const nova = async (extra: Record<string, string>): Promise<string | null> => {
    const id = randomUUID();
    const cols = ["id", "contrato_id", "tipo", "caucao_total", "registrado_por", ...Object.keys(extra)];
    const vals = [`'${id}'`, `'${ids.contrato}'`, "'devolucao_integral'", "3200", `'${ids.dono}'`, ...Object.values(extra)];
    return tentar(`insert into public.caucao_acertos (${cols.join(", ")}) values (${vals.join(", ")})`);
  };
  const regrasR = {
    aceites: {
      "o aviso e o lembrete": await nova({ aviso_em: "now()", lembrete_em: "now()" }),
      "confirmada pelo morador": await nova({ status: "'devolvida_integral'", confirmacao_via: "'morador'", confirmado_em: "now()" }),
      "por falta de resposta": await nova({ status: "'devolvida_integral'", confirmacao_via: "'falta_de_resposta'", confirmado_em: "now()" }),
      "contestada com motivo": await nova({ status: "'desconto_contestado'", contestado_em: "now()", contestacao_motivo: "'Não recebi o valor.'" }),
      "a Central confirma": await nova({ status: "'devolvida_integral'", confirmacao_via: "'central'", central_decisao: "'confirmada'", central_decidido_em: "now()", central_decidido_por: `'${ids.dono}'` }),
      "a Central não confirma, com motivo": await nova({ status: "'desconto_contestado'", contestado_em: "now()", contestacao_motivo: "'Não recebi.'", central_decisao: "'nao_confirmada'", central_decidido_em: "now()", central_motivo: "'Sem comprovante no prazo.'" }),
      "o comprovante": await nova({ comprovante_path: `'${ids.dono}/7c9e6679-7425-40de-944b-e07fc1f90ae7.pdf'`, comprovante_pedido_em: "now()", comprovante_anexado_em: "now()", comprovante_lembrete_em: "now()" }),
    },
    recusadas: {
      "confirmacao_via fora da lista": await nova({ confirmacao_via: "'silencio'" }),
      "central_decisao fora da lista": await nova({ central_decisao: "'talvez'", central_decidido_em: "now()" }),
      "a decisão sem a hora": await nova({ central_decisao: "'confirmada'" }),
      "a hora sem a decisão": await nova({ central_decidido_em: "now()" }),
      "não confirmada sem motivo": await nova({ central_decisao: "'nao_confirmada'", central_decidido_em: "now()" }),
      "não confirmada com motivo curto": await nova({ central_decisao: "'nao_confirmada'", central_decidido_em: "now()", central_motivo: "'abc'" }),
      "contestação com hora e sem motivo": await nova({ contestado_em: "now()" }),
      "motivo do morador curto": await nova({ contestado_em: "now()", contestacao_motivo: "'abc'" }),
      "motivo do morador longo": await nova({ contestado_em: "now()", contestacao_motivo: `'${"x".repeat(501)}'` }),
      "caminho fora do formato": await nova({ comprovante_path: "'../segredo.txt'" }),
      "chamado inexistente": await nova({ chamado_id: "'99999999-9999-4999-8999-999999999999'" }),
    },
  };

  // Rollback com dados nas colunas novas: falha, nada muda.
  const antesRb = JSON.stringify([await colunas(db), await regras(db), await indices(db), await politicas(db)]);
  await tentar(`update public.caucao_acertos set aviso_em = now() where id = '${ids.espera}'`);
  const erroRbDados = await tentar(rb);
  // Sem a coluna, a leitura levanta erro: o dado não "fica" e o caso cai pela asserção.
  const dado = await db`select aviso_em from public.caucao_acertos where id = ${ids.espera}`.then((r) => r[0], () => null);
  const rollbackComDados = {
    erro: erroRbDados,
    colunas: await quantasNovas(db),
    registo: (await registos(db)).length,
    dadoFica: !!dado?.aviso_em && JSON.stringify([await colunas(db), await regras(db), await indices(db), await politicas(db)]) === antesRb,
  };

  // Rollback limpo: tira os dados das colunas novas (as linhas do teste) e repõe a forma de antes.
  await tentar(`delete from public.caucao_acertos where id not in ('${ids.espera}', '${ids.antigo}')`);
  await tentar(`update public.caucao_acertos set aviso_em = null`);
  const erroRb = await tentar(rb);
  const rollback = {
    erro: erroRb,
    colunasIguais: (await colunas(db)) === colunasAntes,
    regrasIguais: (await regras(db)) === regrasAntes,
    indicesIguais: JSON.stringify(await indices(db)) === indicesAntes,
    politicasIguais: (await politicas(db)) === politicasAntes,
    registo: (await registos(db)).length,
  };

  const erroDeNovo = await tentar(apl);
  const aplicaDeNovo = { erro: erroDeNovo, colunas: await quantasNovas(db) };

  return { aplica, reaplica, regras: regrasR, rollbackComDados, rollback, aplicaDeNovo };
}
