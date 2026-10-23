import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estadosIdentidade } from "@/lib/identidade/estado-servidor";
import { triagemVinculoAtiva } from "./chave";
import { textoParaDono, type LinhaVinculo } from "./vinculo";

/**
 * Prompt 52 — o selo "Morador verificado" do candidato de UMA candidatura, para a tela do dono (proposta). Só com a
 * chave; só para o dono daquela candidatura. Devolve só o texto do selo: nunca o arquivo, o caminho ou valores.
 */
export async function seloDoCandidato(leadId: string): Promise<string | null> {
  if (!(await triagemVinculoAtiva()) || !/^[0-9a-f-]{36}$/i.test(leadId)) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: lead } = await admin.from("leads").select("owner_id, tenant_id").eq("id", leadId).maybeSingle();
  if (!lead || lead.owner_id !== user.id) return null;
  const tenantId = lead.tenant_id as string;
  const [identidades, { data: v }] = await Promise.all([
    estadosIdentidade(admin, [tenantId]),
    admin.from("triagem_vinculos").select("tipo, status, motivo, decidido_em, valido_ate, enviado_em").eq("user_id", tenantId).order("enviado_em", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return textoParaDono(identidades.get(tenantId) ?? null, (v as LinhaVinculo | null) ?? null, new Date());
}
