"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarUrl } from "@/lib/data/avatar-actions";
import { primeiroNome } from "@/lib/calendario-estadias";

export interface EstadiaCalendario {
  contratoId: string;
  inicio: string; // ISO
  fim: string; // ISO
  nome: string; // só o primeiro nome
  fotoUrl: string | null; // URL assinada do bucket privado; null = iniciais
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Estadias com contrato do imóvel, para as pílulas do calendário do DONO (ordem 8195c772).
 * Autorização no servidor: só o dono do imóvel. Só entram contratos ATIVOS — o contrato só existe
 * depois do aceite, então candidatura pendente nunca chega aqui (nem nome, nem foto).
 * Sem sessão, sem permissão ou erro → [] (o calendário segue mostrando só os bloqueios).
 */
export async function getEstadiasDoImovel(propertyId: string): Promise<EstadiaCalendario[]> {
  if (!UUID_RE.test(propertyId)) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: imovel } = await supabase
    .from("properties")
    .select("owner_id")
    .eq("id", propertyId)
    .maybeSingle();
  if (!imovel || imovel.owner_id !== user.id) return [];

  const { data, error } = await supabase
    .from("contratos")
    .select("id, tenant_id, status, contrato_blocos(inicio, fim)")
    .eq("property_id", propertyId)
    .eq("status", "ativo");
  if (error || !data) return [];

  const contratos = (data as Record<string, unknown>[])
    .map((c) => {
      const blocos = ((c.contrato_blocos as { inicio: string; fim: string }[] | null) ?? []).filter(
        (b) => b.inicio && b.fim,
      );
      if (blocos.length === 0) return null;
      return {
        contratoId: String(c.id),
        tenantId: String(c.tenant_id ?? ""),
        inicio: blocos.map((b) => String(b.inicio)).sort()[0],
        fim: blocos.map((b) => String(b.fim)).sort().at(-1) as string,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && UUID_RE.test(c.tenantId));
  if (contratos.length === 0) return [];

  const admin = createAdminClient();
  const ids = [...new Set(contratos.map((c) => c.tenantId))];
  const nomes = new Map<string, string>();
  if (admin) {
    const { data: perfis } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of perfis ?? []) nomes.set(String(p.id), String(p.full_name ?? ""));
  }
  // A foto passa por getAvatarUrl (podeVerAvatar: relação aceita entre dono e inquilino).
  const fotos = new Map<string, string | null>();
  await Promise.all(
    ids.map(async (id) => {
      fotos.set(id, (await getAvatarUrl({ targetId: id, propertyId })).url);
    }),
  );

  return contratos.map((c) => ({
    contratoId: c.contratoId,
    inicio: c.inicio,
    fim: c.fim,
    nome: primeiroNome(nomes.get(c.tenantId)),
    fotoUrl: fotos.get(c.tenantId) ?? null,
  }));
}
