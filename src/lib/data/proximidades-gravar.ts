import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { integracoesSimuladas } from "@/lib/integracoes";
import { cepValido, distanciaMetros, type LugarProximo } from "@/lib/proximidades/osm";
import { geocodificarEndereco, geocodificarLugar, temposDosLugares, type Ponto } from "@/lib/proximidades/osm-servidor";
import type { Proximity } from "@/lib/types";

/*
  PERTO-B — o que vai para property_proximities ao salvar o anúncio. A distância e o tempo são SEMPRE calculados aqui,
  no servidor; nada do que o navegador manda como distância ou minuto é gravado.
  • Lugar do OSM: só entra se estiver na busca guardada para o CEP do anúncio (proximidades_cep); a distância e o ponto
    vêm de lá. "Não mostrar" (oculto) é escolha do dono e é guardada.
  • Lugar manual: nome + categoria + ENDEREÇO do lugar, geocodificado pelo mesmo caminho do OSM; a distância parte do
    ponto do endereço do anúncio. Endereço já calculado antes (mesmo nome e endereço) reaproveita a distância.
  • Manual antigo sem endereço: fica como está (a página não o mostra; a prontidão pede o endereço).
  • Tempo: motor de rotas do Prompt 37, quando há provedor (senão nulo, e a tela mostra a distância).
*/

export interface EnderecoDoAnuncio {
  cep?: string;
  rua?: string;
  numero?: string;
  cidade?: string;
  uf?: string;
}

export type LinhaProximidade = {
  property_id: string;
  category: Proximity["category"];
  name: string;
  note: string | null;
  sort_order: number;
  tipo: string | null;
  origem: "osm" | "manual";
  distancia_m: number | null;
  tempo_min: number | null;
  tempo_modo: "a_pe" | "carro" | null;
  endereco: string | null;
  lat: number | null;
  lng: number | null;
  oculto: boolean;
};

const chave = (tipo: string | null | undefined, nome: string) => `${tipo ?? ""}|${nome.trim().toLowerCase()}`;
const chaveManual = (nome: string, endereco: string) => `${nome.trim().toLowerCase()}|${endereco.trim().toLowerCase()}`;

