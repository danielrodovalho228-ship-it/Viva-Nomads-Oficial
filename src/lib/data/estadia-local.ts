import "server-only";
/*
  Prompt 61-A, item 2 — o local da estadia na página da estadia: mapa com as proximidades do anúncio (a mesma lista do
  bloco do Prompt 37, src/lib/anuncio/proximidades.ts) e, com o contrato assinado pelas duas partes, o endereço exato.
  Antes disso, a regra de sempre: região aproximada, sem endereço. Só é chamado depois que carregarEstadia conferiu
  que quem pede é parte do contrato. Sem banco ou com erro: nada (a página segue sem o bloco).
*/
import { createAdminClient } from "@/lib/supabase/admin";
import { proximidadesDoImovel, proximidadesVisiveis, type ItemPerto } from "@/lib/anuncio/proximidades";
import { lerProximidades } from "@/lib/data/proximidades";
import { enderecoDaVisita, type EnderecoVisita } from "@/lib/visitas/endereco-visita";
import type { Property } from "@/lib/types";

export interface LocalDaEstadia {
  lat: number;
  lng: number;
  bairro: string | null;
  /** Só com o contrato assinado pelas duas partes. */
  endereco: EnderecoVisita | null;
  proximidades: ItemPerto[];
}

export async function localDaEstadia(propertyId: string, contratada: boolean): Promise<LocalDaEstadia | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  try {
    const [imovel, prox, trab] = await Promise.all([
      admin.from("properties").select("lat, lng, address, city, state").eq("id", propertyId).maybeSingle(),
      lerProximidades(admin, propertyId),
      admin.from("property_workspaces").select("name, type, distance_m").eq("property_id", propertyId),
    ]);
    const p = imovel.data as { lat: number | null; lng: number | null; address: string | null; city: string | null; state: string | null } | null;
    if (!p || p.lat == null || p.lng == null) return null;
    const exato = contratada
      ? ((await admin.from("properties").select("exact_address").eq("id", propertyId).maybeSingle()).data as { exact_address: string | null } | null)?.exact_address ?? null // consistency-ignore: Prompt 61-A — endereço exato só para as partes, com o contrato assinado pelas duas
      : null;
    // PERTO-B: a mesma lista visível da página do imóvel (texto calculado; oculto e manual sem endereço fora).
    const proximidades = proximidadesVisiveis(proximidadesDoImovel({
      proximities: prox,
      nearbyWorkspaces: ((trab.data ?? []) as { name: string; type: string; distance_m: number | null }[]).map((w) => ({ name: w.name, type: w.type, distanceM: w.distance_m ?? 0 })),
    } as unknown as Property));
    return {
      lat: Number(p.lat),
      lng: Number(p.lng),
      bairro: (p.address ?? "").trim() || null,
      endereco: contratada ? enderecoDaVisita({ ...p, exact_address: exato }) : null,
      proximidades,
    };
  } catch {
    return null;
  }
}
