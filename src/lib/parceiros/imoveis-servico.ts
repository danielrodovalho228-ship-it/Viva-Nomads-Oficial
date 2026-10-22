import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Imóveis que a pessoa pode ligar a um pedido de serviço: os dela (dona) e o da estadia ativa (morador).
 * Lido pelo servidor junto com a página do parceiro (correção do 31b, QA 21/10): a folha "Solicitar orçamento" não
 * chama ação nenhuma ao abrir — uma ação que regrava o cookie da sessão atualizava a rota e fechava a folha.
 */
export async function imoveisParaServico(userId: string): Promise<{ id: string; titulo: string }[]> {
  const admin = createAdminClient();
  if (!admin) return [];
  const [{ data: donos }, { data: estadias }] = await Promise.all([
    admin.from("properties").select("id, title").eq("owner_id", userId).order("created_at", { ascending: false }).limit(50),
    admin.from("contratos").select("property_id, properties(title)").eq("tenant_id", userId).eq("status", "ativo").limit(5),
  ]);
  const lista = new Map<string, string>();
  for (const p of (donos ?? []) as { id: string; title: string | null }[]) lista.set(p.id, p.title ?? "Imóvel");
  for (const k of (estadias ?? []) as unknown as { property_id: string; properties: { title: string | null } | null }[]) if (!lista.has(k.property_id)) lista.set(k.property_id, k.properties?.title ?? "Imóvel da estadia");
  return [...lista].map(([id, titulo]) => ({ id, titulo }));
}
