/*
  E611: as leituras do calendário do dono vão por GET (/api/imoveis/[id]/calendario), não por Server Action — o Next
  despacha as Server Actions uma por vez por aba, e no cadastro o calendário e o link de exportação ficavam em
  "Carregando" atrás do autosave. Mesmo contrato de antes: devolve o valor ou LANÇA na falha (a tela mostra o aviso).
*/
import type { BlocoDatas } from "@/lib/data/blocks-actions";
import type { EstadiaCalendario } from "@/lib/data/estadias-calendario";

type Parte = "blocos" | "estadias" | "exportacao";

async function ler<T>(propertyId: string, parte: Parte): Promise<T> {
  const r = await fetch(`/api/imoveis/${encodeURIComponent(propertyId)}/calendario?parte=${parte}`, { cache: "no-store" });
  const j = (await r.json().catch(() => null)) as { ok?: boolean; valor?: T; error?: string } | null;
  if (!r.ok || !j?.ok) throw new Error(j?.error ?? "Não foi possível ler o calendário.");
  return j.valor as T;
}

export const lerBlocos = (propertyId: string) => ler<BlocoDatas[]>(propertyId, "blocos");
export const lerEstadias = (propertyId: string) => ler<EstadiaCalendario[]>(propertyId, "estadias");
export const lerLinkExportacao = (propertyId: string) =>
  ler<{ ok: boolean; demo?: boolean; url?: string; error?: string }>(propertyId, "exportacao");
