import postgres from "postgres";
import { randomBytes } from "node:crypto";

/*
  E1223 / 0366 (ORDENS-DUET 1075, 1078, 1081 e 1090; regra da casa: a trava que afirma comportamento é EXECUTADA num
  banco descartável) — a prova executada da 0366 nos seis casos, no desenho da prova-0348.
  ORDEM-DUET-1090 (o Mq da Pista 3): sem reescrita de texto nenhuma. A prova cria um BANCO descartável no mesmo servidor
  Postgres do laboratório (`create database`), monta lá, no esquema `public` desse banco e com os nomes de verdade, as
  tabelas que a 0366 lê e escreve, e corre lá os arquivos da 0366 e do rollback de produção TAL COMO ESTÃO — o rollback
  inteiro, com o begin/commit e o apagar do registo em supabase_migrations. No fim, o banco é apagado. As tabelas
  verdadeiras do laboratório ficam noutro banco: nenhuma escrita, citada ou não, lhes chega.
  As tabelas têm a forma das migrações: avaliadores_contador e avaliadores_credenciamento (0215 + 0220 + 0335 + 0355:
  as mesmas colunas, checks e chaves únicas, a do número incluída), avaliadores_perfil_publico (0349). As chaves
  estrangeiras para parceiros, contas e solicitações ficam de fora (essas tabelas não existem aqui, e a 0366 não lhes
  toca), e vistoria_pedidos é mínimo: a 0366 só conta os pedidos por avaliador_id.
  Cada caso tem o seu universo, com o contador UDI em 4.
   - caso 1: aplica e troca — UBE-002 em_teste, sem pedidos → UDI-005; o contador vai a 5; SÓ o número muda (o status, a
     cidade e o resto da linha ficam);
   - caso 2: reaplica sem efeito — a 0366 outra vez não muda nada (nem o contador);
   - caso 3: com 1 pedido de vistoria, não toca (nem o contador);
   - caso 4: com o número de destino já usado (por outro credenciamento), não toca (nem o contador);
   - caso 5: o rollback desfaz — volta UBE-002, e as outras linhas ficam;
   - caso 6: com o status já não em_teste, não toca.
*/

/** As tabelas da 0366, como estão antes dela, e o registo das migrações. */
const FORMA_DE_ANTES = `
  do $r$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $r$;
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, name text);
  drop table if exists public.avaliadores_numero_trocas, public.vistoria_pedidos, public.avaliadores_perfil_publico, public.avaliadores_credenciamento, public.avaliadores_contador;
  create table public.avaliadores_contador (sigla text primary key check (sigla ~ '^[A-Z]{3}$'), ultimo integer not null default 0);
  create table public.avaliadores_credenciamento (
    id uuid primary key default gen_random_uuid(),
    parceiro_id uuid unique,
    cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
    numero_credenciado text not null unique check (numero_credenciado ~ '^[A-Z]{3}-[0-9]{3,}$'),
    status text not null default 'solicitado' check (status in ('solicitado', 'em_teste', 'ativo', 'suspenso', 'descredenciado')),
    motivo text check (motivo is null or char_length(motivo) <= 500),
    decidido_por uuid,
    decidido_em timestamptz,
    experiencia_path text,
    experiencia_link text check (experiencia_link is null or experiencia_link ~ '^https://'),
    conduta_versao text not null,
    conduta_aceita_em timestamptz not null default now(),
    relacoes_donos uuid[] not null default '{}',
    relacoes_imoveis uuid[] not null default '{}',
    relacoes_descricao text check (relacoes_descricao is null or char_length(relacoes_descricao) <= 1000),
    ultima_designacao_em timestamptz,
    ativado_em timestamptz,
    criado_em timestamptz not null default now(),
    user_id uuid,
    solicitacao_id uuid,
    decidido_pelo_sistema boolean not null default false,
    criterios_decisao jsonb,
    sobre text,
    constraint avaliadores_experiencia check (experiencia_path is not null or experiencia_link is not null),
    constraint avaliadores_credenciamento_dono check (parceiro_id is not null or (user_id is not null and solicitacao_id is not null))
  );
  create index avaliadores_credenciamento_cidade on public.avaliadores_credenciamento (cidade, status);
  create unique index avaliadores_credenciamento_usuario on public.avaliadores_credenciamento (user_id) where user_id is not null;
  create table public.avaliadores_perfil_publico (
    id uuid primary key default gen_random_uuid(),
    numero text not null unique check (numero ~ '^[A-Z]{3}-[0-9]{3,}$'),
    nome_publico text not null check (char_length(btrim(nome_publico)) between 2 and 80),
    cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
    selo text not null check (char_length(btrim(selo)) between 2 and 60),
    publicado boolean not null default true,
    credenciamento_id uuid unique references public.avaliadores_credenciamento (id) on delete set null,
    criado_em timestamptz not null default now()
  );
  create table public.vistoria_pedidos (id uuid primary key default gen_random_uuid(), avaliador_id uuid);
  insert into public.avaliadores_contador (sigla, ultimo) values ('UDI', 4), ('UBE', 2);
`;