export async function proximidadesParaGravar(admin: SupabaseClient | null, propertyId: string, lista: Proximity[], end: EnderecoDoAnuncio | undefined): Promise<LinhaProximidade[]> {
  // Sem o CEP do formulário (editor por seção, publicado), vale o CEP guardado na 0238.
  const cepGuardado = !cepValido(end?.cep) && admin ? ((await admin.from("properties").select("cep_proximidades").eq("id", propertyId).maybeSingle()).data as { cep_proximidades: string | null } | null)?.cep_proximidades : null; // consistency-ignore: PERTO-B — só o servidor lê o CEP privado do PRÓPRIO anúncio (a ação já conferiu o dono)
  const cep = cepValido(end?.cep) ?? cepValido(cepGuardado);
  const cache = admin && cep ? ((await admin.from("proximidades_cep").select("lat, lng, itens").eq("cep", cep).maybeSingle()).data as { lat: number | null; lng: number | null; itens: LugarProximo[] | null } | null) : null;
  const doCep = new Map((cache?.itens ?? []).map((l) => [chave(l.tipo, l.nome), l]));
  const antigas = admin
    ? (((await admin.from("property_proximities").select("name, tipo, origem, endereco, distancia_m, lat, lng").eq("property_id", propertyId)).data ?? []) as { name: string; tipo: string | null; origem: string | null; endereco: string | null; distancia_m: number | null; lat: number | null; lng: number | null }[])
    : [];
  // Lugar do OSM já gravado (com a distância calculada antes) continua válido mesmo sem a busca do CEP à mão.
  for (const a of antigas) {
    if (a.origem === "osm" && a.distancia_m != null && !doCep.has(chave(a.tipo, a.name))) {
      doCep.set(chave(a.tipo, a.name), { tipo: (a.tipo ?? "onibus") as LugarProximo["tipo"], categoria: "transporte", nome: a.name, distanciaM: a.distancia_m, lat: a.lat ?? undefined, lng: a.lng ?? undefined });
    }
  }
  const jaCalculado = new Map(antigas.filter((a) => a.endereco && a.distancia_m != null).map((a) => [chaveManual(a.name, a.endereco!), a]));

  let origem: Ponto | null = cache && Number.isFinite(cache.lat) && Number.isFinite(cache.lng) ? { lat: Number(cache.lat), lng: Number(cache.lng) } : null;
  const origemDoAnuncio = async () => {
    if (!origem && end && !integracoesSimuladas()) origem = (await geocodificarEndereco(end)).ponto;
    return origem;
  };

  const linhas: LinhaProximidade[] = [];
  for (const p of lista) {
    const nome = String(p.name ?? "").replace(/[<>]/g, "").trim().slice(0, 120);
    if (!nome) continue;
    const base = { property_id: propertyId, category: p.category, name: nome, sort_order: linhas.length, tempo_min: null, tempo_modo: null, oculto: p.oculto === true };
    if (p.origem === "osm") {
      const l = doCep.get(chave(p.tipo, nome));
      if (!l) continue; // fora da busca guardada para este CEP: não entra (nada de distância vinda do navegador)
      linhas.push({ ...base, note: null, tipo: l.tipo, origem: "osm", distancia_m: l.distanciaM, endereco: null, lat: l.lat ?? null, lng: l.lng ?? null });
      continue;
    }
    const endereco = String(p.endereco ?? "").replace(/[<>]/g, "").trim().slice(0, 200);
    if (!endereco) {
      // Manual antigo (só "Distância" em texto livre): guardado como está, sem distância — a página não o mostra.
      linhas.push({ ...base, note: p.note ?? null, tipo: p.tipo ?? null, origem: "manual", distancia_m: null, endereco: null, lat: null, lng: null });
      continue;
    }
    const ja = jaCalculado.get(chaveManual(nome, endereco));
    let distancia: number | null = ja?.distancia_m ?? null;
    let ponto: Ponto | null = ja && ja.lat != null && ja.lng != null ? { lat: ja.lat, lng: ja.lng } : null;
    if (distancia == null) {
      if (integracoesSimuladas()) distancia = /inexistente/i.test(endereco) ? null : 700;
      else {
        const o = await origemDoAnuncio();
        ponto = o ? await geocodificarLugar(endereco, end?.cidade ?? "", end?.uf ?? "") : null;
        distancia = o && ponto ? distanciaMetros(o, ponto) : null;
      }
    }
    linhas.push({ ...base, note: null, tipo: p.tipo ?? null, origem: "manual", distancia_m: distancia, endereco, lat: ponto?.lat ?? null, lng: ponto?.lng ?? null });
  }

  // Tempo pelo motor de rotas (só com provedor; sem ele, fica a distância).
  const o = origem as Ponto | null;
  if (o) {
    const comPonto = linhas.flatMap((l, i) => (l.lat != null && l.lng != null && l.distancia_m != null ? [{ id: String(i), lat: l.lat, lng: l.lng, distanciaM: l.distancia_m }] : []));
    const tempos = comPonto.length ? await temposDosLugares(o, comPonto) : new Map();
    for (const [id, t] of tempos) {
      linhas[Number(id)].tempo_min = Math.round(t.minutos * 10) / 10;
      linhas[Number(id)].tempo_modo = t.modo;
    }
  }
  return linhas;
}

/**
 * Regrava as proximidades do anúncio. Sem a 0238 (colunas novas ausentes), grava só as colunas antigas — e nunca
 * apaga as linhas antes de saber que a gravação nova é possível.
 */
export async function gravarProximidades(supabase: SupabaseClient, propertyId: string, linhas: LinhaProximidade[], admin: SupabaseClient | null = null, cep?: string): Promise<void> {
  // O CEP fica guardado (coluna privada da 0238) para a busca da edição depois de publicado.
  const c = cepValido(cep);
  if (admin && c) await admin.from("properties").update({ cep_proximidades: c }).eq("id", propertyId).then(undefined, () => null);
  const teste = await supabase.from("property_proximities").select("oculto").eq("property_id", propertyId).limit(1);
  const comColunasNovas = !teste.error;
  await supabase.from("property_proximities").delete().eq("property_id", propertyId);
  if (!linhas.length) return;
  const rows = comColunasNovas ? linhas : linhas.map(({ property_id, category, name, note, sort_order }) => ({ property_id, category, name, note, sort_order }));
  const { error } = await supabase.from("property_proximities").insert(rows);
  if (error) console.error("[proximidades] gravar", error.code);
}
