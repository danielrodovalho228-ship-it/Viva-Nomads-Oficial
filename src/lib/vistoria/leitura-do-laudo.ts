/*
  E1121 (ORDEM-DUET-523) — quem lê o PDF do laudo de avaliação, e por que um pedido fica sem resposta. Regras PURAS
  (node --test), usadas pela rota /api/vistoria/laudo/[id].
  Leem: o dono do imóvel do laudo, o avaliador que o assinou (pela conta do parceiro) e o admin com as duas etapas — a
  mesma regra que abre a Central, onde o link do laudo aparece em "Laudos recentes".
*/

export interface PedidoDeLeitura {
  /** A conta que pede o arquivo. */
  leitor: string;
  /** O dono do imóvel do laudo. */
  dono: string | null;
  /** A conta do parceiro do avaliador que assinou o laudo. */
  contaDoAvaliador: string | null;
  /** A sessão é de admin com as duas etapas (ehAdmin)? */
  admin: boolean;
}

export function podeLerLaudo(p: PedidoDeLeitura): boolean {
  if (!p.leitor) return false;
  return p.admin || p.leitor === p.dono || p.leitor === p.contaDoAvaliador;
}

export type MotivoSemLaudo = "sem_laudo" | "sem_permissao" | "sem_arquivo" | "arquivo_ausente";

/**
 * O motivo do 404, para o log do servidor (a resposta é a mesma em todos: a rota não diz se o laudo existe):
 * sem_laudo (o id não é de laudo), sem_permissao (a conta não pode ler), sem_arquivo (o laudo foi emitido sem o PDF
 * guardado) e arquivo_ausente (o caminho existe, o arquivo não veio). `null` = pode entregar.
 */
export function motivoSemLaudo(e: { existe: boolean; pode: boolean; temCaminho: boolean; baixou: boolean }): MotivoSemLaudo | null {
  if (!e.existe) return "sem_laudo";
  if (!e.pode) return "sem_permissao";
  if (!e.temCaminho) return "sem_arquivo";
  if (!e.baixou) return "arquivo_ausente";
  return null;
}
