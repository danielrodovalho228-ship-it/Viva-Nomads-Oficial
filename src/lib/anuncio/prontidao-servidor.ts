import { planoDoProprietario } from "@/lib/data/plano-efetivo";
import { listingLimit } from "@/lib/plan";
import type { SubscriptionPlan } from "@/lib/store";
import { fatosDaLinha, prontidaoAnuncio, type FatosAnuncio, type LinhaAnuncio, type Prontidao, type StatusDocumento } from "./prontidao";

/**
 * Prontidão dos anúncios de UM dono, lida do banco — a mesma regra pura de
 * lib/anuncio/prontidao.ts. Usada em Meus imóveis, Visão geral, no servidor do
 * Publicar e na ferramenta da Viva. Só do servidor.
 */

// Cliente Supabase do servidor (da pessoa, com RLS, ou o admin). Tipado frouxo de propósito.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any;

const COLUNAS =
  "id, status, title, address, city, bathrooms, area_m2, min_period_days, monthly_price, garantias_aceitas, ownership_type, sublease_authorized, description, ready_to_live_badge, video_url";

/** Fatos do banco por imóvel (o editor usa como base e sobrepõe o que está sendo editado). */
export async function fatosDosImoveis(cliente: Cliente, ownerId: string, ids?: string[]): Promise<Map<string, FatosAnuncio>> {
  const mapa = new Map<string, FatosAnuncio>();
  let q = cliente.from("properties").select(COLUNAS).eq("owner_id", ownerId);
  if (ids && ids.length) q = q.in("id", ids);
  const { data: props } = await q;
  const lista = (props ?? []) as (LinhaAnuncio & { id: string; status: string })[];
  if (lista.length === 0) return mapa;
  const idsLista = lista.map((p) => p.id);

  const [{ data: fotos }, { data: docs }, plano, { count: ativos }] = await Promise.all([
    cliente.from("property_photos").select("property_id").in("property_id", idsLista),
    cliente.from("qualification_checklists").select("property_id, document_status, created_at").eq("owner_id", ownerId).in("property_id", idsLista).order("created_at", { ascending: false }),
    planoDoProprietario(cliente, ownerId),
    cliente.from("properties").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("status", "active"),
  ]);
  const fotosPor = new Map<string, number>();
  for (const f of (fotos ?? []) as { property_id: string }[]) fotosPor.set(f.property_id, (fotosPor.get(f.property_id) ?? 0) + 1);
  const docPor = new Map<string, StatusDocumento>();
  for (const d of (docs ?? []) as { property_id: string; document_status: string | null }[]) {
    if (!docPor.has(d.property_id)) docPor.set(d.property_id, ((d.document_status as StatusDocumento) ?? "none") || "none");
  }
  const limite = listingLimit(plano as SubscriptionPlan);
  for (const p of lista) {
    // Um anúncio já publicado não ocupa vaga nova; os demais precisam de uma.
    const limiteOk = p.status === "active" ? true : (ativos ?? 0) < limite;
    mapa.set(p.id, fatosDaLinha(p, fotosPor.get(p.id) ?? 0, docPor.get(p.id) ?? "none", limiteOk));
  }
  return mapa;
}

export async function prontidaoDosImoveis(cliente: Cliente, ownerId: string, ids?: string[]): Promise<Map<string, Prontidao>> {
  const mapa = new Map<string, Prontidao>();
  for (const [id, f] of await fatosDosImoveis(cliente, ownerId, ids)) mapa.set(id, prontidaoAnuncio(f));
  return mapa;
}

export async function prontidaoDoImovel(cliente: Cliente, ownerId: string, id: string): Promise<Prontidao | null> {
  return (await prontidaoDosImoveis(cliente, ownerId, [id])).get(id) ?? null;
}
