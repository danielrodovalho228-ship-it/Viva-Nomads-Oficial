import postgres from "postgres";
import { randomBytes } from "node:crypto";

/*
  E1225 / 0367 (ORDEM-DUET-1120; regra da casa: a trava que afirma comportamento é EXECUTADA num banco descartável) —
  a prova executada da 0367, no desenho da prova-0348 e da prova-0366: sem reescrita de texto nenhuma. A prova cria um
  BANCO descartável no mesmo servidor Postgres do laboratório (`create database`), monta lá, no esquema `public` desse
  banco e com os nomes de verdade, pagamentos_bloco NA FORMA DE ANTES DA 0367 (0029 + 0074 + 0143 + 0182 + 0188 + 0348:
  as mesmas colunas, checks, índices e a política de inserção do dono) e corre lá os arquivos da 0367, do aplicar e do
  rollback de produção TAL COMO ESTÃO. No fim, o banco é apagado. As tabelas verdadeiras do laboratório ficam noutro
  banco: nenhuma escrita lhes chega.
  contratos, properties e contrato_blocos são mínimos (as colunas que a política e a prova leem); auth.uid() lê a
  sessão de um parâmetro (vn.uid), para a política correr como corre com o dono logado.
  A MASSA (ORDEM-DUET-1120, ponto 5): a mesma forma dos 4 contratos de teste — 2 blocos com caução cada (R$ 2.400 +
  R$ 2.400 em três, R$ 3.200 + R$ 3.200 num) e o registro de caução de antes, ligado ao CONTRATO (sem bloco), pela soma.
  Os casos:
   - migração: aplica sem erro, e NENHUMA linha que já existia muda (conferência antes/depois, linha a linha);
   - reaplicar: a 0367 outra vez não dá erro nem muda nada (linhas e índices);
   - aplicar de produção: aplica e reaplica, registando-se uma só vez;
   - por bloco: com o registro antigo pela soma, uma caução no bloco 1 e outra no bloco 2 entram (antes, o índice por
     contrato recusava a 2.ª);
   - o mesmo bloco duas vezes → recusado (o índice por bloco); o anulado não ocupa o bloco;
   - duas cauções sem bloco no mesmo contrato → continua recusado (o registro de antes não ganha um irmão);
   - aluguel sem bloco → continua recusado (o check);
   - a política: o dono regista a caução num bloco DO SEU contrato; num bloco de outro contrato, recusado;
   - rollback com duas cauções ativas no mesmo contrato → FALHA, e nada muda;
   - rollback sem isso → volta o índice por contrato, saem os novos, sai o registo; as linhas ficam; e (ORDEM-DUET-1135)
     a POLÍTICA volta a recusar a caução com bloco, como antes da 0367 (a recusa tem de vir da política, não do check).
*/

const OWNER = "00000000-0000-4000-8000-0000000d0e00";
const OUTRO = "00000000-0000-4000-8000-0000000d0e01";

