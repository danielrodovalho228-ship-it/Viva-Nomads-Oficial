import type { Sql, TransactionSql } from "postgres";

/*
  E1223 / 0366 (ORDEM-DUET-1075; regra da casa da ORDEM-DUET-1078: trava que afirma comportamento é EXECUTADA num banco
  descartável) — a prova executada da 0366, no padrão da prova-0365 e da prova-0348.
  O texto REAL da migração e do rollback de produção corre num esquema de rascunho (`e1223_prova`) criado dentro de uma
  transação desfeita no fim: cópias de avaliadores_credenciamento, avaliadores_contador e avaliadores_perfil_publico
  (`like … including all`: as mesmas colunas, checks e chaves únicas, como a do número) e um vistoria_pedidos mínimo (a
  0366 só conta os pedidos por avaliador_id). Cada caso tem o seu universo.
   - caso 1: aplica e troca — UBE-002 em_teste, sem pedidos, contador UDI em 4 → UDI-005; o contador vai a 5; o status,
     a cidade e o resto da linha ficam;
   - caso 2: reaplica sem efeito — a 0366 outra vez não muda nada (nem o contador);
   - caso 3: com 1 pedido de vistoria, não toca (nem o contador);
   - caso 4: com o número de destino já usado (por outro credenciamento), não toca (nem o contador);
   - caso 5: o rollback desfaz — volta UBE-002, e as outras linhas ficam;
   - caso 6: com o status já não em_teste, não toca.
*/
const ESQUEMA = "e1223_prova";
const TABELAS = ["avaliadores_credenciamento", "avaliadores_contador", "avaliadores_perfil_publico", "avaliadores_numero_trocas", "vistoria_pedidos"] as const;

/** O texto SQL de produção, apontado para as cópias do esquema de rascunho. */
export const noRascunho = (texto: string): string => TABELAS.reduce((q, t) => q.replaceAll(`public.${t}`, `${ESQUEMA}.${t}`), texto);

/** O texto de produção sem o begin/commit dele e sem tocar em supabase_migrations (corre dentro da transação desfeita). */
export const semTransacao = (texto: string): string =>
  texto
    .replace(/--[^\n]*/g, "")
    .replace(/^\s*(begin|commit);\s*$/gim, "")
    .replace(/delete from supabase_migrations\.schema_migrations[^;]*;/gi, "")
    .trim();

type Linha = { numero_credenciado: string; status: string; cidade: string };
export type ProvaDa0366 = {
  caso1: { erro: string | null; antes: Linha; depois: Linha; contador: number };
  caso2: { erro: string | null; depois: Linha; contador: number };
  caso3: { erro: string | null; depois: Linha; contador: number };
  caso4: { erro: string | null; depois: Linha; outro: Linha; contador: number };
  caso5: { erroMigracao: string | null; erroRollback: string | null; depoisDaMigracao: Linha; depoisDoRollback: Linha; outro: Linha };
  caso6: { erro: string | null; depois: Linha; contador: number };
};

class Desfazer extends Error {}

/** Corre a 0366 e o rollback (textos de produção) nos seis casos e devolve o que viu. Nada fica no banco. */
export async function provarA0366(sql: Sql, migracao: string, rollback: string): Promise<ProvaDa0366> {
  let visto: ProvaDa0366 | null = null;
  await sql
    .begin(async (tx) => {
      await tx.unsafe(`create schema ${ESQUEMA}`);
      visto = await seisCasos(tx, noRascunho(semTransacao(migracao)), noRascunho(semTransacao(rollback)));
      throw new Desfazer();
    })
    .catch((e) => {
      if (!(e instanceof Desfazer)) throw e;
    });
  if (!visto) throw new Error("a prova da 0366 não correu");
  return visto;
}

async function seisCasos(tx: TransactionSql, mig: string, rb: string): Promise<ProvaDa0366> {
  const tentar = async (texto: string): Promise<string | null> => {
    try {
      await tx.savepoint((sp) => sp.unsafe(texto));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };
  // Um universo: as cópias limpas (a tabela do registo das trocas sai; a 0366 cria-a), o contador UDI em 4.
  const universo = async () => {
    await tx.unsafe(`drop table if exists ${ESQUEMA}.avaliadores_numero_trocas`);
    for (const t of ["avaliadores_credenciamento", "avaliadores_contador", "avaliadores_perfil_publico"]) {
      await tx.unsafe(`drop table if exists ${ESQUEMA}.${t}`);
      await tx.unsafe(`create table ${ESQUEMA}.${t} (like public.${t} including all)`);
    }
    await tx.unsafe(`drop table if exists ${ESQUEMA}.vistoria_pedidos`);
    await tx.unsafe(`create table ${ESQUEMA}.vistoria_pedidos (id uuid primary key default gen_random_uuid(), avaliador_id uuid)`);
    await tx.unsafe(`insert into ${ESQUEMA}.avaliadores_contador (sigla, ultimo) values ('UDI', 4), ('UBE', 2)`);
  };
  const cred = async (numero: string, status = "em_teste"): Promise<string> =>
    (
      await tx.unsafe(
        `insert into ${ESQUEMA}.avaliadores_credenciamento (parceiro_id, cidade, numero_credenciado, status, conduta_versao, experiencia_link)
         values (gen_random_uuid(), 'Uberlândia', $1, $2, '2026-10-23', 'https://portfolio.lab.vivanomads.test/t0366') returning id`,
        [numero, status],
      )
    )[0].id as string;
  const linha = async (id: string): Promise<Linha> =>
    (await tx.unsafe(`select numero_credenciado, status, cidade from ${ESQUEMA}.avaliadores_credenciamento where id = $1`, [id]))[0] as unknown as Linha;
  const contador = async (): Promise<number> => Number((await tx.unsafe(`select ultimo from ${ESQUEMA}.avaliadores_contador where sigla = 'UDI'`))[0].ultimo);

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
  await tx.unsafe(`insert into ${ESQUEMA}.vistoria_pedidos (avaliador_id) values ($1)`, [k3]);
  const e3 = await tentar(mig);
  const caso3 = { erro: e3, depois: await linha(k3), contador: await contador() };

  // Caso 4: com o número de destino (UDI-005) já usado, não toca.
  await universo();
  const k4 = await cred("UBE-002");
  const o4 = await cred("UDI-005", "ativo");
  const e4 = await tentar(mig);
  const caso4 = { erro: e4, depois: await linha(k4), outro: await linha(o4), contador: await contador() };

  // Caso 5: o rollback desfaz (e não toca nas outras linhas).
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
