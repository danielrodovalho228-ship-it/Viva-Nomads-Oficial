import type { Sql, TransactionSql } from "postgres";

/*
  E1208 (ORDENS-DUET 1020, 1024 e 1027) — a prova executada da 0365 nos cinco casos do coordenador.
  O texto REAL da migração e do rollback de produção corre num esquema de rascunho (`e1208_prova`) criado dentro de uma
  transação desfeita no fim. As duas tabelas são cópias das de produção (`like … including all`: as mesmas colunas, os
  mesmos checks e as mesmas chaves únicas, incluindo a de credenciamento_id), e cada caso tem o seu universo próprio. Assim
  uma 0365 adulterada não esbarra em linhas de outras specs nem rebenta noutro caso: cai na asserção do caso que fere.
   - caso 1: a linha curada sem ligação + o credenciamento do mesmo número → fica ligada;
   - caso 2: a 0365 corrida outra vez → nenhuma linha muda;
   - caso 3: uma linha curada cujo número NÃO tem credenciamento igual, ao lado de um credenciamento livre (sem linha
     curada nenhuma) → não liga;
   - caso 4: um credenciamento que já tem uma linha ligada (por outro número) + uma 2.ª linha com o número dele, ao lado
     do credenciamento livre → a 0365 corre sem erro e a 2.ª linha não é ligada;
   - caso 5: o rollback de produção depois da 0365 → desliga só a ligação por número; nome, cidade, selo e publicação
     ficam; a ligação que não é por número fica.
*/
const ESQUEMA = "e1208_prova";
const TABELAS = ["avaliadores_credenciamento", "avaliadores_perfil_publico"] as const;

/** O texto SQL de produção, apontado para as cópias do esquema de rascunho. */
export const noRascunho = (texto: string): string =>
  TABELAS.reduce((q, t) => q.replaceAll(`public.${t}`, `${ESQUEMA}.${t}`), texto);

export type ProvaDa0365 = {
  caso1: { antes: string | null; depois: string | null; credenciamento: string };
  caso2: { reaplicada: number };
  caso3: { ligada: string | null };
  caso4: { erro: string | null; jaLigada: string | null; credenciamento: string; segunda: string | null };
  caso5: { erro: string | null; antes: Linha; depois: Linha; outraLigacao: string | null; credenciamentoDaOutra: string };
};
type Linha = { credenciamento_id: string | null; nome_publico: string; cidade: string; selo: string; publicado: boolean };

class Desfazer extends Error {}

/** Corre a 0365 e o rollback (textos de produção) nos cinco casos e devolve o que viu. Nada fica no banco. */
export async function provarA0365(sql: Sql, migracao: string, rollback: string): Promise<ProvaDa0365> {
  let visto: ProvaDa0365 | null = null;
  await sql
    .begin(async (tx) => {
      await tx.unsafe(`create schema ${ESQUEMA}`);
      for (const t of TABELAS) await tx.unsafe(`create table ${ESQUEMA}.${t} (like public.${t} including all)`);
      visto = await cincoCasos(tx, noRascunho(migracao), noRascunho(rollback));
      throw new Desfazer();
    })
    .catch((e) => {
      if (!(e instanceof Desfazer)) throw e;
    });
  if (!visto) throw new Error("a prova da 0365 não correu");
  return visto;
}

async function cincoCasos(tx: TransactionSql, mig: string, rb: string): Promise<ProvaDa0365> {
  const limpar = () => tx.unsafe(`truncate ${ESQUEMA}.avaliadores_perfil_publico, ${ESQUEMA}.avaliadores_credenciamento`);
  const cred = async (numero: string): Promise<string> =>
    (
      await tx.unsafe(
        `insert into ${ESQUEMA}.avaliadores_credenciamento (parceiro_id, cidade, numero_credenciado, conduta_versao, experiencia_link)
         values (gen_random_uuid(), 'Curadopolis', $1, '2026-10-23', 'https://portfolio.lab.vivanomads.test/t1793') returning id`,
        [numero],
      )
    )[0].id as string;
  const curada = (numero: string, ligadaA: string | null = null) =>
    tx.unsafe(
      `insert into ${ESQUEMA}.avaliadores_perfil_publico (numero, nome_publico, cidade, selo, credenciamento_id)
       values ($1, 'Rosa Curada Silva', 'Curadopolis', 'Selo curado da t1793', $2)`,
      [numero, ligadaA],
    );
  const linha = async (numero: string): Promise<Linha> =>
    (await tx.unsafe(`select credenciamento_id, nome_publico, cidade, selo, publicado from ${ESQUEMA}.avaliadores_perfil_publico where numero = $1`, [numero]))[0] as unknown as Linha;
  // A 0365 num ponto de retorno: um erro (ex.: a chave única) fica registado e não derruba a transação.
  const aplicar = async (texto: string): Promise<{ erro: string | null; linhas: number }> => {
    try {
      const r = await tx.savepoint((sp) => sp.unsafe(texto));
      return { erro: null, linhas: (r as unknown as { count: number }).count };
    } catch (e) {
      return { erro: e instanceof Error ? e.message : String(e), linhas: 0 };
    }
  };

  // Casos 1 e 2: a linha e o credenciamento do mesmo número; depois, a 0365 outra vez.
  await limpar();
  const c1 = await cred("UDI-101");
  await curada("UDI-101");
  const antes1 = (await linha("UDI-101")).credenciamento_id;
  await aplicar(mig);
  const depois1 = (await linha("UDI-101")).credenciamento_id;
  const reaplicada = (await aplicar(mig)).linhas;

  // Caso 3: o número da linha não tem credenciamento igual; há um credenciamento livre, sem linha curada nenhuma.
  await limpar();
  await cred("UDI-303"); // o 3.º credenciamento, livre
  await curada("UDI-301");
  await aplicar(mig);
  const ligada3 = (await linha("UDI-301")).credenciamento_id;

  // Caso 4: o credenciamento já tem uma linha ligada (por outro número); a 2.ª linha tem o número dele; o livre ao lado.
  await limpar();
  const c4 = await cred("UDI-401");
  await cred("UDI-403"); // o 3.º credenciamento, livre
  await curada("UDI-499", c4);
  await curada("UDI-401");
  const r4 = await aplicar(mig);
  const jaLigada = (await linha("UDI-499")).credenciamento_id;
  const segunda = (await linha("UDI-401")).credenciamento_id;

  // Caso 5: a 0365 liga pelo número; o rollback desliga só essa; a ligação por outro número fica.
  await limpar();
  await cred("UDI-501");
  const c5b = await cred("UDI-502");
  await curada("UDI-501");
  await curada("UDI-599", c5b);
  const antes5 = await linha("UDI-501");
  await aplicar(mig);
  const r5 = await aplicar(rb);
  const depois5 = await linha("UDI-501");
  const outra = (await linha("UDI-599")).credenciamento_id;

  return {
    caso1: { antes: antes1, depois: depois1, credenciamento: c1 },
    caso2: { reaplicada },
    caso3: { ligada: ligada3 },
    caso4: { erro: r4.erro, jaLigada, credenciamento: c4, segunda },
    caso5: { erro: r5.erro, antes: antes5, depois: depois5, outraLigacao: outra, credenciamentoDaOutra: c5b },
  };
}
