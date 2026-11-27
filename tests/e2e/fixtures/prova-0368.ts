import postgres from "postgres";
import { randomBytes } from "node:crypto";

/*
  E1229 / 0368 (ORDENS-DUET 1160 e 1162; regra da casa: a trava que afirma comportamento é EXECUTADA num banco
  descartável) — a prova executada da 0368, no desenho das provas 0348/0366/0367: sem reescrita de texto. Cria um
  BANCO descartável no servidor Postgres do laboratório, monta lá contrato_eventos NA FORMA DE ANTES DA 0368 (0198 +
  0225: as mesmas colunas e o check fechado dos 12 tipos) e corre lá a 0368, o aplicar e o rollback de produção TAL COMO
  ESTÃO. No fim, o banco é apagado.
  Os casos:
   - aplica sem erro, e os eventos que já existiam ficam iguais;
   - depois: um evento "pagamento_anulado" entra; um tipo fora da lista continua recusado;
   - reaplica sem efeito (sem erro, o mesmo check); o aplicar regista-se uma vez;
   - rollback com um "pagamento_anulado" gravado → FALHA, e nada muda (o evento e o check novo ficam);
   - rollback limpo → o check antigo volta ("pagamento_anulado" recusado outra vez), sai o registo, os eventos ficam.
  ORDEM-DUET-1169 (correção B do coordenador): a função anular_pagamento, numa transação só — ou tudo, ou nada:
   - o dono, antes da confirmação: o pagamento e o documento anulados, e UM evento com o caminho, o pagamento, o
     documento, o valor e o motivo;
   - o dono, depois da confirmação: não anula (ok = false), nada muda;
   - a Central, depois da confirmação: anula, com o número do chamado no evento;
   - outra vez: ok = false, um evento só;
   - uma falha SIMULADA na gravação do evento: o pagamento e o documento ficam intactos;
   - quem não é o servidor (authenticated) não executa a função;
   - o rollback tira a função.
*/
const TIPOS_DE_ANTES = [
  "aditivo_proposto", "aditivo_aceito", "aditivo_recusado", "aditivo_expirado", "estadia_remarcada",
  "encerramento_pedido", "contrato_encerrado", "instrucoes_liberadas", "ocupantes_apagados",
  "convidado_adicionado", "convidado_removido", "convidados_apagados",
];
const FORMA_DE_ANTES = `
  create schema if not exists supabase_migrations;
  create table if not exists supabase_migrations.schema_migrations (version text primary key, name text);
  delete from supabase_migrations.schema_migrations;
  do $r$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
  end $r$;
  drop function if exists public.anular_pagamento(uuid, text, uuid, text, text);
  drop table if exists public.documentos_fiscais, public.pagamentos_bloco, public.contrato_eventos, public.contratos;
  create table public.contratos (id uuid primary key default gen_random_uuid());
  create table public.contrato_eventos (
    id uuid primary key default gen_random_uuid(),
    contrato_id uuid not null references public.contratos(id) on delete cascade,
    tipo text not null,
    autor_id uuid,
    dados jsonb not null default '{}',
    criado_em timestamptz not null default now()
  );
  alter table public.contrato_eventos add constraint contrato_eventos_tipo_check check (tipo in (${TIPOS_DE_ANTES.map((t) => `'${t}'`).join(", ")}));
  create index contrato_eventos_contrato on public.contrato_eventos (contrato_id, criado_em);
  create index contrato_eventos_tipo on public.contrato_eventos (tipo, criado_em);
  create table public.pagamentos_bloco (
    id uuid primary key default gen_random_uuid(),
    contrato_id uuid not null references public.contratos(id) on delete cascade,
    tipo text not null default 'aluguel',
    valor numeric(12,2) not null,
    confirmado_pelo_inquilino boolean not null default false,
    anulado_em timestamptz,
    anulado_motivo text,
    constraint pagamentos_bloco_anulacao check ((anulado_em is null and anulado_motivo is null)
      or (anulado_em is not null and length(btrim(coalesce(anulado_motivo, ''))) >= 5))
  );
  create table public.documentos_fiscais (
    id uuid primary key default gen_random_uuid(),
    pagamento_id uuid references public.pagamentos_bloco(id),
    numero text not null,
    anulado_em timestamptz,
    anulado_motivo text
  );
  grant usage on schema public to authenticated;
`;

