import postgres from "postgres";
import { randomBytes } from "node:crypto";

/*
  E1072 / 0348 (ORDENS-DUET 1078, 1084 e 1087; regra da casa: a trava que afirma comportamento é EXECUTADA num banco
  descartável) — a prova executada da 0348 nos quatro casos do coordenador.
  ORDEM-DUET-1087 (preferência do coordenador): sem reescrita de texto nenhuma. A prova cria um BANCO descartável no
  mesmo servidor Postgres do laboratório (`create database`), monta lá a tabela pagamentos_bloco NA FORMA DE ANTES DA 0348
  (no esquema `public` desse banco, com os nomes de verdade) e corre lá os arquivos da 0348 e do rollback de produção
  TAL COMO ESTÃO — o rollback inteiro, com o begin/commit e o apagar do registo em supabase_migrations. No fim, o banco é
  apagado. A tabela verdadeira do laboratório fica noutro banco: nenhuma escrita, citada ou não, lhe chega.
  A forma de antes da 0348 é a das migrações 0029, 0074, 0143 e 0182: as mesmas colunas, defaults, checks e índices (os
  únicos de uma caução e de um aluguel ativo por bloco). As chaves estrangeiras para contratos, blocos e contas ficam de
  fora (essas tabelas não existem no banco descartável, e a 0348 não lhes toca).
  Cada caso tem o seu universo: a tabela é refeita, o 1.º registro (o que já existia) entra e a 0348 corre inteira —
  por isso uma linha a mais no fim dela muda o que o caso vê.
   - caso 1: depois da 0348, um 2.º registro de aluguel ativo com a MESMA parte no mesmo bloco → recusado;
   - caso 2: um registro com a parte 2 no mesmo bloco → aceito;
   - caso 3: o anulado não ocupa a parte — anulada a parte 1, uma nova parte 1 → aceita;
   - caso 4: o rollback de produção com um complementar ativo → falha, e nada muda: a coluna `parte` continua, os dois
     registros continuam lá, ativos e com as mesmas partes.
*/

/** A tabela como estava antes da 0348 (0029 + 0074 + 0143 + 0182), e o registo das migrações. */
const FORMA_DE_ANTES = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, name text);
  drop table if exists public.pagamentos_bloco;
  create table public.pagamentos_bloco (
    id uuid primary key default gen_random_uuid(),
    bloco_id uuid,
    contrato_id uuid not null,
    tipo text not null default 'aluguel' check (tipo in ('aluguel','caucao')),
    valor numeric(12,2) not null check (valor >= 0),
    forma text not null default 'pix' check (forma in ('pix','boleto','transferencia','dinheiro','outro')),
    data_pagamento date not null,
    marcado_por uuid not null,
    confirmado_pelo_inquilino boolean not null default false,
    confirmado_em timestamptz,
    observacao text,
    created_at timestamptz not null default now(),
    encargos jsonb not null default '[]'::jsonb,
    anulado_em timestamptz,
    anulado_motivo text,
    constraint pagamentos_bloco_encargos_lista check (jsonb_typeof(encargos) = 'array'),
    constraint pagamentos_bloco_anulacao check ((anulado_em is null and anulado_motivo is null)
      or (anulado_em is not null and length(btrim(coalesce(anulado_motivo, ''))) >= 5)),
    constraint pagamentos_bloco_bloco_por_tipo check ((tipo = 'caucao' and bloco_id is null) or (tipo = 'aluguel' and bloco_id is not null))
  );
  create index pagamentos_bloco_bloco_idx on public.pagamentos_bloco (bloco_id);
  create index pagamentos_bloco_contrato_idx on public.pagamentos_bloco (contrato_id);
  create index idx_pagamentos_bloco_marcado_por on public.pagamentos_bloco (marcado_por);
  create unique index pagamentos_bloco_uma_caucao on public.pagamentos_bloco (contrato_id) where tipo = 'caucao' and anulado_em is null;
  create unique index pagamentos_bloco_um_valor_mensal on public.pagamentos_bloco (bloco_id) where tipo = 'aluguel' and anulado_em is null;
