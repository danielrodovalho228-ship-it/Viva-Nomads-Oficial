import { cookies } from "next/headers";
import { VISTORIA_ATIVA } from "@/lib/flags";
import { integracoesSimuladas } from "@/lib/integracoes";
import { createClient } from "@/lib/supabase/server";
import type { createAdminClient } from "@/lib/supabase/admin";
import { chaveAberta, chaveAbertaParaOMorador, modoDaChave, type ModoDaChave } from "./ambito-da-chave";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** Cookie que liga a avaliação SÓ no laboratório (INTEGRACOES_SIMULADAS; nunca em produção), para o E2E. */
export const COOKIE_LAB_VISTORIA = "vn_lab_vistoria";

async function cookieDoLaboratorio(): Promise<boolean> {
  if (!integracoesSimuladas()) return false;
  try {
    return (await cookies()).get(COOKIE_LAB_VISTORIA)?.value === "1";
  } catch {
    return false;
  }
}

/** E1077: a conta da sessão está na lista do piloto? Sem sessão, sem pedido (cron) ou com erro de leitura: não. */
async function contaNoPiloto(): Promise<boolean> {
  try {
    const supabase = await createClient();
    if (!supabase) return false;
    const { data, error } = await supabase.rpc("vistoria_no_piloto");
    return !error && data === true;
  } catch {
    return false;
  }
}

/** E1077: em que modo a chave está para a conta desta sessão (global, laboratório, piloto ou desligada). */
export async function modoDaChaveAtual(): Promise<ModoDaChave> {
  if (VISTORIA_ATIVA) return "global";
  const laboratorio = await cookieDoLaboratorio();
  return modoDaChave({ global: false, laboratorio, noPiloto: laboratorio ? false : await contaNoPiloto() });
}

/**
 * A chave VISTORIA_ATIVA vale no servidor. No laboratório o teste liga só no próprio navegador (cookie), sem mudar o
 * resto da rodada; em produção o cookie não vale nada. E1077: com a chave desligada, abre também para a conta da sessão
 * que está no piloto (vistoria_piloto) — e só para ela.
 */
export async function vistoriaAtiva(): Promise<boolean> {
  return chaveAberta(await modoDaChaveAtual());
}

/**
 * E1171 (ORDEM-DUET-746): a chave para o MORADOR do imóvel ocupado, que concorda com a visita de um pedido do dono. Vale
 * a chave da sessão dele ou, no piloto, o DONO do pedido estar na lista (vistoria_piloto) — o morador nunca está nela.
 * Quem chama já conferiu que o pedido é deste morador. A leitura que falha fecha, nunca abre.
 */
export async function vistoriaAtivaParaOMorador(admin: Admin, donoDoPedido: string | null | undefined): Promise<boolean> {
  const modo = await modoDaChaveAtual();
  if (chaveAberta(modo)) return true;
  if (!donoDoPedido) return false;
  const { data, error } = await admin.from("vistoria_piloto").select("user_id").eq("user_id", donoDoPedido).maybeSingle();
  return chaveAbertaParaOMorador(modo, !error && !!data);
}
