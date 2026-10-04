import type { createClient } from "@/lib/supabase/server";
import { planoEfetivo } from "@/lib/fundador";
import type { PlanoId } from "@/config/planos";

type Cliente = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/**
 * Plano que vale AGORA para o proprietário (server-only): assinatura ATIVA; sem
 * ela, Profissional enquanto Fundador nos 12 meses grátis; senão, Gratuito.
 * Fonte única para limite de anúncios e comissão congelada no aceite.
 */
export async function planoDoProprietario(cliente: Cliente, ownerId: string): Promise<PlanoId> {
  const [{ data: sub }, { data: perfil }] = await Promise.all([
    cliente
      .from("subscriptions")
      .select("plan")
      .eq("owner_id", ownerId)
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle(),
    cliente.from("profiles").select("fundador, fundador_em").eq("id", ownerId).maybeSingle(),
  ]);
  return planoEfetivo(
    (sub?.plan as string | undefined) ?? null,
    (perfil?.fundador as boolean | undefined) ?? false,
    (perfil?.fundador_em as string | undefined) ?? null
  ) as PlanoId;
}
