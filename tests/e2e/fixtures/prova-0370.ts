import postgres from "postgres";
import { randomBytes } from "node:crypto";

/*
  E1240 / 0370 (ESPEC-E1240 v5, secção 5.1; ORDEM-DUET 1324; regra da casa: a trava que afirma comportamento é
  EXECUTADA num banco descartável) — a prova executada da 0370, no desenho da prova 0369. Cria um BANCO descartável no
  servidor Postgres, monta lá `contratos_checkin` NA FORMA DE ANTES DA 0370 (a 0127: a hora de entrada, as instruções,
  o plantão e os lembretes; RLS ligada, sem permissão para anon/authenticated) com uma linha, e corre lá a 0370, o
  aplicar e o rollback de produção TAL COMO ESTÃO. No fim, o banco é apagado. Os casos (os números da ESPEC):
   1. aplica sem erro; a linha que existia fica igual, com a coluna nova vazia e sem valor por omissão;
   2. reaplica sem efeito; o registo fica uma vez;
   3. a regra morde: "11:00" entra; "25:00", "11h" e "11:00:00" são recusados; vazio (nulo) entra;
   4. a hora de entrada não mexe: a coluna e a regra antigas ficam como estavam;
   5. o acesso não abriu: uma pessoa autenticada continua sem ler a tabela, coluna nova incluída;
   6. rollback, sem nenhuma hora gravada: saem a coluna, a regra e o registo; a tabela volta à forma de antes;
   7. rollback com uma hora gravada: FALHA sem mudar nada — a coluna, a regra, o registo e a hora ficam;
   8. aplica de novo depois do rollback: sem erro;
   9. gravar a linha SEM a coluna nova (o envio de uma página antiga): a hora de saída gravada FICA;
  10. gravar a linha com a coluna vazia: a hora de saída é apagada.
*/
const FORMA_DE_ANTES = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, name text);
  delete from supabase_migrations.schema_migrations;
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  end $$;
  drop table if exists public.contratos_checkin, public.contratos;
  create table public.contratos (id uuid primary key default gen_random_uuid());
  create table public.contratos_checkin (
    contrato_id uuid primary key references public.contratos(id) on delete cascade,
    horario text check (horario is null or horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
    instrucoes text check (instrucoes is null or char_length(instrucoes) <= 600),
    plantao text check (plantao is null or plantao ~ '^[0-9]{10,13}$'),
    atualizado_em timestamptz,
    lembrete_48h_em timestamptz,
    lembrete_24h_em timestamptz
  );
  alter table public.contratos_checkin enable row level security;
  revoke all on public.contratos_checkin from anon, authenticated;
`;

const VERSAO = "20261128000370";
const REGRA = "contratos_checkin_horario_saida_fmt";

export type ProvaDa0370 = {
  aplica: { erroMigracao: string | null; erro: string | null; iguais: boolean; vazia: boolean; padrao: string | null; tipo: string | null };
  reaplica: { erroMigracao: string | null; erro: string | null; registos: number; nome: string | null };
  regra: { aceites: Record<string, string | null>; recusadas: Record<string, string | null> };
  entrada: { colunaIgual: boolean; regraIgual: boolean };
  acesso: { tabela: boolean; coluna: boolean | null; rls: boolean };
  rollbackComHora: { erro: string | null; coluna: boolean; regra: boolean; registo: number; hora: string | null };
  rollbackSemHora: { erro: string | null; coluna: boolean; regra: boolean; registo: number; formaDeAntes: boolean };
  aplicaDeNovo: { erro: string | null; coluna: boolean };
  semAColuna: { erro: string | null; hora: string | null };
  comAColunaVazia: { erro: string | null; hora: string | null };
};

const noBanco = (url: string, banco: string): string => {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
};

/** Corre a 0370, o aplicar e o rollback (os arquivos de produção, sem mudar um carácter) num banco descartável. */
export async function provarA0370(urlDoServidor: string, migracao: string, aplicar: string, rollback: string): Promise<ProvaDa0370> {
  const banco = `prova_0370_${randomBytes(4).toString("hex")}`;
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

async function semear(db: postgres.Sql): Promise<string> {
  await db.unsafe(FORMA_DE_ANTES);
  const [c] = await db<{ id: string }[]>`insert into public.contratos default values returning id`;
  await db`insert into public.contratos_checkin (contrato_id, horario, instrucoes, plantao, atualizado_em) values (${c.id}, '14:00', 'Chave na portaria.', '11987654321', now())`;
  return c.id;
}
const retrato = async (db: postgres.Sql) =>
  JSON.stringify(await db`select contrato_id, horario, instrucoes, plantao, atualizado_em, lembrete_48h_em, lembrete_24h_em from public.contratos_checkin order by contrato_id`);
const colunas = async (db: postgres.Sql) =>
  JSON.stringify(
    await db`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'contratos_checkin' order by column_name`,
  );
const colunaDaSaida = async (db: postgres.Sql) => {
  const r = await db<{ t: string; d: string | null }[]>`select data_type as t, column_default as d from information_schema.columns where table_schema = 'public' and table_name = 'contratos_checkin' and column_name = 'horario_saida'`;
  return { existe: r.length > 0, tipo: r[0]?.t ?? null, padrao: r[0]?.d ?? null };
};
const temRegra = async (db: postgres.Sql) => (await db`select 1 from pg_constraint where conname = ${REGRA}`).length > 0;
const registos = async (db: postgres.Sql) => db<{ name: string }[]>`select name from supabase_migrations.schema_migrations where version = ${VERSAO}`;
/** A coluna e a regra da hora de ENTRADA (a 0127), para ver que a 0370 não lhes toca. */
const daEntrada = async (db: postgres.Sql) =>
  JSON.stringify({
    coluna: await db`select data_type, is_nullable, column_default from information_schema.columns where table_schema = 'public' and table_name = 'contratos_checkin' and column_name = 'horario'`,
    regra: await db`select conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'public.contratos_checkin'::regclass and pg_get_constraintdef(oid) like '%horario ~%' and pg_get_constraintdef(oid) not like '%horario_saida%' order by conname`,
  });

async function osCasos(db: postgres.Sql, mig: string, apl: string, rb: string): Promise<ProvaDa0370> {
  // Um erro dentro do begin/commit deixa a ligação numa transacção abortada; desfaz-se aqui e o erro volta nomeado,
  // para o caso cair pela asserção e não por um erro da fixture (como nas provas 0368 e 0369).
  const tentar = async (texto: string): Promise<string | null> => {
    try {
      await db.unsafe(texto);
      return null;
    } catch (e) {
      await db.unsafe("rollback").catch(() => undefined);
      return e instanceof Error ? e.message : String(e);
    }
  };
  // Sem a coluna (a 0370 por aplicar, ou depois do rollback), a leitura volta como erro nomeado, não como null.
  const horaDe = async (id: string): Promise<string | null> => {
    try {
      return (await db<{ h: string | null }[]>`select horario_saida as h from public.contratos_checkin where contrato_id = ${id}`)[0]?.h ?? null;
    } catch (e) {
      return `erro: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  // A migração crua, duas vezes.
  await semear(db);
  const erroMig1 = await tentar(mig);
  const erroMig2 = await tentar(mig);

  // 1 e 2: o aplicar de produção, do zero, duas vezes.
  const contrato = await semear(db);
  const antes = await retrato(db);
  const colunasDeAntes = await colunas(db);
  const entradaDeAntes = await daEntrada(db);
  const erro1 = await tentar(apl);
  const saida = await colunaDaSaida(db);
  const aplica = { erroMigracao: erroMig1, erro: erro1, iguais: (await retrato(db)) === antes, vazia: (await horaDe(contrato)) === null, padrao: saida.padrao, tipo: saida.tipo };
  const erro2 = await tentar(apl);
  const reg = await registos(db);
  const reaplica = { erroMigracao: erroMig2, erro: erro2, registos: reg.length, nome: reg[0]?.name ?? null };

  // 3: a regra morde (cada valor numa linha nova; o erro de cada um, ou null).
  const gravar = async (valor: string | null): Promise<string | null> => {
    const [c] = await db<{ id: string }[]>`insert into public.contratos default values returning id`;
    return tentar(`insert into public.contratos_checkin (contrato_id, horario_saida) values ('${c.id}', ${valor === null ? "null" : `'${valor}'`})`);
  };
  const regra = {
    aceites: { "11:00": await gravar("11:00"), vazio: await gravar(null) },
    recusadas: { "25:00": await gravar("25:00"), "11h": await gravar("11h"), "11:00:00": await gravar("11:00:00") },
  };

  // 4: a hora de entrada não mexe.
  const entradaDepois = JSON.parse(await daEntrada(db));
  const entradaAntes = JSON.parse(entradaDeAntes);
  const entrada = { colunaIgual: JSON.stringify(entradaDepois.coluna) === JSON.stringify(entradaAntes.coluna), regraIgual: JSON.stringify(entradaDepois.regra) === JSON.stringify(entradaAntes.regra) };

  // 5: o acesso não abriu.
  const [acc] = await db<{ t: boolean; r: boolean }[]>`
    select has_table_privilege('authenticated', 'public.contratos_checkin', 'select') as t,
           (select relrowsecurity from pg_class where oid = 'public.contratos_checkin'::regclass) as r`;
  // Sem a coluna, has_column_privilege levanta erro: fica null (e o caso cai pela asserção).
  const coluna = await db<{ c: boolean }[]>`select has_column_privilege('authenticated', 'public.contratos_checkin', 'horario_saida', 'select') as c`.then((r) => r[0].c, () => null);
  const acesso = { tabela: acc.t, coluna, rls: acc.r };

  // 9 e 10: o envio de uma página antiga (sem a coluna) não toca na hora; com a coluna vazia, apaga-a.
  await tentar(`update public.contratos_checkin set horario_saida = '11:00' where contrato_id = '${contrato}'`);
  const erroSem = await tentar(
    `insert into public.contratos_checkin (contrato_id, horario, instrucoes, plantao, atualizado_em) values ('${contrato}', '15:00', 'Chave com o porteiro.', '11987654321', now())
     on conflict (contrato_id) do update set horario = excluded.horario, instrucoes = excluded.instrucoes, plantao = excluded.plantao, atualizado_em = excluded.atualizado_em`,
  );
  const semAColuna = { erro: erroSem, hora: await horaDe(contrato) };

  // 7: o rollback com uma hora gravada falha sem mudar nada (a hora 11:00 do caso 9 continua lá).
  const erroRbComHora = await tentar(rb);
  const rollbackComHora = { erro: erroRbComHora, coluna: (await colunaDaSaida(db)).existe, regra: await temRegra(db), registo: (await registos(db)).length, hora: await horaDe(contrato) };

  const erroVazia = await tentar(
    `insert into public.contratos_checkin (contrato_id, horario, instrucoes, plantao, atualizado_em, horario_saida) values ('${contrato}', '15:00', 'Chave com o porteiro.', '11987654321', now(), null)
     on conflict (contrato_id) do update set horario = excluded.horario, instrucoes = excluded.instrucoes, plantao = excluded.plantao, atualizado_em = excluded.atualizado_em, horario_saida = excluded.horario_saida`,
  );
  const comAColunaVazia = { erro: erroVazia, hora: await horaDe(contrato) };

  // 6: sem nenhuma hora gravada, o rollback tira tudo e a tabela volta à forma de antes.
  await tentar("update public.contratos_checkin set horario_saida = null");
  const erroRb = await tentar(rb);
  const rollbackSemHora = { erro: erroRb, coluna: (await colunaDaSaida(db)).existe, regra: await temRegra(db), registo: (await registos(db)).length, formaDeAntes: (await colunas(db)) === colunasDeAntes };

  // 8: aplica de novo depois do rollback.
  const erroDeNovo = await tentar(apl);
  const aplicaDeNovo = { erro: erroDeNovo, coluna: (await colunaDaSaida(db)).existe };

  return { aplica, reaplica, regra, entrada, acesso, rollbackComHora, rollbackSemHora, aplicaDeNovo, semAColuna, comAColunaVazia };
}