export type ProvaDa0368 = {
  migracao: { erro: string | null; eventos: number; iguais: boolean };
  depois: { pagamentoAnulado: string | null; foraDaLista: string | null };
  reaplicar: { erro: string | null; checkIgual: boolean };
  aplicar: { erro1: string | null; erro2: string | null; registos: number; nome: string | null; pagamentoAnulado: string | null; foraDaLista: string | null };
  rollbackComEvento: { erroMigracao: string | null; erroRollback: string | null; eventosIguais: boolean; aceitaAinda: boolean };
  rollbackLimpo: { erroMigracao: string | null; erroRollback: string | null; eventosIguais: boolean; pagamentoAnulado: string | null; registo: number; funcaoFica: boolean };
  funcao: {
    erroAplicar: string | null;
    dono: { resposta: unknown; pagamento: Estado; documento: Estado; eventos: { dados: Record<string, unknown>; autor_id: string }[] };
    donoConfirmado: { resposta: unknown; pagamento: Estado; documento: Estado; eventos: number };
    central: { resposta: unknown; pagamento: Estado; eventos: { dados: Record<string, unknown> }[] };
    outraVez: { resposta: unknown; eventos: number };
    falhaNoEvento: { erro: string | null; pagamento: Estado; documento: Estado; eventos: number };
    semPermissao: string | null;
  };
};
type Estado = { anulado: boolean; motivo: string | null };

const noBanco = (url: string, banco: string): string => {
  const u = new URL(url);
  u.pathname = `/${banco}`;
  return u.toString();
};

