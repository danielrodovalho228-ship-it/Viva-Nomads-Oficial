import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { proximidadesDoImovel, proximidadesVisiveis, type ItemPerto } from "@/lib/anuncio/proximidades";
import type { Proximity } from "@/lib/types";

/*
  PERTO-B — leitura das proximidades de um anúncio (servidor). Sem "use server": função interna, nunca chamada do
  navegador. A FONTE ÚNICA do que a página mostra é proximidadesDoAnuncio(id) → proximidadesVisiveis (regra pura em
  src/lib/anuncio/proximidades.ts): "O que tem por perto", os chips de "Serviços por perto" e a página da estadia.
*/

export const COLUNAS_PROXIMIDADES = "id, category, name, note, sort_order, tipo, origem, distancia_m, tempo_min, tempo_modo, endereco, oculto";
const COLUNAS_ANTES_0238 = "category, name, note, sort_order";

type Linha = {
  id?: string;
  category: Proximity["category"];
  name: string;
  note: string | null;
  tipo?: string | null;
  origem?: "osm" | "manual" | null;
  distancia_m?: number | null;
  tempo_min?: number | string | null;
  tempo_modo?: "a_pe" | "carro" | null;
  endereco?: string | null;
  oculto?: boolean | null;
};

export function linhaParaProximity(l: Linha): Proximity {
  return {
    category: l.category,
    name: l.name,
    note: l.note ?? undefined,
    tipo: l.tipo ?? null,
    origem: l.origem === "osm" ? "osm" : "manual",
    distanciaM: l.distancia_m ?? null,
    tempoMin: l.tempo_min == null ? null : Number(l.tempo_min),
    tempoModo: l.tempo_modo ?? null,
    endereco: l.endereco ?? null,
    oculto: l.oculto === true,
  };
}

/** As linhas do anúncio, já no formato da tela. Sem a 0238 (colunas novas ausentes), lê as colunas antigas. */
export async function lerProximidades(client: SupabaseClient, propertyId: string): Promise<Proximity[]> {
  const novo = await client.from("property_proximities").select(COLUNAS_PROXIMIDADES).eq("property_id", propertyId).order("sort_order");
  if (!novo.error) return ((novo.data ?? []) as Linha[]).map(linhaParaProximity);
  const antigo = await client.from("property_proximities").select(COLUNAS_ANTES_0238).eq("property_id", propertyId).order("sort_order");
  return antigo.error ? [] : ((antigo.data ?? []) as Linha[]).map(linhaParaProximity);
}

/** FONTE ÚNICA: os lugares visíveis do anúncio por categoria, com o texto final (tempo calculado ou distância). */
export async function proximidadesDoAnuncio(propertyId: string, client: SupabaseClient | null = createAdminClient()): Promise<ItemPerto[]> {
  if (!client) return [];
  const [lista, trab] = await Promise.all([
    lerProximidades(client, propertyId),
    client.from("property_workspaces").select("name, type, distance_m").eq("property_id", propertyId),
  ]);
  const nearbyWorkspaces = ((trab.data ?? []) as { name: string; type: string; distance_m: number | null }[]).map((w) => ({ name: w.name, type: w.type, distanceM: w.distance_m ?? 0 }));
  return proximidadesVisiveis(proximidadesDoImovel({ proximities: lista, nearbyWorkspaces } as Parameters<typeof proximidadesDoImovel>[0]));
}
