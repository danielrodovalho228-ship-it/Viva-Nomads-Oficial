"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { localDaEntrada } from "@/lib/data/local-trabalho";

export type ResultadoLocal = { ok: true; rotulo: string | null } | { ok: false; erro: string };

/**
 * Salva (ou apaga, com `null`) o "Meu local de trabalho" da pessoa logada. Gravado pelo servidor (o cliente não tem
 * permissão na coluna); destino cadastrado só se estiver ativo, com o ponto dele.
 */
export async function salvarLocalTrabalho(entrada: { destinoSlug?: string; lat?: number; lng?: number; rotulo?: string; modo?: string; ate?: number } | null): Promise<ResultadoLocal> {
  const supabase = await createClient();
  if (!supabase) return { ok: false, erro: "Não foi possível salvar agora. Tente de novo em instantes." };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Entre na sua conta para salvar o local de trabalho." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, erro: "Não foi possível salvar agora. Tente de novo em instantes." };

  const local = await localDaEntrada(admin, entrada);
  if (local === "invalido") return { ok: false, erro: "Escolha o local na lista de sugestões." };
  const { error } = await admin.from("profiles").update({ local_trabalho: local }).eq("id", user.id);
  if (error) return { ok: false, erro: "Não foi possível salvar agora. Tente de novo em instantes." };
  return { ok: true, rotulo: local?.rotulo ?? null };
}
