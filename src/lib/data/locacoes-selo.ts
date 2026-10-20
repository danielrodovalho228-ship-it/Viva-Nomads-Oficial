"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvatarUrl } from "@/lib/data/avatar-actions";
import { rotuloSeloEstadia } from "@/lib/calendario-estadias";

export interface SeloEstadia {
  /** Primeiro nome do anfitrião ou "Sua estadia". */
  rotulo: string;
  /** URL assinada do bucket privado (foto pública do dono no contexto do imóvel); null = iniciais. */
  fotoUrl: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Selo do anfitrião em /dashboard/locacoes (ordem 8195c772 item 2). Autorização no servidor: só os
 * contratos em que o usuário logado é o INQUILINO (o id vem do cliente, mas o filtro é pela sessão).
 * Contrato inexistente, de outro inquilino ou erro → sem entrada (a tela mostra "Sua estadia").
 */
export async function getSelosDasLocacoes(contratoIds: string[]): Promise<Record<string, SeloEstadia>> {
  const ids = [...new Set(contratoIds.filter((id) => UUID_RE.test(id)))].slice(0, 50);
  if (ids.length === 0) return {};
  const supabase = await createClient();
  if (!supabase) return {};
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("contratos")
    .select("id, property_id, properties(owner_id)")
    .in("id", ids)
    .eq("tenant_id", user.id);
  if (error || !data) return {};

  const contratos = (data as unknown as { id: string; property_id: string; properties: { owner_id?: string } | null }[])
    .map((c) => ({ contratoId: String(c.id), propertyId: String(c.property_id), donoId: String(c.properties?.owner_id ?? "") }))
    .filter((c) => UUID_RE.test(c.donoId));
  if (contratos.length === 0) return {};

  const nomes = new Map<string, string>();
  const admin = createAdminClient();
  if (admin) {
    const { data: perfis } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", [...new Set(contratos.map((c) => c.donoId))]);
    for (const p of perfis ?? []) nomes.set(String(p.id), String(p.full_name ?? ""));
  }

  const out: Record<string, SeloEstadia> = {};
  await Promise.all(
    contratos.map(async (c) => {
      const foto = (await getAvatarUrl({ targetId: c.donoId, propertyId: c.propertyId })).url;
      out[c.contratoId] = { rotulo: rotuloSeloEstadia(nomes.get(c.donoId)), fotoUrl: foto };
    }),
  );
  return out;
}
