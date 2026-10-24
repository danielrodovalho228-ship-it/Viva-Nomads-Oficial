import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumirLimite, DIA } from "@/lib/limites";
import { integracoesSimuladas, registrarSimulado } from "@/lib/integracoes";
import { cepValido, distanciaMetros, PROXIMIDADES_LAB, type LugarProximo } from "@/lib/proximidades/osm";
import { buscarLugares, geocodificarEndereco, geocodificarLugar, type FonteProximidades, type Ponto } from "@/lib/proximidades/osm-servidor";

/*
  "O que tem por perto" (prompt 10; PERTO-B). Chamada pelo cadastro novo E pela edição (ao abrir a seção e sempre que o
  endereço muda); rascunho e publicado usam o mesmo caminho.
  • Nominatim (geocodificação estruturada, com tentativas mais largas) e Overpass (principal + espelho), do OpenStreetMap,
    sem custo; Mapbox como reserva da geocodificação, só com token. Caminho e política em src/lib/proximidades/osm-servidor.ts.
  • Cache por CEP (proximidades_cep, só o servidor lê e grava) e limite de 30 buscas novas por pessoa por dia.
  • "fonte" na resposta e no log: osm | mapbox | cache | lab | sem_ponto | sem_lugares | limite.
  • acao "lugar": o endereço de um lugar adicionado à mão → a distância CALCULADA até o endereço do anúncio.
  • O ponto exato do imóvel NUNCA vai à resposta; só serve para achar os lugares e medir a distância.
  • Laboratório (INTEGRACOES_SIMULADAS=on): lista fixa, nada sai para a rede.
*/

const CACHE_DIAS = 30;
const s = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[<>]/g, "").trim().slice(0, max) : "");

function registrar(fonte: FonteProximidades | "lugar_ok" | "lugar_sem_ponto", etapas: string[]) {
  console.info("[proximidades]", fonte, etapas.join(" ") || "-");
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ itens: [], fonte: "demo" });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const corpo = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const admin = createAdminClient();
  const etapas: string[] = [];
  // Edição de anúncio já salvo (rascunho ou publicado): o endereço vem do servidor, não do navegador.
  const doAnuncio = typeof corpo?.propertyId === "string" ? await enderecoDoAnuncio(admin, corpo.propertyId, user.id) : null;
  const cep = doAnuncio?.cep ?? cepValido(corpo?.cep);
  if (!cep) return NextResponse.json({ error: "CEP inválido.", fonte: "sem_cep" }, { status: 400 });
  const endereco = doAnuncio ?? { rua: s(corpo?.rua, 150), numero: s(corpo?.numero, 20), cidade: s(corpo?.cidade, 100), uf: s(corpo?.uf, 2), cep };

  // ── Lugar adicionado à mão: distância calculada até o endereço do anúncio ──
  if (corpo?.acao === "lugar") {
    const enderecoLugar = s(corpo?.endereco, 200);
    if (enderecoLugar.length < 3) return NextResponse.json({ error: "Informe o endereço do lugar." }, { status: 400 });
    if (integracoesSimuladas()) {
      await registrarSimulado("osm", { acao: "lugar" });
      return NextResponse.json(/inexistente/i.test(enderecoLugar) ? { distanciaM: null } : { distanciaM: 700 });
    }
    if (!(await consumirLimite(`osm:${user.id}`, 30, DIA))) return NextResponse.json({ distanciaM: null, fonte: "limite" });
    const origem = await origemDoAnuncio(admin, cep, endereco, etapas);
    const lugar = origem ? await geocodificarLugar(enderecoLugar, endereco.cidade, endereco.uf, etapas) : null;
    registrar(origem && lugar ? "lugar_ok" : "lugar_sem_ponto", etapas);
    return NextResponse.json({ distanciaM: origem && lugar ? distanciaMetros(origem, lugar) : null });
  }

  if (integracoesSimuladas()) {
    await registrarSimulado("osm", { acao: "proximidades", cep });
    if (admin) await admin.from("proximidades_cep").upsert({ cep, lat: -18.918, lng: -48.258, itens: PROXIMIDADES_LAB, fonte: "lab", atualizado_em: new Date().toISOString() });
    return NextResponse.json({ itens: PROXIMIDADES_LAB, fonte: "lab" });
  }

  if (admin) {
    const { data: cache } = await admin.from("proximidades_cep").select("itens, atualizado_em").eq("cep", cep).maybeSingle();
    const fresco = cache && Date.now() - Date.parse(cache.atualizado_em as string) < CACHE_DIAS * 86_400_000;
    if (fresco && Array.isArray(cache.itens) && cache.itens.length > 0) {
      return NextResponse.json({ itens: cache.itens, fonte: "cache" });
    }
  }

  // OSM é gratuito, mas é de todos: limita por pessoa além do cache.
  if (!(await consumirLimite(`osm:${user.id}`, 30, DIA))) {
    registrar("limite", etapas);
    return NextResponse.json({ itens: [], fonte: "limite" });
  }

  const { ponto, fonte } = await geocodificarEndereco(endereco, etapas);
  if (!ponto || !fonte) {
    registrar("sem_ponto", etapas);
    return NextResponse.json({ itens: [], fonte: "sem_ponto" });
  }
  const itens: LugarProximo[] = (await buscarLugares(ponto, etapas)) ?? [];
  // O ponto fica no cache mesmo sem lugares: a distância dos lugares adicionados à mão parte dele.
  if (admin) await admin.from("proximidades_cep").upsert({ cep, lat: ponto.lat, lng: ponto.lng, itens, fonte, atualizado_em: new Date().toISOString() });
  registrar(itens.length ? fonte : "sem_lugares", etapas);
  return NextResponse.json({ itens, fonte: itens.length ? fonte : "sem_lugares" });
}

