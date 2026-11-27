import postgres from "postgres";
import { randomBytes } from "node:crypto";

/*
  E1238 / 0369 (ORDENS-DUET 1231 e 1233; regra da casa: a trava que afirma comportamento é EXECUTADA num banco
  descartável) — a prova executada da 0369, no desenho das provas 0367/0368. Cria um BANCO descartável no servidor
  Postgres, monta lá `conferencias` NA FORMA DE ANTES DA 0369 (0110 + 0201: sem prazo) com uma conferência aberta e
  uma fechada, e corre lá a 0369, o aplicar e o rollback de produção TAL COMO ESTÃO. No fim, o banco é apagado.
  Os casos:
   - aplica sem erro; as conferências que já existiam ficam iguais e com o prazo vazio;
   - reaplica sem efeito (sem erro); o aplicar regista-se uma vez;
   - uma conferência nova nasce com o prazo gravado;
   - O CONGELAMENTO: a segunda "abertura" (o upsert com ignoreDuplicates das quatro ações = on conflict do nothing)
     com outro prazo NÃO muda o prazo gravado;
   - rollback → sai a coluna e o registo; as conferências ficam.
*/
const FORMA_DE_ANTES = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, name text);
  delete from supabase_migrations.schema_migrations;
  drop table if exists public.conferencias, public.contratos;
  create table public.contratos (id uuid primary key default gen_random_uuid());
  create table public.conferencias (
    id uuid primary key default gen_random_uuid(),
    contrato_id uuid not null references public.contratos (id) on delete cascade,
    tipo text not null check (tipo in ('entrada', 'saida')),
    aberta_por uuid,
    criada_em timestamptz not null default now(),
    fechada_em timestamptz,
    hash_fechamento text,
    motivo_fechamento text,
    nao_responderam text[],
    unique (contrato_id, tipo)
  );
`;

export type ProvaDa0369 = {
  migracao: { erro: string | null; linhas: number; iguais: boolean; prazosVazios: boolean };
  reaplicar: { erro: string | null };
  aplicar: { erro1: string | null; erro2: string | null; registos: number; nome: string | null };
  nova: { erro: string | null; prazo: string | null };
  congelado: { erro: string | null; prazo: string | null };
  rollback: { erroMigracao: string | null; erroRollback: string | null; coluna: boolean; registo: number; linhas: number };
};

const noBanco = (url: string, banco: string): string => {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
};
const erroDe = async (f: () => Promise<unknown>): Promise<string | null> => {
  try {
    await f();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
};

/** Corre a 0369, o aplicar e o rollback (os arquivos de produção, sem mudar um carácter) num banco descartável. */
export async function provarA0369(urlDoServidor: string, migracao: string, aplicar: string, rollback: string): Promise<ProvaDa0369> {
  const banco = `prova_0369_${randomBytes(4).toString("hex")}`;
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

const PRAZO_1 = "2026-12-03T17:00:00.000Z";
const PRAZO_2 = "2026-12-04T03:00:00.000Z";

async function semear(db: postgres.Sql): Promise<string> {
  await db.unsafe(FORMA_DE_ANTES);
  const [c] = await db<{ id: string }[]>`insert into public.contratos default values returning id`;
  await db`insert into public.conferencias (contrato_id, tipo) values (${c.id}, 'entrada')`;
  await db`insert into public.conferencias (contrato_id, tipo, fechada_em, hash_fechamento, motivo_fechamento) values (${c.id}, 'saida', now(), 'abc', 'janela_encerrada')`;
  return c.id;
}
const retrato = async (db: postgres.Sql) => JSON.stringify(await db`select id, contrato_id, tipo, criada_em, fechada_em, hash_fechamento, motivo_fechamento from public.conferencias order by tipo`);
const temColuna = async (db: postgres.Sql) =>
  (await db`select 1 from information_schema.columns where table_schema = 'public' and table_name = 'conferencias' and column_name = 'prazo_em'`).length > 0;

async function osCasos(db: postgres.Sql, mig: string, apl: string, rb: string): Promise<ProvaDa0369> {
  // A migração crua.
  await semear(db);
  const antes = await retrato(db);
  const erroMig = await erroDe(() => db.unsafe(mig));
  const linhas = Number((await db`select count(*)::int as n from public.conferencias`)[0].n);
  const prazosVazios = (await db`select count(*)::int as n from public.conferencias where prazo_em is not null`)[0].n === 0;
  const migracao = { erro: erroMig, linhas, iguais: (await retrato(db)) === antes, prazosVazios };
  const reaplicar = { erro: await erroDe(() => db.unsafe(mig)) };

  // O aplicar de produção, do zero, duas vezes.
  const contrato = await semear(db);
  const erro1 = await erroDe(() => db.unsafe(apl));
  const erro2 = await erroDe(() => db.unsafe(apl));
  const reg = await db<{ name: string }[]>`select name from supabase_migrations.schema_migrations where version = '20261127000369'`;
  const aplicar = { erro1, erro2, registos: reg.length, nome: reg[0]?.name ?? null };

  // Uma conferência nova nasce com o prazo; a segunda abertura (on conflict do nothing) não o muda.
  const [c2] = await db<{ id: string }[]>`insert into public.contratos default values returning id`;
  let erroNova: string | null = null;
  try {
    await db`insert into public.conferencias (contrato_id, tipo, prazo_em) values (${c2.id}, 'entrada', ${PRAZO_1}) on conflict (contrato_id, tipo) do nothing`;
  } catch (e) {
    erroNova = e instanceof Error ? e.message : String(e);
  }
  const prazoDe = async () => {
    const r = await db<{ p: Date | null }[]>`select prazo_em as p from public.conferencias where contrato_id = ${c2.id} and tipo = 'entrada'`;
    return r[0]?.p ? new Date(r[0].p).toISOString() : null;
  };
  const nova = { erro: erroNova, prazo: await prazoDe() };
  const erroCong = await erroDe(() => db`insert into public.conferencias (contrato_id, tipo, prazo_em) values (${c2.id}, 'entrada', ${PRAZO_2}) on conflict (contrato_id, tipo) do nothing`);
  const congelado = { erro: erroCong, prazo: await prazoDe() };

  // Rollback: sai a coluna e o registo; as conferências ficam.
  const n0 = Number((await db`select count(*)::int as n from public.conferencias`)[0].n);
  const erroRollback = await erroDe(() => db.unsafe(rb));
  const rollback = {
    erroMigracao: null,
    erroRollback,
    coluna: await temColuna(db),
    registo: (await db`select 1 from supabase_migrations.schema_migrations where version = '20261127000369'`).length,
    linhas: Number((await db`select count(*)::int as n from public.conferencias`)[0].n) - n0,
  };
  void contrato;
  return { migracao, reaplicar, aplicar, nova, congelado, rollback };
}

export const PRAZOS_DA_PROVA = { PRAZO_1, PRAZO_2 };
