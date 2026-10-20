/*
  Local de trabalho (perfil) e destino do pedido de moradia (Prompt 37) — PURO.
  Formato gravado (jsonb): { destino_id?, rotulo, lat, lng, modo_preferido } (+ ate_min no pedido).
   • Endereço digitado: rótulo limpo (sem número de casa) e ponto arredondado a 3 casas (~100 m).
   • O DONO nunca vê o endereço digitado: para ele, o destino cadastrado aparece pelo nome curto ("perto do HC-UFU")
     e o endereço digitado vira "perto do local de trabalho informado" — só o rótulo e os minutos, nunca lat/lng.
*/
import { casas, limparRotulo, pontoValido, type DestinoDaBusca } from "./destino-url.ts";
import { ehModo, OPCOES_ATE, rotuloTempo, type Modo } from "./tempo.ts";

export interface LocalTrabalho {
  destino_id?: string;
  rotulo: string;
  lat: number;
  lng: number;
  modo_preferido: Modo;
  /** Só no pedido de moradia: "até N min" para a compatibilidade. */
  ate_min?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê o jsonb gravado (ou um objeto vindo do formulário) e devolve o formato limpo, ou null. */
export function normalizarLocal(v: unknown): LocalTrabalho | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!pontoValido(o.lat, o.lng)) return null;
  const destinoId = typeof o.destino_id === "string" && UUID.test(o.destino_id) ? o.destino_id : undefined;
  const rotulo = destinoId ? String(o.rotulo ?? "").trim().slice(0, 80) : limparRotulo(String(o.rotulo ?? ""));
  if (!rotulo) return null;
  const ate = Number(o.ate_min);
  return {
    ...(destinoId ? { destino_id: destinoId } : {}),
    rotulo,
    lat: destinoId ? Number(o.lat) : casas(Number(o.lat), 3),
    lng: destinoId ? Number(o.lng) : casas(Number(o.lng), 3),
    modo_preferido: ehModo(o.modo_preferido) ? o.modo_preferido : "carro",
    ...((OPCOES_ATE as readonly number[]).includes(ate) ? { ate_min: ate } : {}),
  };
}

/** Local salvo → destino padrão da busca (destino cadastrado pelo slug; endereço com 2 casas na URL). */
export function localComoBusca(l: LocalTrabalho | null, slugDoDestino: (id: string) => string | null): DestinoDaBusca | null {
  if (!l) return null;
  const slug = l.destino_id ? slugDoDestino(l.destino_id) : null;
  if (slug) return { slug, modo: l.modo_preferido, ate: l.ate_min ?? 0 };
  if (l.destino_id) return null; // destino desativado: não vira busca por ponto (o rótulo é de lugar cadastrado)
  return { ponto: { lat: casas(l.lat, 2), lng: casas(l.lng, 2), rotulo: l.rotulo }, modo: l.modo_preferido, ate: l.ate_min ?? 0 };
}

/** O que o DONO vê do destino de um pedido: só o rótulo e os minutos até o imóvel dele. */
export function destinoParaDono(
  destino: unknown,
  nomeCurtoDoDestino: (id: string) => string | null,
  minutosAteOImovel: number | null
): { rotulo: string; tempo: string } | null {
  const l = normalizarLocal(destino);
  if (!l) return null;
  const nome = l.destino_id ? nomeCurtoDoDestino(l.destino_id) : null;
  const rotulo = nome ? `perto ${/^(ufu|universidade|faculdade|escola|clínica|clinica)\b/i.test(nome) ? "da" : "do"} ${nome}` : "perto do local de trabalho informado";
  const t = minutosAteOImovel != null ? rotuloTempo({ minutos: minutosAteOImovel, modo: l.modo_preferido }) : "";
  const tempo = t ? `${t} do seu imóvel` : "";
  return { rotulo, tempo };
}

/** Pedido: o tempo até o destino deixa compatível? (sem "até N min" ou sem destino: não muda nada). */
export function situacaoComTempo(
  situacao: "compativel" | "quase" | "demais",
  ateMin: number | null | undefined,
  minutos: number | null | undefined
): "compativel" | "quase" | "demais" {
  if (!ateMin || situacao === "demais") return situacao;
  if (minutos == null) return situacao; // ainda sem tempo calculado: não pune por palpite
  const m = Math.ceil(minutos / 5) * 5;
  if (m <= ateMin) return situacao;
  return m <= ateMin + 10 ? "quase" : "demais";
}
