/**
 * "Meu local de trabalho" (prompt 37) — leitura e validação no servidor. O dado é privado: fica em
 * profiles.local_trabalho, que só a própria pessoa lê (RLS do perfil) e só o servidor grava.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { EstadoDestino } from "@/lib/busca/destino-busca";
import { ATE_OPCOES, ehModo, rotuloLimpo, type ModoRota } from "@/lib/rotas/tempo";

export interface LocalTrabalho {
  destino_id?: string;
  rotulo: string;
  lat: number;
  lng: number;
  modo_preferido: ModoRota;
  ate?: number;
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/** O que fica gravado: endereço digitado com 3 casas no máximo e rótulo sem número de casa. */
export function normalizarLocal(j: unknown): LocalTrabalho | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const lat = Number(o.lat);
  const lng = Number(o.lng);
  const rotulo = rotuloLimpo(String(o.rotulo ?? ""));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -34 || lat > 6 || lng < -75 || lng > -28 || rotulo.length < 2) return null;
  const out: LocalTrabalho = {
    rotulo,
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
    modo_preferido: ehModo(o.modo_preferido) ? o.modo_preferido : "carro",
  };
  if (typeof o.destino_id === "string" && /^[0-9a-f-]{36}$/.test(o.destino_id)) out.destino_id = o.destino_id;
  const ate = Number(o.ate);
  if ((ATE_OPCOES as readonly number[]).includes(ate)) out.ate = ate;
  return out;
}

/** Local salvo → estado da busca (destino cadastrado vira o slug; endereço vira o ponto da URL). */
export async function estadoDoLocal(local: LocalTrabalho | null, admin: Admin | null): Promise<EstadoDestino | null> {
  if (!local) return null;
  if (local.destino_id && admin) {
    const { data } = await admin.from("destinos").select("slug").eq("id", local.destino_id).eq("ativo", true).maybeSingle();
    if (data) return { destino: { slug: data.slug as string }, modo: local.modo_preferido, ate: local.ate ?? 0 };
  }
  return { destino: { lat: local.lat, lng: local.lng, rot: local.rotulo }, modo: local.modo_preferido, ate: local.ate ?? 0 };
}
