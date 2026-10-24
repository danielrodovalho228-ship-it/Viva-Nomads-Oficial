import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chaveCidade } from "@/lib/cidades";
import { integracoesSimuladas } from "@/lib/integracoes";
import { geocodificarLugar } from "@/lib/proximidades/osm-servidor";
import { normalizarDetalhes } from "./detalhes-anuncio";
import { CENTROS_CONHECIDOS, chacaraDoFormulario, distanciaCidade, ehChacara, normalizarChacara, pontoMarcadoValido, type PontoMarcado } from "./chacara";

/*
  TIPO-CHACARA-B — o lado do servidor: o ponto marcado pelo dono vira o lat/lng do anúncio (o banco guarda o exato em
  lat_exata/lng_exata e publica o aproximado — 0066) e a distância até o centro da cidade é CALCULADA daqui, nunca
  digitada. Os tempos até os destinos saem do mesmo ponto pelo motor do Prompt 37 (lê lat_exata).
*/

export interface EntradaChacara {
  propertyType?: string;
  city?: string;
  enderecoProximidades?: { uf?: string } | null;
  chacara?: { acesso?: unknown; internet?: unknown; ponto?: unknown } | null;
  lat?: number;
  lng?: number;
}

/** Chácara com ponto marcado: o ponto do dono vale no lugar da geocodificação do endereço (rural erra). */
export function aplicarPontoChacara<T extends EntradaChacara>(input: T): T {
  if (!ehChacara(input.propertyType) || !pontoMarcadoValido(input.chacara?.ponto)) return input;
  const p = input.chacara!.ponto as PontoMarcado;
  return { ...input, lat: Number(p.lat), lng: Number(p.lng) };
}

/** Centro da cidade: os conhecidos; fora deles, o OSM pelo nome da cidade (no laboratório, só os conhecidos). */
export async function centroDaCidade(cidade: string, uf: string): Promise<PontoMarcado | null> {
  const conhecido = CENTROS_CONHECIDOS[`${chaveCidade(cidade)}|${uf.toUpperCase()}`] ?? (uf ? null : CENTROS_CONHECIDOS[`${chaveCidade(cidade)}|MG`]);
  if (conhecido) return conhecido;
  if (integracoesSimuladas() || !cidade.trim()) return null;
  return geocodificarLugar("", cidade, uf).catch(() => null);
}

/**
 * Grava o grupo "chacara" em detalhes_anuncio (mantendo os outros grupos). Outro tipo: o grupo sai. Sem dados do
 * formulário: mantém o que estava. Best-effort: falha não derruba o salvar (a prontidão segue barrando o publicar).
 */
export async function gravarChacara(supabase: SupabaseClient, ownerId: string, id: string, input: EntradaChacara): Promise<void> {
  try {
    const { data } = await supabase.from("properties").select("detalhes_anuncio").eq("id", id).eq("owner_id", ownerId).maybeSingle();
    const atual = normalizarDetalhes(data?.detalhes_anuncio) ?? {};
    const anterior = normalizarChacara(atual.chacara);
    let novo = { ...atual };
    if (!ehChacara(input.propertyType)) {
      if (!anterior) return;
      delete novo.chacara;
    } else {
      if (!input.chacara) return;
      const { dados, ponto } = chacaraDoFormulario(input.chacara, anterior);
      if (ponto) {
        const centro = await centroDaCidade(input.city ?? "", input.enderecoProximidades?.uf ?? "");
        if (centro) dados.distanciaCidadeKm = distanciaCidade(ponto, centro);
      }
      novo = { ...novo, chacara: Object.keys(dados).length ? dados : undefined };
      if (!novo.chacara) delete novo.chacara;
    }
    await supabase
      .from("properties")
      .update({ detalhes_anuncio: normalizarDetalhes(novo) })
      .eq("id", id)
      .eq("owner_id", ownerId);
  } catch (e) {
    console.error("[gravarChacara]", e);
  }
}