/** O ponto do endereço do anúncio: o do cache do CEP; sem cache, geocodifica agora. */
async function origemDoAnuncio(admin: ReturnType<typeof createAdminClient>, cep: string, endereco: Parameters<typeof geocodificarEndereco>[0], etapas: string[]): Promise<Ponto | null> {
  if (admin) {
    const { data } = await admin.from("proximidades_cep").select("lat, lng").eq("cep", cep).maybeSingle();
    if (data && Number.isFinite(data.lat) && Number.isFinite(data.lng)) return { lat: Number(data.lat), lng: Number(data.lng) };
  }
  return (await geocodificarEndereco(endereco, etapas)).ponto;
}

/** Endereço de um anúncio do PRÓPRIO dono (rascunho: o CEP do rascunho; publicado: o CEP guardado na 0238). */
async function enderecoDoAnuncio(admin: ReturnType<typeof createAdminClient>, propertyId: string, userId: string): Promise<{ cep: string; rua: string; numero: string; cidade: string; uf: string } | null> {
  if (!admin || !/^[0-9a-f-]{36}$/i.test(propertyId)) return null;
  const { data } = await admin.from("properties").select("owner_id, city, state, exact_address, draft_data, cep_proximidades").eq("id", propertyId).maybeSingle(); // consistency-ignore: PERTO-B — só o servidor, e só devolve ao PRÓPRIO dono (owner_id conferido abaixo); o endereço nunca vai à resposta
  const p = data as { owner_id: string; city: string | null; state: string | null; exact_address: string | null; draft_data: Record<string, unknown> | null; cep_proximidades: string | null } | null;
  if (!p || p.owner_id !== userId) return null;
  const d = p.draft_data ?? {};
  const txt = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const cep = cepValido(txt(d.cep)) ?? cepValido(p.cep_proximidades);
  if (!cep) return null;
  return { cep, rua: txt(d.street) || (p.exact_address ?? "").split(",")[0].trim(), numero: txt(d.numero), cidade: txt(d.city) || p.city || "", uf: txt(d.uf) || p.state || "" };
}
