import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ipHash } from "@/lib/limites";
import { destinosDoBloco, ehModo, type ModoRota } from "@/lib/rotas/tempo";
import { destinosAtivos, resolverDestino, temposAte, type DestinoResolvido } from "@/lib/data/tempos";
import { modosDisponiveis } from "@/lib/integrations/rotas";
import { chaveDestino, comArtigo } from "@/lib/rotas/tempo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bloco "Tempo até" da página do imóvel (prompt 37): o destino da busca (se veio na URL) + os destinos ativos da MESMA
 * cidade do anúncio (E31, regra em destinosDoBloco), de carro e a pé (e de ônibus com a chave). Só textos arredondados;
 * nunca coordenada nem metros.
 *
 * GET /api/tempos/imovel/<id>?destino=<slug>&modo=<modo>  (ou dlat/dlng/drot)
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vazio = NextResponse.json({ linhas: [] }, { headers: { "Cache-Control": "no-store" } });
  if (!UUID.test(id)) return vazio;
  const admin = createAdminClient();
  if (!admin) return vazio;
  const { data: im } = await admin.from("properties").select("id, lat, lng, city, state").eq("id", id).eq("status", "active").maybeSingle();
  if (!im || im.lat == null || im.lng == null) return vazio;

  const url = new URL(request.url);
  const daBusca = await resolverDestino(
    { destino: url.searchParams.get("destino"), dlat: url.searchParams.get("dlat"), dlng: url.searchParams.get("dlng"), drot: url.searchParams.get("drot") },
    admin,
  );
  const modoBusca = url.searchParams.get("modo");

  // E31: todos os destinos ativos da cidade do anúncio, do mais perto ao mais longe (ponto público do imóvel).
  const { data: pontos } = await admin.from("destinos").select("id, slug, cidade, uf, lat, lng").eq("ativo", true);
  const todos = await destinosAtivos(admin);
  const comPonto = ((pontos ?? []) as { id: string; slug: string; cidade: string | null; uf: string | null; lat: number | null; lng: number | null }[])
    .filter((d) => d.lat != null && d.lng != null)
    .map((d) => ({ ...d, lat: Number(d.lat), lng: Number(d.lng) }));
  const perto = destinosDoBloco(
    { cidade: (im.city as string | null) ?? null, uf: (im.state as string | null) ?? null, ponto: { lat: Number(im.lat), lng: Number(im.lng) } },
    comPonto,
    daBusca?.slug,
  )
    .map((d): DestinoResolvido | null => {
      const pub = todos.find((t) => t.id === d.id);
      return pub ? { chave: chaveDestino({ destinoId: d.id }), ponto: { lat: d.lat, lng: d.lng }, rotulo: comArtigo(pub.nome, pub.artigo), destinoId: d.id, slug: d.slug } : null;
    })
    .filter((d): d is DestinoResolvido => d != null);

  const destinos = [...(daBusca ? [daBusca] : []), ...perto];
  const ip = ipHash(request);
  const linhas: { destino: string; slug: string | null; daBusca: boolean; tempos: string[] }[] = [];
  for (const d of destinos) {
    const modos: ModoRota[] = modosDisponiveis().filter((m) => m !== "bicicleta");
    if (d === daBusca && ehModo(modoBusca) && !modos.includes(modoBusca) && modosDisponiveis().includes(modoBusca)) modos.unshift(modoBusca);
    const tempos: string[] = [];
    for (const modo of modos) {
      const r = await temposAte(d, modo, { ids: [id], ip }, admin);
      const t = r.itens[0];
      // Linha reta só uma vez por destino (não repete para cada meio).
      if (t && (t.min != null || !tempos.some((x) => x.includes("linha reta")))) tempos.push(t.texto);
    }
    if (tempos.length) linhas.push({ destino: d.rotulo, slug: d.slug ?? null, daBusca: d === daBusca, tempos });
  }
  return NextResponse.json({ linhas }, { headers: { "Cache-Control": "no-store" } });
}
