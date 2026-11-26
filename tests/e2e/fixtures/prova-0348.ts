import type { Sql, TransactionSql } from "postgres";

/*
  E1072 / 0348 (ORDEM-DUET-1078; regra da casa: trava que afirma comportamento é EXECUTADA num banco descartável) — a
  prova executada da 0348 nos quatro casos do coordenador, no padrão da prova-0365.
  O texto REAL da migração e do rollback de produção corre num esquema de rascunho (`e1072_prova`) criado dentro de uma
  transação desfeita no fim. A tabela é uma cópia da de produção NA FORMA DE ANTES DA 0348: as mesmas colunas, defaults e
  checks (`like … including defaults including constraints`), sem a coluna `parte`, e com a regra antiga da 0182 (o índice
  único `pagamentos_bloco_um_valor_mensal`, um aluguel ativo por bloco). Cada caso tem o seu universo (a tabela é limpa e
  a 0348 corre outra vez), e cada caso corre a migração inteira, por isso uma linha a mais no fim dela (ex.: apagar o
  índice novo) muda o que o caso vê:
   - caso 1: depois da 0348, um 2.º registro de aluguel ativo com a MESMA parte no mesmo bloco → recusado;
   - caso 2: um registro com a parte 2 no mesmo bloco → aceito;
   - caso 3: o anulado não ocupa a parte — anulada a parte 1, uma nova parte 1 → aceita;
   - caso 4: o rollback de produção com um complementar ativo → falha, e nada muda: a coluna `parte` continua, os dois
     registros continuam lá, ativos e com as mesmas partes.
*/
const ESQUEMA = "e1072_prova";

/** O texto SQL de produção, apontado para a cópia do esquema de rascunho. */
export const noRascunho = (texto: string): string => texto.replaceAll("public.pagamentos_bloco", `${ESQUEMA}.pagamentos_bloco`);

/** O rollback de produção sem o begin/commit dele (corre dentro da transação desfeita) e sem o apagar do registo. */
export const rollbackSemTransacao = (texto: string): string =>
  texto
    .replace(/--[^\n]*/g, "")
    .replace(/^\s*(begin|commit);\s*$/gim, "")
    .replace(/delete from supabase_migrations\.schema_migrations[^;]*;/gi, "")
    .trim();

export type Registro = { parte: number | null; ativo: boolean };
export type ProvaDa0348 = {
  migracao: { erro: string | null };
  caso1: { erroDaMigracao: string | null; segunda: string | null; ativosNaParte1: number };
  caso2: { erroDaMigracao: string | null; parte2: string | null; ativos: number };
  caso3: { erroDaMigracao: string | null; anular: string | null; novaParte1: string | null; ativosNaParte1: number };
  caso4: { erroDaMigracao: string | null; complemento: string | null; erroDoRollback: string | null; temColunaParte: boolean; antes: Registro[]; depois: Registro[] };
};

class Desfazer extends Error {}

/** Corre a 0348 e o rollback (textos de produção) nos quatro casos e devolve o que viu. Nada fica no banco. */
export async function provarA0348(sql: Sql, migracao: string, rollback: string): Promise<ProvaDa0348> {
  let visto: ProvaDa0348 | null = null;
  await sql
    .begin(async (tx) => {
      await tx.unsafe(`create schema ${ESQUEMA}`);
      visto = await quatroCasos(tx, noRascunho(migracao), noRascunho(rollbackSemTransacao(rollback)));
      throw new Desfazer();
    })
    .catch((e) => {
      if (!(e instanceof Desfazer)) throw e;
    });
  if (!visto) throw new Error("a prova da 0348 não correu");
  return visto;
}

