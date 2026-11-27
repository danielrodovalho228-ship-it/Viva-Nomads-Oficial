/*
  E1182 (ORDEM-DUET-791) — a leitura de cada gravação na fila da equipe (`vistoria_fila_admin`).
  A rotina do laudo gravava o item sem olhar o erro. Quando o banco recusou quatro tipos (da migração 0313 à 0363), ela
  marcou o pedido, não gravou o item e não disse nada. Aqui toda gravação é lida:
   · deu certo            → o item entrou;
   · já havia item aberto → não é falha (o índice único deixa um só por tipo e referência) nem inserção;
   · qualquer outro erro  → falha: fica registada no servidor e quem chamou desfaz o que marcou.
  PURO (node --test), sem imports @/.
*/
export const REGISTRO_DA_FALHA_NA_FILA = "[fila da equipe] item não gravado";

/** O código do Postgres para "já existe" (violação de índice único). */
const JA_EXISTE = "23505";

export interface GravacaoNaFila {
  /** ESTA gravação pôs o item na fila. */
  inserido: boolean;
  /** A mensagem do banco quando a gravação falhou; `null` se entrou ou se o item já existia. */
  erro: string | null;
}

/** Lê o resultado de uma gravação na fila. A falha fica registada com o tipo, a referência e a mensagem do banco. */
export function lerGravacaoNaFila(error: { code?: string; message: string } | null, item: { tipo: string; pedidoId?: string | null; avaliadorId?: string | null }): GravacaoNaFila {
  if (!error) return { inserido: true, erro: null };
  if (error.code === JA_EXISTE) return { inserido: false, erro: null };
  console.error(`${REGISTRO_DA_FALHA_NA_FILA}: tipo ${item.tipo}, pedido ${item.pedidoId ?? "—"}, avaliador ${item.avaliadorId ?? "—"}: ${error.message}`);
  return { inserido: false, erro: error.message };
}

/**
 * Marca (o pedido atrasado, a devolução vencida), grava o item na fila e, se a gravação falhar, DESFAZ a marca: a rotina
 * volta a tentar no tique seguinte, em vez de deixar a marca sem o item. A equipe só é avisada se ESTA chamada inseriu
 * (item que já existia não avisa de novo — a regra do E1149).
 */
export async function marcarComItemNaFila(p: {
  marcar: () => PromiseLike<unknown>;
  gravar: () => Promise<GravacaoNaFila>;
  desmarcar: () => PromiseLike<unknown>;
  avisar: () => Promise<unknown>;
}): Promise<"inserido" | "ja_existia" | "falhou"> {
  await p.marcar();
  const gravada = await p.gravar();
  if (gravada.erro) {
    try {
      await p.desmarcar();
    } catch (e) {
      console.error(`${REGISTRO_DA_FALHA_NA_FILA}: a marca não foi desfeita: ${e instanceof Error ? e.message : String(e)}`);
    }
    return "falhou";
  }
  if (!gravada.inserido) return "ja_existia";
  await p.avisar();
  return "inserido";
}
