/*
  E952 — a regra do CLIENTE do "O que tem por perto" (Passo 5 do editor). PURO.
  • Cada busca leva um número (seq). Mudou o CEP, a rua ou o número: a lista some NA HORA (iniciarBuscaPerto) e o
    alvo passa a ser o endereço novo.
  • aplicarRespostaPerto: resposta com número velho, ou com `referencia` de outro endereço, é DESCARTADA (estado
    igual); a resposta aceita SUBSTITUI a lista, inclusive vazia; erro deixa a lista vazia com o estado de erro. Nunca a
    lista anterior.
*/
import type { LugarProximo } from "./osm.ts";
import { mesmoEnderecoDaBusca, type EnderecoBusca } from "./referencia.ts";

export interface AlvoPerto {
  cep: string;
  rua: string;
}
export type StatusPerto = "aguardando" | "carregando" | "pronto" | "erro";
export interface EstadoPerto {
  seq: number;
  /** O endereço da busca em curso / da lista na tela. null = o endereço guardado no servidor (anúncio salvo, sem CEP no formulário). */
  alvo: AlvoPerto | null;
  itens: LugarProximo[] | null;
  status: StatusPerto;
  fonte: string | null;
}
export interface RespostaPerto {
  seq: number;
  /** O endereço que o servidor usou (nunca o ponto). */
  referencia?: EnderecoBusca | null;
  itens?: LugarProximo[] | null;
  fonte?: string | null;
  /** Falha de rede ou HTTP ≠ 2xx. */
  erro?: boolean;
}

export const ESTADO_PERTO_INICIAL: EstadoPerto = { seq: 0, alvo: null, itens: null, status: "aguardando", fonte: null };

/** Nova busca (endereço mudou, ou "Tentar de novo"): número novo, lista vazia na hora, carregando. */
export function iniciarBuscaPerto(e: EstadoPerto, alvo: AlvoPerto | null): EstadoPerto {
  return { seq: e.seq + 1, alvo, itens: null, status: "carregando", fonte: null };
}

/** Endereço mudou mas ainda incompleto: a lista anterior some e nada é buscado. */
export function invalidarPerto(e: EstadoPerto): EstadoPerto {
  return { seq: e.seq + 1, alvo: null, itens: null, status: "aguardando", fonte: null };
}

export function aplicarRespostaPerto(e: EstadoPerto, r: RespostaPerto): EstadoPerto {
  if (r.seq !== e.seq) return e;
  if (r.erro) return { ...e, itens: [], status: "erro", fonte: "erro" };
  if (e.alvo && r.referencia && !mesmoEnderecoDaBusca({ cep: e.alvo.cep, rua: e.alvo.rua }, { cep: r.referencia.cep, rua: r.referencia.rua })) return e;
  // Busca pelo anúncio salvo (sem CEP no formulário): o endereço que o servidor usou passa a ser o do carimbo.
  const alvo = e.alvo ?? (r.referencia?.cep ? { cep: r.referencia.cep, rua: r.referencia.rua ?? "" } : null);
  return { ...e, alvo, itens: Array.isArray(r.itens) ? r.itens : [], status: "pronto", fonte: r.fonte ?? null };
}

/** "Rua X, CEP 38414-536" (o CEP com hífen). */
export function rotuloEndereco(a: { cep?: string | null; rua?: string | null }): string {
  const d = (a.cep ?? "").replace(/\D/g, "");
  const cep = d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (a.cep ?? "");
  const rua = (a.rua ?? "").trim();
  return [rua, cep ? `CEP ${cep}` : ""].filter(Boolean).join(", ");
}
export const textoProcurandoPerto = (a: { cep?: string | null; rua?: string | null }) => `Procurando o que tem perto de ${rotuloEndereco(a)}…`;
export const carimboPerto = (a: { cep?: string | null; rua?: string | null }) => `Perto de: ${rotuloEndereco(a)}`;
export const TEXTO_ERRO_PERTO = "Não conseguimos buscar agora.";
export const BOTAO_ERRO_PERTO = "Tentar de novo";