`;

export type Registro = { parte: number | null; ativo: boolean };
export type ProvaDa0348 = {
  migracao: { erro: string | null; registroDeAntes: { parte: number | null; ativo: boolean; valor: number } | null };
  caso1: { erroDaMigracao: string | null; segunda: string | null; ativosNaParte1: number };
  caso2: { erroDaMigracao: string | null; parte2: string | null; ativos: number };
  caso3: { erroDaMigracao: string | null; anular: string | null; novaParte1: string | null; ativosNaParte1: number };
  caso4: { erroDaMigracao: string | null; complemento: string | null; erroDoRollback: string | null; temColunaParte: boolean; antes: Registro[]; depois: Registro[] };
};

/** O endereço do mesmo servidor, apontado a outro banco. */
const noBanco = (url: string, banco: string): string => {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
};

/**
 * Corre a 0348 e o rollback (os arquivos de produção, sem mudar um carácter) nos quatro casos, num banco descartável
 * criado e apagado aqui. `urlDoServidor` é o banco do laboratório: só serve para criar e apagar o descartável.
 */
export async function provarA0348(urlDoServidor: string, migracao: string, rollback: string): Promise<ProvaDa0348> {
  const banco = `prova_0348_${randomBytes(4).toString("hex")}`;
  const adm = postgres(urlDoServidor, { max: 1, onnotice: () => undefined });
  try {
    await adm.unsafe(`create database ${banco}`);
    const db = postgres(noBanco(urlDoServidor, banco), { max: 1, onnotice: () => undefined });
    try {
      return await quatroCasos(db, migracao, rollback);
    } finally {
      await db.end();
    }
  } finally {
    await adm.unsafe(`drop database if exists ${banco} with (force)`).catch(() => undefined);
    await adm.end();
  }
}

async function quatroCasos(db: postgres.Sql, mig: string, rb: string): Promise<ProvaDa0348> {
  // Um texto inteiro de uma vez (protocolo simples, como o psql). Um erro fica registado; se o texto tinha um begin
  // aberto (o rollback de produção), a transação abortada é fechada com rollback — como numa sessão psql.
  const tentar = async (texto: string, params: unknown[] = []): Promise<string | null> => {
    try {
      await (params.length ? db.unsafe(texto, params as never[]) : db.unsafe(texto));
      return null;
    } catch (e) {
      await db.unsafe("rollback").catch(() => undefined);
      return e instanceof Error ? e.message : String(e);
    }
  };
  const bloco = "00000000-0000-4000-8000-00000000b10c";
  const inserir = (parte?: number) =>
    tentar(
      parte === undefined
        ? `insert into public.pagamentos_bloco (bloco_id, contrato_id, tipo, valor, data_pagamento, marcado_por) values ($1, gen_random_uuid(), 'aluguel', 2500, '2026-11-20', gen_random_uuid())`
        : `insert into public.pagamentos_bloco (bloco_id, contrato_id, tipo, valor, data_pagamento, marcado_por, parte) values ($1, gen_random_uuid(), 'aluguel', 400, '2026-11-21', gen_random_uuid(), $2)`,
      parte === undefined ? [bloco] : [bloco, parte],
    );
  const colunaParte = async (): Promise<boolean> =>
    (await db.unsafe(`select 1 from information_schema.columns where table_schema = 'public' and table_name = 'pagamentos_bloco' and column_name = 'parte'`)).length > 0;
  const parteOuNulo = async () => ((await colunaParte()) ? "parte" : "null::int as parte");
  const ativosNaParte = async (parte: number): Promise<number> =>
    Number((await db.unsafe(`select count(*)::int as n from public.pagamentos_bloco where bloco_id = $1 and parte = $2 and tipo = 'aluguel' and anulado_em is null`, [bloco, parte]))[0].n);
  const registros = async (): Promise<Registro[]> => {
    const rs = await db.unsafe(`select ${await parteOuNulo()}, anulado_em is null as ativo from public.pagamentos_bloco where bloco_id = $1 order by created_at, valor desc`, [bloco]);
    return rs.map((r) => ({ parte: r.parte === null ? null : Number(r.parte), ativo: r.ativo === true }));
  };
  // Cada caso: a tabela de antes, o 1.º registro (o que já existia antes da 0348) e a 0348 inteira.
  const universo = async (): Promise<string | null> => {
    await db.unsafe(FORMA_DE_ANTES);
    const erroAntes = await inserir();
    if (erroAntes) return `o registro de antes da 0348 não entrou: ${erroAntes}`;
    return tentar(mig);
  };

  // A 0348 aplica-se sem erro na forma de antes, e o registro que já existia fica igual: parte 1, ativo, mesmo valor
  // (a 0348 não regrava nem anula linha nenhuma — o Q4m).
  const erroDaMigracao = await universo();
  const deAntes = await db.unsafe(`select ${await parteOuNulo()}, anulado_em is null as ativo, valor from public.pagamentos_bloco where bloco_id = $1`, [bloco]);
  const migracao = {
    erro: erroDaMigracao,
    registroDeAntes: deAntes.length === 1 ? { parte: deAntes[0].parte === null ? null : Number(deAntes[0].parte), ativo: deAntes[0].ativo === true, valor: Number(deAntes[0].valor) } : null,
  };

  // Caso 1: um 2.º registro de aluguel ativo com a mesma parte (1, o default) no mesmo bloco → recusado.
  const m1 = await universo();
  const segunda1 = await inserir(1);
  const caso1 = { erroDaMigracao: m1, segunda: segunda1, ativosNaParte1: await ativosNaParte(1) };

  // Caso 2: a parte 2 no mesmo bloco → aceita.
  const m2 = await universo();
  const parte2 = await inserir(2);
  const caso2 = { erroDaMigracao: m2, parte2, ativos: Number((await db.unsafe(`select count(*)::int as n from public.pagamentos_bloco where bloco_id = $1 and anulado_em is null`, [bloco]))[0].n) };

  // Caso 3: anulada a parte 1, uma nova parte 1 → aceita.
  const m3 = await universo();
  const anular = await tentar(`update public.pagamentos_bloco set anulado_em = now(), anulado_motivo = 'registro em duplicidade' where bloco_id = $1 and parte = 1`, [bloco]);
  const novaParte1 = await inserir(1);
  const caso3 = { erroDaMigracao: m3, anular, novaParte1, ativosNaParte1: await ativosNaParte(1) };

  // Caso 4: com um complementar ativo (parte 2), o rollback de produção — o arquivo inteiro — falha, e nada muda.
  const m4 = await universo();
  const complemento = await inserir(2);
  const antes = await registros();
  const erroDoRollback = await tentar(rb);
  const caso4 = { erroDaMigracao: m4, complemento, erroDoRollback, temColunaParte: await colunaParte(), antes, depois: await registros() };

  return { migracao, caso1, caso2, caso3, caso4 };
}
