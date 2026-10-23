"use server";

/*
  Adendo 59.1, Parte A — leitura do nível para o passo Comodidades do cadastro. Devolve as entradas do cálculo (itens com
  foto, medidas por ponto, ruído e pendências) para a tela recalcular o nível com o padrão mínimo que o dono está
  marcando agora, antes de salvar. Só o dono do imóvel lê; a gravação de cada item segue por salvarItemNivel (Pista B).
*/
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { entradaDoNivel } from "@/lib/niveis/servidor";
import type { EntradaNivel, StatusFoto } from "@/lib/niveis/regras";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EntradaNivelCadastro {
  itens: EntradaNivel["itens"];
  medidas: EntradaNivel["medidas"];
  ruido: EntradaNivel["ruido"];
  bloqueadas: EntradaNivel["bloqueadas"];
  /** Situação da foto de cada item (para mostrar "recusada" com o motivo). */
  fotos: { chave: string; status: StatusFoto; motivo: string | null }[];
}

export async function entradaNivelDoCadastro(propertyId: string): Promise<EntradaNivelCadastro | null> {
  if (!UUID.test(propertyId ?? "")) return null;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: dono } = await supabase.from("properties").select("owner_id").eq("id", propertyId).maybeSingle();
  if (dono?.owner_id !== user.id) return null;
  try {
    const [e, fotos] = await Promise.all([
      entradaDoNivel(admin, propertyId),
      admin.from("nivel_itens").select("chave, foto_status, motivo_recusa").eq("property_id", propertyId),
    ]);
    return {
      itens: e.itens,
      medidas: e.medidas,
      ruido: e.ruido,
      bloqueadas: e.bloqueadas,
      fotos: ((fotos.data ?? []) as { chave: string; foto_status: StatusFoto; motivo_recusa: string | null }[]).map((f) => ({ chave: f.chave, status: f.foto_status, motivo: f.motivo_recusa })),
    };
  } catch {
    return null;
  }
}
