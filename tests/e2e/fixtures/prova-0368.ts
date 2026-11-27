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
  drop table if exists public.contrato_eventos, public.contratos;
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
`;

export type ProvaDa0368 = {
  migracao: { erro: string | null; eventos: number; iguais: boolean };
  depois: { pagamentoAnulado: string | null; foraDaLista: string | null };
  reaplicar: { erro: string | null; checkIgual: boolean };
  aplicar: { erro1: string | null; erro2: string | null; registos: number; nome: string | null };
  rollbackComEvento: { erroMigracao: string | null; erroRollback: string | null; eventosIguais: boolean; aceitaAinda: boolean };
  rollbackLimpo: { erroMigracao: string | null; erroRollback: string | null; eventosIguais: boolean; pagamentoAnulado: string | null; registo: number };
};

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
  const aplicar = { erro1: ea1, erro2: ea2, registos: reg.length, nome: reg.length ? String(reg[0].name) : null };

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
  const rollbackLimpo = { erroMigracao: m2, erroRollback: erb2, eventosIguais: (await eventos()) === antes2, pagamentoAnulado: await evento("pagamento_anulado"), registo: (await registos()).length };

  return { migracao, depois, reaplicar, aplicar, rollbackComEvento, rollbackLimpo };
}
