/*
  E197 — Admin › contrato: a lista lê as datas de assinatura do próprio contrato (assinado_*_em) e o detalhe lia SÓ os
  registros com hash (contrato_assinaturas). Contrato com as datas gravadas e sem o registro com hash (hoje só contratos
  de teste montados direto no banco) aparecia na lista "Assinado pelas duas partes" e no detalhe "Nenhuma assinatura
  ainda". Agora o detalhe junta as duas fontes: o registro com hash vale; sem ele, a data do contrato aparece com o aviso
  de que falta o hash. O pacote de provas segue só com os registros com hash (é prova).
  PURO. Roda: node --test src/lib/admin/assinaturas-admin.test.ts
*/
import type { ComparacaoHash } from "../contrato-assinar.ts";

export type PapelAssinatura = "proprietario" | "inquilino";

export interface AssinaturaAdmin {
  papel: PapelAssinatura;
  em: string;
  /** null quando só existe a data no contrato (sem o registro com hash). */
  hash: string | null;
  comparacao: ComparacaoHash | null;
}

export const TEXTO_SEM_HASH = "Sem o registro do hash do resumo assinado: só a data gravada no contrato.";

export function assinaturasDoAdmin(
  registros: readonly { papel: PapelAssinatura; em: string; hash: string; comparacao: ComparacaoHash }[],
  colunas: { proprietario: string | null; inquilino: string | null },
): AssinaturaAdmin[] {
  const out: AssinaturaAdmin[] = registros.map((r) => ({ ...r }));
  for (const papel of ["proprietario", "inquilino"] as const) {
    const em = colunas[papel];
    if (em && !out.some((a) => a.papel === papel)) out.push({ papel, em, hash: null, comparacao: null });
  }
  return out.sort((a, b) => (a.em < b.em ? -1 : 1));
}