type Linha = { numero_credenciado: string; status: string; cidade: string };
export type ProvaDa0366 = {
  caso1: { erro: string | null; antes: Linha; depois: Linha; contador: number };
  caso2: { erro: string | null; depois: Linha; contador: number };
  caso3: { erro: string | null; depois: Linha; contador: number };
  caso4: { erro: string | null; depois: Linha; outro: Linha; contador: number };
  caso5: { erroMigracao: string | null; erroRollback: string | null; depoisDaMigracao: Linha; depoisDoRollback: Linha; outro: Linha };
  caso6: { erro: string | null; depois: Linha; contador: number };
};

/** O endereço do mesmo servidor, apontado a outro banco. */
const noBanco = (url: string, banco: string): string => {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
};

/**
 * Corre a 0366 e o rollback (os arquivos de produção, sem mudar um carácter) nos seis casos, num banco descartável
 * criado e apagado aqui. `urlDoServidor` é o banco do laboratório: só serve para criar e apagar o descartável.
 */
export async function provarA0366(urlDoServidor: string, migracao: string, rollback: string): Promise<ProvaDa0366> {
  const banco = `prova_0366_${randomBytes(4).toString("hex")}`;
  const adm = postgres(urlDoServidor, { max: 1, onnotice: () => undefined });
  try {
    await adm.unsafe(`create database ${banco}`);
    const db = postgres(noBanco(urlDoServidor, banco), { max: 1, onnotice: () => undefined });
    try {
      return await seisCasos(db, migracao, rollback);
    } finally {
      await db.end();
    }
  } finally {
    await adm.unsafe(`drop database if exists ${banco} with (force)`).catch(() => undefined);
    await adm.end();
  }
}

async function seisCasos(db: postgres.Sql, mig: string, rb: string): Promise<ProvaDa0366> {
  // Um texto inteiro de uma vez (protocolo simples, como o psql). Um erro fica registado; se o texto tinha um begin
  // aberto (o rollback de produção), a transação abortada é fechada com rollback — como numa sessão psql.
  const tentar = async (texto: string): Promise<string | null> => {
    try {
      await db.unsafe(texto);
      return null;
    } catch (e) {
      await db.unsafe("rollback").catch(() => undefined);
      return e instanceof Error ? e.message : String(e);
    }
  };
  const universo = () => db.unsafe(FORMA_DE_ANTES);
  const cred = async (numero: string, status = "em_teste"): Promise<string> =>
    (
      await db.unsafe(
        `insert into public.avaliadores_credenciamento (parceiro_id, cidade, numero_credenciado, status, conduta_versao, experiencia_link)
         values (gen_random_uuid(), 'Uberlândia', $1, $2, '2026-10-23', 'https://portfolio.lab.vivanomads.test/t1797') returning id`,
        [numero, status],
      )
    )[0].id as string;
  const linha = async (id: string): Promise<Linha> =>
    (await db.unsafe(`select numero_credenciado, status, cidade from public.avaliadores_credenciamento where id = $1`, [id]))[0] as unknown as Linha;
  const contador = async (): Promise<number> => Number((await db.unsafe(`select ultimo from public.avaliadores_contador where sigla = 'UDI'`))[0].ultimo);

  // Caso 1: aplica e troca.
  await universo();
  const k1 = await cred("UBE-002");
  const antes1 = await linha(k1);
  const e1 = await tentar(mig);
  const caso1 = { erro: e1, antes: antes1, depois: await linha(k1), contador: await contador() };
  // Caso 2: reaplica sem efeito (no mesmo universo do caso 1).
  const e2 = await tentar(mig);
  const caso2 = { erro: e2, depois: await linha(k1), contador: await contador() };

  // Caso 3: com 1 pedido de vistoria, não toca.
  await universo();
  const k3 = await cred("UBE-002");
  await db.unsafe(`insert into public.vistoria_pedidos (avaliador_id) values ($1)`, [k3]);
  const e3 = await tentar(mig);
  const caso3 = { erro: e3, depois: await linha(k3), contador: await contador() };

  // Caso 4: com o número de destino (UDI-005) já usado, não toca.
  await universo();
  const k4 = await cred("UBE-002");
  const o4 = await cred("UDI-005", "ativo");
  const e4 = await tentar(mig);
  const caso4 = { erro: e4, depois: await linha(k4), outro: await linha(o4), contador: await contador() };

  // Caso 5: o rollback de produção — o arquivo inteiro — desfaz (e não toca nas outras linhas).
  await universo();
  const k5 = await cred("UBE-002");
  const o5 = await cred("UDI-003");
  const em5 = await tentar(mig);
  const depoisDaMigracao = await linha(k5);
  const er5 = await tentar(rb);
  const caso5 = { erroMigracao: em5, erroRollback: er5, depoisDaMigracao, depoisDoRollback: await linha(k5), outro: await linha(o5) };

  // Caso 6: o status já não é em_teste, não toca.
  await universo();
  const k6 = await cred("UBE-002", "ativo");
  const e6 = await tentar(mig);
  const caso6 = { erro: e6, depois: await linha(k6), contador: await contador() };

  return { caso1, caso2, caso3, caso4, caso5, caso6 };
}
