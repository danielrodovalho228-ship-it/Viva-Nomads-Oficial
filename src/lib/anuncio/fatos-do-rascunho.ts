/*
  E556 (família E497/E498) — a completude do RASCUNHO nas telas de progresso (Meus imóveis, Início) usa a mesma regra
  do editor para os itens que, no rascunho, só existem no draft_data: as colunas internet_mbps e sem_cameras_interior
  são gravadas ao publicar, então ler só a coluna dava "falta" para o que o dono já salvou. Puro (node --test).
   • internet:   draft_data.internetMbps válido (mbpsValido, o mesmo do editor) > 0;
   • privacidade: draft_data.privacidade.semCamerasInterior === true (o editor parte de PRIVACIDADE_VAZIA = false).
  Chave ausente no draft_data = rascunho antigo → fica o que veio do banco (nunca inventa "ok" nem "falta").
*/
import { mbpsValido } from "./sugestoes-cadastro.ts";
import type { FatosAnuncio } from "./prontidao.ts";

export function fatosDoRascunho(draftData: unknown, f: FatosAnuncio): FatosAnuncio {
  if (!draftData || typeof draftData !== "object") return f;
  const d = draftData as Record<string, unknown>;
  const out: FatosAnuncio = { ...f };
  if ("internetMbps" in d && f.internetOk !== undefined) out.internetOk = (mbpsValido(d.internetMbps) ?? 0) > 0;
  const priv = d.privacidade;
  if (priv && typeof priv === "object") out.privacidadeOk = (priv as { semCamerasInterior?: unknown }).semCamerasInterior === true;
  return out;
}
