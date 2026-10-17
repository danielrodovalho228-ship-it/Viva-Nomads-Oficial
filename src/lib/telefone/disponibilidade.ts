import "server-only";
import { integracoesSimuladas } from "@/lib/integracoes";
import { provedorSmsPronto } from "@/lib/telefone/telefone";

export interface DisponibilidadeSms {
  disponivel: boolean;
  /** Laboratório (INTEGRACOES_SIMULADAS): código fixo, nada sai para a rede. Nunca em produção. */
  simulado: boolean;
}

let cache: { em: number; pronto: boolean } | null = null;
const VALIDADE_MS = 10 * 60 * 1000;

/**
 * O Supabase está com o provedor de SMS configurado (pelo Daniel, no painel)? Lê GET /auth/v1/settings
 * (público, sem segredo) e guarda por 10 min. Sem provedor → "Verificação de telefone em breve", sem erro.
 */
export async function smsDisponivel(): Promise<DisponibilidadeSms> {
  if (integracoesSimuladas()) return { disponivel: true, simulado: true };
  if (cache && Date.now() - cache.em < VALIDADE_MS) return { disponivel: cache.pronto, simulado: false };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let pronto = false;
  if (url && anon) {
    try {
      const r = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon }, cache: "no-store", signal: AbortSignal.timeout(4000) });
      pronto = r.ok && provedorSmsPronto(await r.json());
    } catch {
      pronto = false;
    }
  }
  cache = { em: Date.now(), pronto };
  return { disponivel: pronto, simulado: false };
}