async function quatroCasos(tx: TransactionSql, mig: string, rb: string): Promise<ProvaDa0348> {
  const T = `${ESQUEMA}.pagamentos_bloco`;
  // Um ponto de retorno por instrução: um erro (ex.: a chave única) fica registado e não derruba a transação.
  const tentar = async (texto: string, params: unknown[] = []): Promise<string | null> => {
    try {
      await tx.savepoint((sp) => sp.unsafe(texto, params as never[]));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };
  // A tabela na forma de ANTES da 0348: a cópia de produção sem `parte` (o check dela sai junto) e com a regra da 0182.
  const tabelaDeAntes = async () => {
    await tx.unsafe(`drop table if exists ${T}`);
    await tx.unsafe(`create table ${T} (like public.pagamentos_bloco including defaults including constraints)`);
    await tx.unsafe(`alter table ${T} drop column if exists parte cascade`);
    await tx.unsafe(`create unique index pagamentos_bloco_um_valor_mensal on ${T} (bloco_id) where tipo = 'aluguel' and anulado_em is null`);
  };
  const bloco = "00000000-0000-4000-8000-00000000b10c";
  const inserir = (parte?: number) =>
    tentar(
      parte === undefined
        ? `insert into ${T} (bloco_id, contrato_id, tipo, valor, data_pagamento, marcado_por) values ($1, gen_random_uuid(), 'aluguel', 2500, '2026-11-20', gen_random_uuid())`
        : `insert into ${T} (bloco_id, contrato_id, tipo, valor, data_pagamento, marcado_por, parte) values ($1, gen_random_uuid(), 'aluguel', 400, '2026-11-21', gen_random_uuid(), $2)`,
      parte === undefined ? [bloco] : [bloco, parte],
    );
  const ativosNaParte = async (parte: number): Promise<number> =>
    Number((await tx.unsafe(`select count(*)::int as n from ${T} where bloco_id = $1 and parte = $2 and tipo = 'aluguel' and anulado_em is null`, [bloco, parte]))[0].n);
  const registros = async (): Promise<Registro[]> => {
    const temParte = await colunaParte();
    const rs = await tx.unsafe(`select ${temParte ? "parte" : "null::int as parte"}, anulado_em is null as ativo from ${T} where bloco_id = $1 order by created_at, valor desc`, [bloco]);
    return rs.map((r) => ({ parte: r.parte === null ? null : Number(r.parte), ativo: r.ativo === true }));
  };
  const colunaParte = async (): Promise<boolean> =>
    (await tx.unsafe(`select 1 from information_schema.columns where table_schema = $1 and table_name = 'pagamentos_bloco' and column_name = 'parte'`, [ESQUEMA])).length > 0;
  // Cada caso: a tabela de antes, o 1.º registro (o que já existia antes da 0348) e a 0348 inteira.
  const universo = async (): Promise<string | null> => {
    await tabelaDeAntes();
    const erroAntes = await inserir();
    if (erroAntes) return `o registro de antes da 0348 não entrou: ${erroAntes}`;
    return tentar(mig);
  };

  // Uma corrida só para o relatório: a 0348 aplica-se sem erro na forma de antes.
  const migracao = { erro: await universo() };

  // Caso 1: um 2.º registro de aluguel ativo com a mesma parte (1, o default) no mesmo bloco → recusado.
  const m1 = await universo();
  const segunda1 = await inserir(1);
  const caso1 = { erroDaMigracao: m1, segunda: segunda1, ativosNaParte1: await ativosNaParte(1) };

  // Caso 2: a parte 2 no mesmo bloco → aceita.
  const m2 = await universo();
  const parte2 = await inserir(2);
  const caso2 = { erroDaMigracao: m2, parte2, ativos: Number((await tx.unsafe(`select count(*)::int as n from ${T} where bloco_id = $1 and anulado_em is null`, [bloco]))[0].n) };

  // Caso 3: anulada a parte 1, uma nova parte 1 → aceita.
  const m3 = await universo();
  const anular = await tentar(`update ${T} set anulado_em = now(), anulado_motivo = 'registro em duplicidade' where bloco_id = $1 and parte = 1`, [bloco]);
  const novaParte1 = await inserir(1);
  const caso3 = { erroDaMigracao: m3, anular, novaParte1, ativosNaParte1: await ativosNaParte(1) };

  // Caso 4: com um complementar ativo (parte 2), o rollback de produção falha e nada muda.
  const m4 = await universo();
  const complemento = await inserir(2);
  const antes = await registros();
  const erroDoRollback = await tentar(rb);
  const caso4 = { erroDaMigracao: m4, complemento, erroDoRollback, temColunaParte: await colunaParte(), antes, depois: await registros() };

  return { migracao, caso1, caso2, caso3, caso4 };
}
