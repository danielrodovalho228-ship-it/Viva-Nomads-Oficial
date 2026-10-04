/*
  Processamento dos avisos do Asaas (webhook). Módulo PURO: o acesso ao banco
  entra por `RepoAsaas`, para testar sem Supabase (asaas-webhook.test.ts).

  Eventos tratados:
    PAYMENT_CONFIRMED / PAYMENT_RECEIVED
      • pagamento de ASSINATURA (payment.subscription) → assinatura 'active'
        até 1 mês depois do vencimento pago (o plano passa a valer);
      • pagamento AVULSO de comissão de fechamento (payment.id gravado em
        cobrancas_fechamento.externo_id) → cobrança 'pago'.
    PAYMENT_OVERDUE
      • assinatura → 'overdue' (o plano deixa de valer);
      • comissão → 'vencido'.
  Demais eventos: só confirmados como recebidos.

  Idempotência por (payment.id, evento): o Asaas reenvia o mesmo aviso; só o
  primeiro altera o banco. Se o processamento falhar, o registro é desfeito
  para o Asaas tentar de novo.
*/

export type EventoTratado = "PAYMENT_CONFIRMED" | "PAYMENT_RECEIVED" | "PAYMENT_OVERDUE";

export interface PagamentoAsaas {
  id?: string;
  subscription?: string | null;
  dueDate?: string | null; // AAAA-MM-DD
  paymentDate?: string | null;
  value?: number;
}

export interface AvisoAsaas {
  event?: string;
  payment?: PagamentoAsaas | null;
}

export interface RepoAsaas {
  /** Registra (payment, evento). false = já processado antes. */
  registrarEvento(chave: string, evento: string, paymentId: string): Promise<boolean>;
  /** Desfaz o registro (processamento falhou → o Asaas reenviará). */
  desfazerEvento(chave: string): Promise<void>;
  /** Atualiza a assinatura pelo id do Asaas. Devolve true se achou a linha. */
  atualizarAssinatura(
    gatewaySubscriptionId: string,
    dados: { status: "active" | "overdue"; current_period_end?: string }
  ): Promise<boolean>;
  /** Atualiza a comissão de fechamento pelo id da cobrança. true se achou. */
  atualizarCobranca(
    paymentId: string,
    dados: { status: "pago" | "vencido"; pago_em?: string | null }
  ): Promise<boolean>;
}

export type ResultadoAviso =
  | { ok: true; acao: "ignorado" | "duplicado" | "assinatura" | "cobranca" | "sem_alvo" }
  | { ok: false; erro: string };

const TRATADOS: EventoTratado[] = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE"];

/** Vencimento + 1 mês (fim do período pago), em ISO. */
export function fimDoPeriodo(dueDate: string | null | undefined, agora = new Date()): string {
  const base = dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? new Date(`${dueDate}T23:59:59Z`) : agora;
  const fim = new Date(base);
  fim.setUTCMonth(fim.getUTCMonth() + 1);
  return fim.toISOString();
}

export async function processarAvisoAsaas(
  aviso: AvisoAsaas,
  repo: RepoAsaas,
  agora = new Date()
): Promise<ResultadoAviso> {
  const evento = aviso.event as EventoTratado;
  if (!TRATADOS.includes(evento)) return { ok: true, acao: "ignorado" };
  const pagamento = aviso.payment ?? {};
  const paymentId = String(pagamento.id ?? "").trim();
  if (!paymentId) return { ok: false, erro: "Aviso sem payment.id." };

  const chave = `${paymentId}:${evento}`;
  if (!(await repo.registrarEvento(chave, evento, paymentId))) return { ok: true, acao: "duplicado" };

  try {
    const pago = evento !== "PAYMENT_OVERDUE";
    const subId = String(pagamento.subscription ?? "").trim();
    if (subId) {
      const achou = await repo.atualizarAssinatura(
        subId,
        pago ? { status: "active", current_period_end: fimDoPeriodo(pagamento.dueDate, agora) } : { status: "overdue" }
      );
      return { ok: true, acao: achou ? "assinatura" : "sem_alvo" };
    }
    const achou = await repo.atualizarCobranca(
      paymentId,
      pago
        ? { status: "pago", pago_em: pagamento.paymentDate ? `${pagamento.paymentDate}T12:00:00Z` : agora.toISOString() }
        : { status: "vencido" }
    );
    return { ok: true, acao: achou ? "cobranca" : "sem_alvo" };
  } catch (e) {
    await repo.desfazerEvento(chave).catch(() => {});
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao processar." };
  }
}
