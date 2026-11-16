import "server-only";
import { CATEGORIAS_MAPBOX, lugaresDoMapbox, raioDoTipo, urlCategoriaMapbox } from "@/lib/proximidades/mapbox";
import type { LugarProximo, TipoLugar } from "@/lib/proximidades/osm";
import type { Ponto } from "@/lib/proximidades/osm-servidor";

/*
  E978 opção (i) — a busca AO VIVO do editor no Mapbox (Search Box, por categoria), do servidor, com o token do servidor.
  O resultado vai SÓ para a resposta do editor: nunca é gravado nem vai para cache (termos do nível gratuito).
  Cada etapa registra só o código ("mapbox:pharmacy:200:3", "mapbox:gym:404"), nunca endereço, CEP ou o token.
*/

/** Lugares em volta do ponto pelo Mapbox. null = nenhuma categoria respondeu (a tela diz "não respondeu"). */
export async function buscarLugaresMapbox(ponto: Ponto, token: string, etapas: string[] = []): Promise<LugarProximo[] | null> {
  const pedidos = (Object.entries(CATEGORIAS_MAPBOX) as [Exclude<TipoLugar, "empresa">, readonly string[]][]).flatMap(([tipo, categorias]) =>
    categorias.map((categoria) => ({ tipo, categoria })),
  );
  const respostas = await Promise.all(
    pedidos.map(async ({ tipo, categoria }) => {
      try {
        const res = await fetch(urlCategoriaMapbox(categoria, ponto, token, raioDoTipo(tipo)), { signal: AbortSignal.timeout(8000), cache: "no-store" });
        if (!res.ok) {
          etapas.push(`mapbox:${categoria}:${res.status}`);
          return null;
        }
        const json = (await res.json()) as unknown;
        const n = Array.isArray((json as { features?: unknown[] } | null)?.features) ? (json as { features: unknown[] }).features.length : 0;
        etapas.push(`mapbox:${categoria}:200:${n}`);
        return { tipo, json };
      } catch (e) {
        etapas.push(`mapbox:${categoria}:erro:${(e as Error).name}`);
        return null;
      }
    }),
  );
  const ok = respostas.filter((r): r is { tipo: Exclude<TipoLugar, "empresa">; json: unknown } => r !== null);
  if (!ok.length) return null;
  return lugaresDoMapbox(ok, ponto);
}
