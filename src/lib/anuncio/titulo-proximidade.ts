/*
  E825 — o TÍTULO não afirma proximidade que o corpo do anúncio desmente. "Studio ao lado do Hospital de Clínicas" com
  "HC-UFU a 1,7 km" na página contava duas distâncias. Régua (PURA), com a distância que o próprio anúncio informa
  ("O que tem por perto" e espaços de trabalho):
    • "ao lado de", "em frente a", "colado a/ao"  → até 300 m;
    • "próximo a/à/ao", "perto de/do/da"           → até 1.000 m (uns 12 minutos a pé).
  O lugar citado no título é casado com o lugar do corpo que tem MAIS palavras em comum; sem lugar no corpo, a afirmação
  fica sem lastro (também é divergência).
*/
export interface LugarDoAnuncio {
  nome: string;
  distanciaM: number;
}

const LIMITES: readonly { re: RegExp; limiteM: number; termo: string }[] = [
  { re: /\b(ao lado d[eoa]s?|em frente (?:a|ao|à|d[eoa]s?)|colad[oa] (?:a|ao|à))\s+(.+)/i, limiteM: 300, termo: "ao lado" },
  { re: /\b(pr[oó]xim[oa] (?:a|ao|à|d[eoa]s?)|perto d[eoa]s?)\s+(.+)/i, limiteM: 1000, termo: "perto" },
];

const PARADAS = new Set(["de", "do", "da", "dos", "das", "e", "o", "a", "os", "as", "em", "no", "na", "para", "com", "bairro", "centro"]);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const palavras = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !PARADAS.has(w));

export interface DivergenciaProximidade {
  afirmacao: string;
  lugar: string | null;
  distanciaM: number | null;
  limiteM: number;
}

function melhorLugar(objeto: string, lugares: readonly LugarDoAnuncio[]): LugarDoAnuncio | null {
  const chaves = palavras(objeto);
  let melhor: { lugar: LugarDoAnuncio; comuns: number } | null = null;
  for (const lugar of lugares) {
    const nome = new Set(palavras(lugar.nome));
    const comuns = chaves.filter((c) => nome.has(c)).length;
    if (comuns > 0 && (!melhor || comuns > melhor.comuns || (comuns === melhor.comuns && lugar.distanciaM < melhor.lugar.distanciaM))) melhor = { lugar, comuns };
  }
  return melhor?.lugar ?? null;
}

/** "a 1,7 km do Hospital", "a 300 m da UFU": a distância dita no título tem de bater (±15% ou ±100 m) com a do corpo. */
const DISTANCIA_EXPLICITA = /\ba (\d+(?:[.,]\d+)?)\s*(km|m)\s+d[eoa]s?\s+(.+)/i;

/** A afirmação de proximidade do título que o corpo não sustenta; null se não há afirmação ou se ela confere. */
export function proximidadeDivergente(titulo: string, lugares: readonly LugarDoAnuncio[]): DivergenciaProximidade | null {
  const d = DISTANCIA_EXPLICITA.exec(titulo ?? "");
  if (d) {
    const ditaM = Number(d[1].replace(",", ".")) * (d[2].toLowerCase() === "km" ? 1000 : 1);
    const lugar = melhorLugar(d[3].split(/\s+[—–-]\s+|,/)[0], lugares);
    const tolerancia = Math.max(100, ditaM * 0.15);
    if (!lugar || Math.abs(lugar.distanciaM - ditaM) > tolerancia) return { afirmacao: d[0].trim(), lugar: lugar?.nome ?? null, distanciaM: lugar?.distanciaM ?? null, limiteM: ditaM };
  }
  for (const l of LIMITES) {
    const m = l.re.exec(titulo ?? "");
    if (!m) continue;
    const lugar = melhorLugar(m[2].split(/\s+[—–-]\s+|,/)[0], lugares);
    if (!lugar) return { afirmacao: m[0].trim(), lugar: null, distanciaM: null, limiteM: l.limiteM };
    if (lugar.distanciaM > l.limiteM) return { afirmacao: m[0].trim(), lugar: lugar.nome, distanciaM: lugar.distanciaM, limiteM: l.limiteM };
  }
  return null;
}

/** Os lugares que o anúncio informa no corpo (arredores + espaços de trabalho), com a distância. */
export function lugaresDoAnuncio(p: {
  proximities?: readonly { name: string; distanciaM?: number | null }[] | null;
  nearbyWorkspaces?: readonly { name: string; distanceM?: number | null }[] | null;
}): LugarDoAnuncio[] {
  const com = (nome: string, d: number | null | undefined) => (typeof d === "number" && Number.isFinite(d) ? [{ nome, distanciaM: d }] : []);
  return [...(p.proximities ?? []).flatMap((x) => com(x.name, x.distanciaM)), ...(p.nearbyWorkspaces ?? []).flatMap((x) => com(x.name, x.distanceM))];
}
