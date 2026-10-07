/*
  Exclusão de conta — o passo de CONFIRMAR, sem banco (testável com node --test).
  O banco e o Auth entram por `DepsExclusao`; quem liga é lib/data/account-delete.

  Regra do link: ele é marcado como usado ANTES de apagar (uso único, sem
  corrida). Se a exclusão FALHAR por erro nosso, o link é LIBERADO de novo — a
  pessoa tenta outra vez pelo mesmo link enquanto ele valer (30 min). Antes, a
  falha "gastava" o link e o pedido de exclusão morria sem a pessoa saber.
*/

export interface DepsExclusao {
  /** Marca o pedido como usado (atômico). false = link inválido, expirado ou já usado. */
  marcarUsado(): Promise<boolean>;
  /** Devolve o pedido (usado_em = null) para o link valer de novo. */
  liberar(): Promise<void>;
  /** E-mail atual da conta; null se a conta já não existe. */
  emailAtual(): Promise<string | null>;
  situacao(): Promise<{ temHistorico: boolean; temAtivo: boolean }>;
  /** Anonimiza (conta com histórico de contratos). true = deu certo. */
  anonimizar(): Promise<boolean>;
  /** Apaga a conta (cascata). true = deu certo. */
  apagar(): Promise<boolean>;
}

export interface ResultadoExclusao {
  ok: boolean;
  error?: string;
  blocked?: boolean;
  anonymized?: boolean;
}

export const LINK_INVALIDO = "Link inválido, expirado ou já usado. Peça um novo.";
export const FALHA_TENTE_DE_NOVO =
  "Não foi possível excluir agora. Tente de novo pelo mesmo link (ele vale por 30 minutos) ou peça um novo.";
export const FALHA_HISTORICO =
  "No momento não é possível excluir contas com histórico de contratos por aqui. " +
  "Fale conosco pelos canais oficiais para concluir.";
export const BLOQUEIO_ATIVO =
  "Você tem uma locação ou contrato ativo. Encerre a locação antes de excluir a conta — " +
  "assim preservamos os registros exigidos enquanto o contrato está em vigor.";

/** `emailDoToken` já normalizado. */
export async function confirmarExclusao(d: DepsExclusao, emailDoToken: string): Promise<ResultadoExclusao> {
  const invalido = { ok: false, error: LINK_INVALIDO };
  if (!(await d.marcarUsado().catch(() => false))) return invalido;

  // Daqui em diante, qualquer falha NOSSA devolve o link.
  const falhou = async (error: string): Promise<ResultadoExclusao> => {
    await d.liberar().catch(() => {});
    return { ok: false, error };
  };

  try {
    const email = await d.emailAtual();
    if (email === null) return { ok: true }; // já não existe: idempotente
    if (email !== emailDoToken) return invalido; // a conta mudou de e-mail: o link não vale

    const { temHistorico, temAtivo } = await d.situacao();
    // (1) Locação/contrato ATIVO → bloqueia (encerre antes). O link fica usado:
    // não é falha nossa, e um novo pedido é o caminho depois de encerrar.
    if (temAtivo) return { ok: false, blocked: true, error: BLOQUEIO_ATIVO };

    // (2) Histórico de contratos → ANONIMIZA (retenção legal), não apaga.
    if (temHistorico) {
      if (!(await d.anonimizar())) return falhou(FALHA_HISTORICO);
      return { ok: true, anonymized: true };
    }

    // (3) Sem contratos → apaga de fato.
    if (!(await d.apagar())) return falhou(FALHA_TENTE_DE_NOVO);
    return { ok: true };
  } catch {
    return falhou(FALHA_TENTE_DE_NOVO);
  }
}