/** pagamentos_bloco como estava antes da 0367, as tabelas que a política lê, e o registo das migrações. */
const FORMA_DE_ANTES = `
  do $r$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $r$;
  create schema if not exists auth;
  create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(current_setting('vn.uid', true), '')::uuid $f$;
  grant usage on schema auth to authenticated;
  grant execute on function auth.uid() to authenticated;
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, name text);
  delete from supabase_migrations.schema_migrations;
  drop table if exists public.pagamentos_bloco, public.contrato_blocos, public.contratos, public.properties;
  create table public.properties (id uuid primary key, owner_id uuid not null);
  create table public.contratos (id uuid primary key, property_id uuid not null references public.properties (id));
  create table public.contrato_blocos (
    id uuid primary key default gen_random_uuid(),
    contrato_id uuid not null references public.contratos (id) on delete cascade,
    numero_bloco int not null check (numero_bloco >= 1),
    caucao numeric(12,2) not null
  );
  create table public.pagamentos_bloco (
    id uuid primary key default gen_random_uuid(),
    bloco_id uuid references public.contrato_blocos (id) on delete cascade,
    contrato_id uuid not null references public.contratos (id) on delete cascade,
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
    parte integer not null default 1,
    constraint pagamentos_bloco_encargos_lista check (jsonb_typeof(encargos) = 'array'),
    constraint pagamentos_bloco_anulacao check ((anulado_em is null and anulado_motivo is null)
      or (anulado_em is not null and length(btrim(coalesce(anulado_motivo, ''))) >= 5)),
    constraint pagamentos_bloco_parte_valida check (parte >= 1)
  );
  alter table public.pagamentos_bloco add constraint pagamentos_bloco_bloco_por_tipo
    check ((tipo = 'caucao' and bloco_id is null) or (tipo = 'aluguel' and bloco_id is not null)) not valid;
  create index pagamentos_bloco_bloco_idx on public.pagamentos_bloco (bloco_id);
  create index pagamentos_bloco_contrato_idx on public.pagamentos_bloco (contrato_id);
  create index idx_pagamentos_bloco_marcado_por on public.pagamentos_bloco (marcado_por);
  create unique index pagamentos_bloco_uma_caucao on public.pagamentos_bloco (contrato_id) where tipo = 'caucao' and anulado_em is null;
  create unique index pagamentos_bloco_uma_parte_por_bloco on public.pagamentos_bloco (bloco_id, parte) where tipo = 'aluguel' and anulado_em is null;
  alter table public.pagamentos_bloco enable row level security;
  create policy "pagamento visível às partes" on public.pagamentos_bloco for select using (true);
  create policy "proprietário registra recebimento" on public.pagamentos_bloco
    for insert with check (
      marcado_por = (select auth.uid())
      and coalesce(confirmado_pelo_inquilino, false) = false
      and confirmado_em is null
      and anulado_em is null
      and exists (
        select 1 from public.contratos c
          join public.properties p on p.id = c.property_id
         where c.id = pagamentos_bloco.contrato_id and p.owner_id = (select auth.uid())
      )
      and (
        (tipo = 'caucao' and bloco_id is null)
        or (tipo = 'aluguel' and exists (
          select 1 from public.contrato_blocos b
           where b.id = pagamentos_bloco.bloco_id and b.contrato_id = pagamentos_bloco.contrato_id
        ))
      )
    );
  grant usage on schema public to authenticated;
  grant select on public.properties, public.contratos, public.contrato_blocos to authenticated;
  grant select, insert on public.pagamentos_bloco to authenticated;
`;

/** A massa dos 4 contratos de teste: 2 blocos com caução cada, a caução de antes registada no contrato pela soma. */
const MASSA = [
  { caucoes: [2400, 2400] },
  { caucoes: [2400, 2400] },
  { caucoes: [2400, 2400] },
  { caucoes: [3200, 3200] },
] as const;

export type Contrato = { id: string; blocos: string[] };
export type ProvaDa0367 = {
  migracao: { erro: string | null; linhasAntes: string; linhasDepois: string; linhas: number };
  reaplicar: { erro: string | null; linhasIguais: boolean; indicesIguais: boolean };
  aplicar: { erro1: string | null; erro2: string | null; registos: number; nome: string | null };
  porBloco: { erroMigracao: string | null; bloco1: string | null; bloco2: string | null; ativasNoContrato: number };
  mesmoBloco: { erroMigracao: string | null; segunda: string | null; anular: string | null; depoisDeAnular: string | null; ativasNoBloco1: number };
  semBloco: { erroMigracao: string | null; segundaSemBloco: string | null };
  aluguelSemBloco: { erroMigracao: string | null; erro: string | null };
  politica: { erroMigracao: string | null; doSeuContrato: string | null; deOutroContrato: string | null; antesDaMigracao: string | null };
  rollbackComDuas: { erroMigracao: string | null; erroRollback: string | null; linhasIguais: boolean; temIndicePorBloco: boolean; temIndicePorContrato: boolean };
  rollbackLimpo: { erroMigracao: string | null; erroRollback: string | null; linhasIguais: boolean; temIndicePorContrato: boolean; temIndicePorBloco: boolean; temIndiceSemBloco: boolean; registo: number; politicaDepois: string | null };
};

const noBanco = (url: string, banco: string): string => {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
};

/**
 * Corre a 0367, o aplicar e o rollback (os arquivos de produção, sem mudar um carácter) num banco descartável criado e
 * apagado aqui. `urlDoServidor` é o banco do laboratório: só serve para criar e apagar o descartável.
 */
