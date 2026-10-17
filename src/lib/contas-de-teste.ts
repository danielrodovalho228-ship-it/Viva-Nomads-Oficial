import type { SupabaseClient } from "@supabase/supabase-js";
import type { CafResult } from "@/lib/closing";
import type { CommissionResult } from "@/lib/payments/asaas";
import type { ContractResult } from "@/lib/integrations/zapsign";
import { valorComissao } from "./comissao.ts";

/**
 * Contas de QA (profiles.is_teste, migração 0135) não geram efeito real em produção (ordem ee7d27b8):
 * a cobrança da comissão, o contrato no ZapSign e a verificação de identidade viram resultado SIMULADO,
 * com o rótulo TESTE. Só o servidor decide: o navegador nunca diz "sou conta de teste".
 */
export const ROTULO_TESTE = "TESTE";
export const NOTA_VERIFICACAO_TESTE = "TESTE — verificação simulada";
/** Conta real, verificação ainda sem parceiro: mensagem honesta, sem travar o resto da plataforma. */
export const MSG_VERIFICACAO_EM_BREVE = "A verificação de identidade abre em breve. Você pode continuar usando a plataforma normalmente.";

const idSimulado = (prefixo: string) => `${prefixo}_${Math.random().toString(36).slice(2, 10)}`;

/** Lê profiles.is_teste com o cliente de serviço. Sem cliente, sem perfil ou com erro: false (conta real). */
export async function contaEhDeTeste(admin: SupabaseClient | null, userId: string | null | undefined): Promise<boolean> {
  if (!admin || !userId) return false;
  try {
    const { data } = await admin.from("profiles").select("is_teste").eq("id", userId).maybeSingle();
    return data?.is_teste === true;
  } catch {
    return false;
  }
}

export function laudoSimuladoTeste(): CafResult {
  return {
    light: "green",
    identity: true,
    liveness: true,
    document: true,
    coversForeigners: true,
    demo: true,
    notes: [NOTA_VERIFICACAO_TESTE],
  };
}

export function cobrancaSimuladaTeste(p: { aluguelMensal: number; meses: number; commissionRate: number }): CommissionResult & { rotulo: string } {
  return {
    demo: true,
    rotulo: ROTULO_TESTE,
    chargeId: idSimulado("teste"),
    baseAluguel: p.aluguelMensal,
    commissionRate: p.commissionRate,
    platformCommission: valorComissao(p.aluguelMensal, p.meses, p.commissionRate),
    status: "TESTE_SIMULADA",
  };
}

export function contratoSimuladoTeste(): ContractResult & { rotulo: string } {
  return { demo: true, rotulo: ROTULO_TESTE, docId: idSimulado("teste"), status: "pending" };
}