/** Corre a 0368, o aplicar e o rollback (os arquivos de produção, sem mudar um carácter) num banco descartável. */
export async function provarA0368(urlDoServidor: string, migracao: string, aplicar: string, rollback: string): Promise<ProvaDa0368> {
  const banco = `prova_0368_${randomBytes(4).toString("hex")}`;
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

async function osCasos(db: postgres.Sql, mig: string, apl: string, rb: string): Promise<ProvaDa0368> {
  const tentar = async (texto: string): Promise<string | null> => {
    try {
      await db.unsafe(texto);
      return null;
    } catch (e) {
      await db.unsafe("rollback").catch(() => undefined);
      return e instanceof Error ? e.message : String(e);
    }
  };
  let contrato = "";
  const universo = async () => {
    await db.unsafe(FORMA_DE_ANTES);
    contrato = (await db.unsafe(`insert into public.contratos default values returning id`))[0].id as string;
    for (const t of TIPOS_DE_ANTES) await db.unsafe(`insert into public.contrato_eventos (contrato_id, tipo, dados, criado_em) values ($1, $2, '{"de":"antes"}', '2026-11-01T12:00:00Z')`, [contrato, t]);
  };
  const eventos = async () => JSON.stringify(await db.unsafe(`select to_jsonb(e) as l from public.contrato_eventos e order by tipo, id`));
  const evento = (tipo: string) => tentar(`insert into public.contrato_eventos (contrato_id, tipo, dados) values ('${contrato}', '${tipo}', '{"caminho":"dono"}')`);
  const estado = async (tabela: string, id: string): Promise<Estado> => {
    const r = (await db.unsafe(`select anulado_em is not null as a, anulado_motivo as m from public.${tabela} where id = $1`, [id]))[0];
    return { anulado: r.a === true, motivo: (r.m as string | null) ?? null };
  };
  const chamar = async (pg: string, motivo: string, autor: string, caminho: string, chamado: string | null): Promise<unknown> =>
    (await db.unsafe(`select public.anular_pagamento($1, $2, $3, $4, $5) as r`, [pg, motivo, autor, caminho, chamado]))[0].r;
  const check = async () => String((await db.unsafe(`select pg_get_constraintdef(oid) as d from pg_constraint where conname = 'contrato_eventos_tipo_check'`))[0]?.d ?? "");
  const registos = async () => db.unsafe(`select name from supabase_migrations.schema_migrations where version like '%0368'`);

  // Aplica; os eventos de antes ficam iguais.
  await universo();
  const antes = await eventos();
  const em = await tentar(mig);
  const depoisEventos = await eventos();
  const migracao = { erro: em, eventos: (JSON.parse(depoisEventos) as unknown[]).length, iguais: depoisEventos === antes };
  const depois = { pagamentoAnulado: await evento("pagamento_anulado"), foraDaLista: await evento("tipo_inventado") };
  const c1 = await check();
  const er = await tentar(mig);
  const reaplicar = { erro: er, checkIgual: (await check()) === c1 };

  // O aplicar, duas vezes.
  await universo();
  const ea1 = await tentar(apl);
  const ea2 = await tentar(apl);
  const reg = await registos();
  // ORDEM-DUET-1170 (Aq): depois do APLICAR de produção (não só da migração), o check está lá — o tipo novo entra e um
  // tipo inventado é recusado.
  const aplicar = { erro1: ea1, erro2: ea2, registos: reg.length, nome: reg.length ? String(reg[0].name) : null, pagamentoAnulado: await evento("pagamento_anulado"), foraDaLista: await evento("tipo_inventado") };

  // Rollback com um pagamento_anulado gravado → falha, nada muda.
  await universo();
  const m1 = await tentar(apl);
  await evento("pagamento_anulado");
  const antes1 = await eventos();
  const erb1 = await tentar(rb);
  const rollbackComEvento = { erroMigracao: m1, erroRollback: erb1, eventosIguais: (await eventos()) === antes1, aceitaAinda: (await evento("pagamento_anulado")) === null };

  // Rollback limpo.
  await universo();
  const m2 = await tentar(apl);
  const antes2 = await eventos();
  const erb2 = await tentar(rb);
  const rollbackLimpo = {
    erroMigracao: m2,
    erroRollback: erb2,
    eventosIguais: (await eventos()) === antes2,
    pagamentoAnulado: await evento("pagamento_anulado"),
    registo: (await registos()).length,
    funcaoFica: (await db.unsafe(`select 1 from pg_proc where proname = 'anular_pagamento'`)).length > 0,
  };

  // A função anular_pagamento (ORDEM-DUET-1169).
  await universo();
  const eApl = await tentar(apl);
  const AUTOR = "00000000-0000-4000-8000-00000000d0e0";
  const EQUIPE = "00000000-0000-4000-8000-00000000e0e0";
  const novoPg = async (confirmado: boolean) => {
    const id = (await db.unsafe(`insert into public.pagamentos_bloco (contrato_id, valor, confirmado_pelo_inquilino) values ($1, 3200, $2) returning id`, [contrato, confirmado]))[0].id as string;
    const doc = (await db.unsafe(`insert into public.documentos_fiscais (pagamento_id, numero) values ($1, $2) returning id`, [id, `REC-2026-${id.slice(0, 6)}`]))[0].id as string;
    return { id, doc };
  };
  const eventosDe = async (pg: string) =>
    (await db.unsafe(`select dados, autor_id from public.contrato_eventos where tipo = 'pagamento_anulado' and dados->>'pagamento_id' = $1`, [pg])) as unknown as { dados: Record<string, unknown>; autor_id: string }[];
  const a = await novoPg(false);
  const rDono = await chamar(a.id, "valor lançado errado", AUTOR, "dono", null);
  const dono = { resposta: rDono, pagamento: await estado("pagamentos_bloco", a.id), documento: await estado("documentos_fiscais", a.doc), eventos: await eventosDe(a.id) };
  const b = await novoPg(true);
  const rDc = await chamar(b.id, "valor lançado errado", AUTOR, "dono", null);
  const donoConfirmado = { resposta: rDc, pagamento: await estado("pagamentos_bloco", b.id), documento: await estado("documentos_fiscais", b.doc), eventos: (await eventosDe(b.id)).length };
  const rCe = await chamar(b.id, "pedido do dono, conferido", EQUIPE, "central", "CH-2026-000777");
  const central = { resposta: rCe, pagamento: await estado("pagamentos_bloco", b.id), eventos: await eventosDe(b.id) };
  const rOv = await chamar(b.id, "pedido do dono, conferido", EQUIPE, "central", "CH-2026-000777");
  const outraVez = { resposta: rOv, eventos: (await eventosDe(b.id)).length };
  // A falha simulada: a gravação do evento lança — o pagamento e o documento têm de ficar intactos.
  const c = await novoPg(false);
  await db.unsafe(`create function public.falha_simulada() returns trigger language plpgsql as $f$ begin raise exception 'falha simulada na gravação do evento'; end $f$`);
  await db.unsafe(`create trigger falha_simulada before insert on public.contrato_eventos for each row execute function public.falha_simulada()`);
  const eFalha = await tentar(`select public.anular_pagamento('${c.id}', 'valor lançado errado', '${AUTOR}', 'dono', null)`);
  const falhaNoEvento = { erro: eFalha, pagamento: await estado("pagamentos_bloco", c.id), documento: await estado("documentos_fiscais", c.doc), eventos: (await eventosDe(c.id)).length };
  await db.unsafe(`drop trigger falha_simulada on public.contrato_eventos; drop function public.falha_simulada()`);
  const d = await novoPg(false);
  const semPermissao = await tentar(`begin; set local role authenticated; select public.anular_pagamento('${d.id}', 'valor lançado errado', '${AUTOR}', 'dono', null); commit;`);
  const funcao = { erroAplicar: eApl, dono, donoConfirmado, central, outraVez, falhaNoEvento, semPermissao };

  return { migracao, depois, reaplicar, aplicar, rollbackComEvento, rollbackLimpo, funcao };
}