export async function provarA0367(urlDoServidor: string, migracao: string, aplicar: string, rollback: string): Promise<ProvaDa0367> {
  const banco = `prova_0367_${randomBytes(4).toString("hex")}`;
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

async function osCasos(db: postgres.Sql, mig: string, apl: string, rb: string): Promise<ProvaDa0367> {
  // Um texto inteiro de uma vez (protocolo simples, como o psql); um begin aberto e abortado fecha-se com rollback.
  const tentar = async (texto: string): Promise<string | null> => {
    try {
      await db.unsafe(texto);
      return null;
    } catch (e) {
      await db.unsafe("rollback").catch(() => undefined);
      return e instanceof Error ? e.message : String(e);
    }
  };
  const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

  /** Refaz o universo: a forma de antes e a massa. Devolve os contratos com os ids dos blocos, por ordem. */
  const universo = async (): Promise<Contrato[]> => {
    await db.unsafe(FORMA_DE_ANTES);
    const out: Contrato[] = [];
    for (const [i, m] of MASSA.entries()) {
      const prop = (await db.unsafe(`insert into public.properties (id, owner_id) values (gen_random_uuid(), $1) returning id`, [i === 0 ? OWNER : OUTRO]))[0].id as string;
      const c = (await db.unsafe(`insert into public.contratos (id, property_id) values (gen_random_uuid(), $1) returning id`, [prop]))[0].id as string;
      const blocos: string[] = [];
      for (const [k, caucao] of m.caucoes.entries())
        blocos.push((await db.unsafe(`insert into public.contrato_blocos (contrato_id, numero_bloco, caucao) values ($1, $2, $3) returning id`, [c, k + 1, caucao]))[0].id as string);
      const soma = m.caucoes.reduce((s, v) => s + v, 0);
      await db.unsafe(
        `insert into public.pagamentos_bloco (bloco_id, contrato_id, tipo, valor, data_pagamento, marcado_por, created_at) values (null, $1, 'caucao', $2, '2026-11-01', $3, '2026-11-01T12:00:00Z')`,
        [c, soma, i === 0 ? OWNER : OUTRO],
      );
      await db.unsafe(
        `insert into public.pagamentos_bloco (bloco_id, contrato_id, tipo, valor, data_pagamento, marcado_por, created_at) values ($1, $2, 'aluguel', $3, '2026-11-01', $4, '2026-11-01T12:00:01Z')`,
        [blocos[0], c, soma * 2, i === 0 ? OWNER : OUTRO],
      );
      out.push({ id: c, blocos });
    }
    return out;
  };
  /** Todas as linhas, coluna a coluna, numa ordem fixa. */
  const linhas = async (): Promise<string> =>
    JSON.stringify(await db.unsafe(`select to_jsonb(p) as l from public.pagamentos_bloco p order by p.created_at, p.id`));
  const indices = async (): Promise<string> =>
    JSON.stringify(await db.unsafe(`select indexname, indexdef from pg_indexes where schemaname = 'public' and tablename = 'pagamentos_bloco' order by indexname`));
  const temIndice = async (nome: string): Promise<boolean> =>
    (await db.unsafe(`select 1 from pg_indexes where schemaname = 'public' and indexname = $1`, [nome])).length > 0;
  const caucao = (c: string, bloco: string | null, valor: number, dono = OUTRO) =>
    tentar(
      `insert into public.pagamentos_bloco (bloco_id, contrato_id, tipo, valor, data_pagamento, marcado_por) values (${bloco ? lit(bloco) : "null"}, ${lit(c)}, 'caucao', ${valor}, '2026-11-26', ${lit(dono)})`,
    );
  const ativas = async (onde: string): Promise<number> =>
    Number((await db.unsafe(`select count(*)::int as n from public.pagamentos_bloco where tipo = 'caucao' and anulado_em is null and ${onde}`))[0].n);

  // Migração: aplica, e nenhuma linha muda.
  await universo();
  const linhasAntes = await linhas();
  const em = await tentar(mig);
  const linhasDepois = await linhas();
  const migracao = { erro: em, linhasAntes, linhasDepois, linhas: (JSON.parse(linhasDepois) as unknown[]).length };
  // Reaplicar (no mesmo universo): sem erro, sem mudança.
  const idx1 = await indices();
  const er = await tentar(mig);
  const reaplicar = { erro: er, linhasIguais: (await linhas()) === linhasDepois, indicesIguais: (await indices()) === idx1 };

  // O aplicar de produção, duas vezes: regista-se uma só.
  await universo();
  const ea1 = await tentar(apl);
  const ea2 = await tentar(apl);
  const reg = await db.unsafe(`select name from supabase_migrations.schema_migrations where version like '%0367'`);
  const aplicar = { erro1: ea1, erro2: ea2, registos: reg.length, nome: reg.length ? String(reg[0].name) : null };

  // Por bloco: com o registro antigo pela soma, uma caução no bloco 1 e outra no bloco 2 entram.
  let cs = await universo();
  const m1 = await tentar(mig);
  const b1 = await caucao(cs[1].id, cs[1].blocos[0], 2400);
  const b2 = await caucao(cs[1].id, cs[1].blocos[1], 2400);
  const porBloco = { erroMigracao: m1, bloco1: b1, bloco2: b2, ativasNoContrato: await ativas(`contrato_id = ${lit(cs[1].id)}`) };

  // O mesmo bloco duas vezes → recusado; anulada, uma nova entra.
  cs = await universo();
  const m2 = await tentar(mig);
  await caucao(cs[1].id, cs[1].blocos[0], 2400);
  const segunda = await caucao(cs[1].id, cs[1].blocos[0], 2400);
  const anular = await tentar(
    `update public.pagamentos_bloco set anulado_em = now(), anulado_motivo = 'registro em duplicidade' where bloco_id = ${lit(cs[1].blocos[0])} and tipo = 'caucao'`,
  );
  const depoisDeAnular = await caucao(cs[1].id, cs[1].blocos[0], 2400);
  const mesmoBloco = { erroMigracao: m2, segunda, anular, depoisDeAnular, ativasNoBloco1: await ativas(`bloco_id = ${lit(cs[1].blocos[0])}`) };

  // Duas sem bloco no mesmo contrato → recusado.
  cs = await universo();
  const m3 = await tentar(mig);
  const semBloco = { erroMigracao: m3, segundaSemBloco: await caucao(cs[1].id, null, 100) };

  // Aluguel sem bloco → recusado.
  cs = await universo();
  const m4 = await tentar(mig);
  const aluguelSemBloco = {
    erroMigracao: m4,
    erro: await tentar(`insert into public.pagamentos_bloco (bloco_id, contrato_id, tipo, valor, data_pagamento, marcado_por) values (null, ${lit(cs[1].id)}, 'aluguel', 100, '2026-11-26', ${lit(OUTRO)})`),
  };

  // A política, corrida como o dono logado (role authenticated, auth.uid() = o dono do contrato 0).
  const comoDono = (c: string, bloco: string) =>
    tentar(
      `begin; set local role authenticated; set local vn.uid = ${lit(OWNER)};
       insert into public.pagamentos_bloco (bloco_id, contrato_id, tipo, valor, data_pagamento, marcado_por) values (${lit(bloco)}, ${lit(c)}, 'caucao', 2400, '2026-11-26', ${lit(OWNER)});
       commit;`,
    );
  cs = await universo();
  const antesDaMigracao = await comoDono(cs[0].id, cs[0].blocos[0]);
  const m5 = await tentar(mig);
  const doSeuContrato = await comoDono(cs[0].id, cs[0].blocos[0]);
  const deOutroContrato = await comoDono(cs[0].id, cs[1].blocos[1]);
  const politica = { erroMigracao: m5, doSeuContrato, deOutroContrato, antesDaMigracao };

  // Rollback com duas cauções ativas no mesmo contrato → falha, e nada muda.
  cs = await universo();
  const m6 = await tentar(mig);
  await caucao(cs[1].id, cs[1].blocos[0], 2400);
  const antes6 = await linhas();
  const erb6 = await tentar(rb);
  const rollbackComDuas = {
    erroMigracao: m6,
    erroRollback: erb6,
    linhasIguais: (await linhas()) === antes6,
    temIndicePorBloco: await temIndice("pagamentos_bloco_uma_caucao_por_bloco"),
    temIndicePorContrato: await temIndice("pagamentos_bloco_uma_caucao"),
  };

  // Rollback sem isso: volta o índice por contrato, saem os novos e o registo; as linhas ficam; a política volta a
  // recusar a caução com bloco (ORDEM-DUET-1135).
  cs = await universo();
  const m7 = await tentar(apl);
  const antes7 = await linhas();
  const erb7 = await tentar(rb);
  const rollbackLimpo = {
    erroMigracao: m7,
    erroRollback: erb7,
    linhasIguais: (await linhas()) === antes7,
    temIndicePorContrato: await temIndice("pagamentos_bloco_uma_caucao"),
    temIndicePorBloco: await temIndice("pagamentos_bloco_uma_caucao_por_bloco"),
    temIndiceSemBloco: await temIndice("pagamentos_bloco_uma_caucao_sem_bloco"),
    registo: (await db.unsafe(`select 1 from supabase_migrations.schema_migrations where version like '%0367'`)).length,
    politicaDepois: await comoDono(cs[0].id, cs[0].blocos[0]),
  };

  return { migracao, reaplicar, aplicar, porBloco, mesmoBloco, semBloco, aluguelSemBloco, politica, rollbackComDuas, rollbackLimpo };
}
