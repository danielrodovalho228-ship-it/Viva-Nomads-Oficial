/*
  Chave única do Google (Places + Distance Matrix) — SOMENTE servidor.
  Nome oficial: GOOGLE_PLACES_API_KEY. GOOGLE_MAPS_API_KEY segue valendo como apelido.
*/

type Env = Record<string, string | undefined>;

export function chaveGoogle(env: Env = process.env): string {
  return env.GOOGLE_PLACES_API_KEY?.trim() || env.GOOGLE_MAPS_API_KEY?.trim() || "";
}
