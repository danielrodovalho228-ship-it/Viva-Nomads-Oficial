/**
 * Buscas salvas (ordem d15ef6bf): regras puras — qual parte da URL vira a busca
 * salva e o resumo legível que aparece em "Buscas salvas".
 */

/** Parâmetros da /buscar que definem a busca (o resto da URL é ignorado). */
const CHAVES = [
  "local", "lat", "lng", "r", "preco", "orcamento", "quartos", "adultos", "criancas", "periodo",
  "tipo", "faixa", "entrada", "garantia", "pet", "mobiliado", "pronto", "homeoffice", "localizado",
  "nota", "seguro", "gestor", "ordem",
  // Prompt 37: destino (cadastrado ou endereço com 2 casas e rótulo sem número), meio e "até N min".
  "destino", "dlat", "dlng", "drot", "modo", "ate",
] as const;

export const LIMITE_BUSCAS_SALVAS = 20;

/** Normaliza a query string: só as chaves conhecidas, sem vazios, em ordem fixa (mesma busca = mesmo texto). */
export function normalizarBusca(qs: string): string {
  const sp = new URLSearchParams(qs.startsWith("?") ? qs.slice(1) : qs);
  const out = new URLSearchParams();
  for (const k of CHAVES) {
    const v = sp.get(k)?.trim();
    if (v) out.set(k, v.slice(0, 120));
  }
  return out.toString().slice(0, 1000);
}

const PERIODO: Record<string, string> = { "60": "1–2 meses", "120": "3–4 meses", "180": "5–6 meses" };
const brl = (n: number) => `R$ ${n.toLocaleString("pt-BR")}`;

/** Resumo legível: "Uberlândia · até R$ 3.500 · 2+ quartos · Pronto para Morar". */
export function resumoDaBusca(qs: string, nomeDoDestino?: (slug: string) => string | undefined): string {
  const sp = new URLSearchParams(normalizarBusca(qs));
  const partes: string[] = [];
  partes.push(sp.get("local") || "Todas as cidades");
  const preco = Number(sp.get("preco") || sp.get("orcamento"));
  if (preco > 0) partes.push(`até ${brl(preco)}`);
  const q = Number(sp.get("quartos"));
  if (q > 0) partes.push(`${q}+ ${q === 1 ? "quarto" : "quartos"}`);
  const hosp = Number(sp.get("adultos") || 1) + Number(sp.get("criancas") || 0);
  if (hosp > 1) partes.push(`${hosp} hóspedes`);
  const per = PERIODO[sp.get("periodo") ?? ""];
  if (per) partes.push(per);
  const ent = sp.get("entrada");
  if (ent && /^\d{4}-\d{2}-\d{2}$/.test(ent)) partes.push(`entrada ${ent.slice(8, 10)}/${ent.slice(5, 7)}`);
  if (sp.get("pronto") === "1") partes.push("Pronto para Morar");
  if (sp.get("pet") === "1") partes.push("aceita pet");
  if (sp.get("homeoffice") === "1") partes.push("trabalhar de casa");
  const destino = nomeDoDestino?.(sp.get("destino") ?? "") ?? sp.get("drot") ?? sp.get("destino")?.toUpperCase();
  if (destino) {
    const modo = { carro: "de carro", a_pe: "a pé", bicicleta: "de bicicleta", onibus: "de ônibus" }[sp.get("modo") ?? "carro"] ?? "de carro";
    const ate = Number(sp.get("ate"));
    partes.push(ate > 0 ? `até ${ate} min ${modo} até ${destino}` : `perto de ${destino}`);
  }
  return partes.join(" · ").slice(0, 200);
}
