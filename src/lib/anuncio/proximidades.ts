/*
  PROXIMIDADES DA PÁGINA DO IMÓVEL — regra pura, FONTE ÚNICA (PERTO-B; antes, ordem dd15064d D8/D9).
  "Destaques", "O que tem por perto" e "Serviços por perto" leem da MESMA lista visível (proximidadesVisiveis).
  • O texto de cada lugar é CALCULADO: tempo do motor de rotas (Prompt 37) quando há provedor; sem provedor, a distância
    arredondada ("a 600 m", "a 1,4 km"). Nunca minuto estimado por fórmula, nunca minuto digitado pelo dono.
  • Não aparecem: o que o dono marcou "não mostrar" e o manual antigo só com a "Distância" em texto (sem endereço nem
    distância calculada) — esse vira pendência na prontidão até o dono informar o endereço.
  • Até 3 por categoria, os mais próximos primeiro, na ordem Saúde, Educação, Trabalho, Mercado, Transporte.
*/
import type { Property, Proximity, ProximityCategory } from "../types";

export const MAX_POR_CATEGORIA_PAGINA = 3;
export const ORDEM_CATEGORIAS_PAGINA: readonly ProximityCategory[] = ["saude", "educacao", "trabalho", "mercado", "transporte"];

/** "a 600 m" (até 1 km, de 100 em 100 m, mínimo 100 m); "a 1,4 km" acima (uma casa decimal; "a 2 km" sem ",0"). */
export function textoDistancia(metros: number): string {
  if (!Number.isFinite(metros) || metros < 0) return "";
  if (metros < 950) return `a ${Math.max(100, Math.round(metros / 100) * 100)} m`;
  const km = Math.round(metros / 100) / 10;
  return `a ${Number.isInteger(km) ? String(km) : km.toFixed(1).replace(".", ",")} km`;
}

/** "8 min a pé" / "12 min de carro" — só com tempo do motor de rotas. */
export function textoTempo(minutos: number, modo: "a_pe" | "carro"): string {
  return `${Math.max(1, Math.round(minutos))} min ${modo === "a_pe" ? "a pé" : "de carro"}`;
}

/** O texto final de um lugar: tempo calculado, senão distância calculada, senão nada (não aparece). */
export function textoProximidade(p: Proximity): string | null {
  if (p.tempoMin != null && Number.isFinite(p.tempoMin) && (p.tempoModo === "a_pe" || p.tempoModo === "carro")) return textoTempo(p.tempoMin, p.tempoModo);
  if (p.distanciaM != null && Number.isFinite(p.distanciaM)) return textoDistancia(p.distanciaM) || null;
  return null;
}

/** Manual antigo: só com o texto livre, sem endereço nem distância calculada (pendência da prontidão). */
export const manualSemEndereco = (p: Proximity) => p.origem !== "osm" && !p.endereco?.trim() && (p.distanciaM == null || !Number.isFinite(p.distanciaM));

export interface ItemPerto {
  categoria: ProximityCategory;
  tipo: string | null;
  nome: string;
  texto: string;
  distanciaM: number;
}

/** A lista que a página mostra: visível, com texto calculado, até 3 por categoria, os mais próximos primeiro. */
export function proximidadesVisiveis(lista: Proximity[]): ItemPerto[] {
  const itens: ItemPerto[] = [];
  for (const p of lista) {
    if (p.oculto || !p.name?.trim()) continue;
    const texto = textoProximidade(p);
    if (!texto) continue;
    itens.push({ categoria: p.category, tipo: p.tipo ?? null, nome: p.name.trim(), texto, distanciaM: p.distanciaM ?? Number.POSITIVE_INFINITY });
  }
  return ORDEM_CATEGORIAS_PAGINA.flatMap((c) =>
    itens
      .filter((i) => i.categoria === c)
      .sort((a, b) => a.distanciaM - b.distanciaM)
      .slice(0, MAX_POR_CATEGORIA_PAGINA),
  );
}

/**
 * Lista crua do anúncio. Sem nenhuma proximidade cadastrada, usa os espaços de trabalho que o dono já informou com a
 * distância (metros, calculada no cadastro deles) como "trabalho".
 */
export function proximidadesDoImovel(p: Pick<Property, "proximities" | "nearbyWorkspaces">): Proximity[] {
  const lista = (p.proximities ?? []).filter((x) => x.name.trim());
  if (lista.length > 0) return lista;
  return (p.nearbyWorkspaces ?? [])
    .filter((w) => w.name.trim() && Number.isFinite(w.distanceM) && w.distanceM > 0)
    .map((w) => ({ category: "trabalho" as const, name: w.name.trim(), tipo: "coworking", origem: "manual" as const, distanciaM: w.distanceM }));
}

/** Serviços do dia a dia que a pessoa procura no anúncio (adendo do prompt 37). */
export type TipoServico = "onibus" | "mercado" | "farmacia";
export const SERVICOS: readonly { tipo: TipoServico; rotulo: string; frase: string }[] = [
  { tipo: "onibus", rotulo: "Ônibus", frase: "Ponto de ônibus mais perto" },
  { tipo: "mercado", rotulo: "Mercado", frase: "Mercado mais perto" },
  { tipo: "farmacia", rotulo: "Farmácia", frase: "Farmácia mais perto" },
];

const FARMACIA = /farm[aá]cia|drogaria|drogasil|droga raia|pague menos|panvel|ultrafarma/i;

export function tipoServico(p: { categoria: ProximityCategory; tipo: string | null; nome: string }): TipoServico | null {
  if (p.tipo === "onibus" || p.categoria === "transporte") return "onibus";
  if (p.tipo === "mercado" || p.categoria === "mercado") return "mercado";
  if (p.tipo === "farmacia" || (p.categoria === "saude" && !p.tipo && FARMACIA.test(p.nome))) return "farmacia";
  return null;
}

/**
 * Os 3 chips (Ônibus · Mercado · Farmácia) saem da MESMA lista visível: por serviço, o mais perto, sem o nome do lugar
 * (o nome ajudaria a achar o endereço antes do aceite). Serviço sem dado não aparece.
 */
export function servicosPorPerto(visiveis: ItemPerto[]): { tipo: TipoServico; rotulo: string; texto: string }[] {
  const out: { tipo: TipoServico; rotulo: string; texto: string }[] = [];
  for (const s of SERVICOS) {
    const doTipo = visiveis.filter((i) => tipoServico(i) === s.tipo);
    if (!doTipo.length) continue;
    const perto = doTipo.reduce((a, b) => (b.distanciaM < a.distanciaM ? b : a));
    out.push({ tipo: s.tipo, rotulo: s.rotulo, texto: `${s.frase}: ${perto.texto}` });
  }
  return out;
}

/** E145: a busca automática não respondeu (endereço sem ponto, limite do dia, falha de rede) — não é "não há lugares". */
export function buscaNaoRespondeu(fonte: string | null | undefined): boolean {
  return fonte === "sem_ponto" || fonte === "limite" || fonte === "erro";
}
