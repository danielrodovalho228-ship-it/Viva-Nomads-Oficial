import { chaveGoogle } from "../integrations/chave-google.ts";

type Env = Record<string, string | undefined>;

/** Mapa (Mapbox) e "o que tem perto" (Google Places) ligados ou não — sem expor nenhuma chave. */
export function estadoMapas(env: Env = process.env): { mapa: boolean; lugaresProximos: boolean } {
  return {
    mapa: !!env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim(),
    lugaresProximos: !!chaveGoogle(env),
  };
}
