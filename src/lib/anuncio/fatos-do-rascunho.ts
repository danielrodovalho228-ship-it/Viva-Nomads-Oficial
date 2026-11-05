/*
  E556 (família E497/E498) — a completude do RASCUNHO tem UMA fonte: o draft_data, lido pela mesma função no card
  (Meus imóveis, Início) e no editor (barra "N% pronto" e revisão). As colunas do imóvel só guardam parte do rascunho
  (algumas só são gravadas ao publicar: garantias_aceitas, internet_mbps, sem_cameras_interior…), então ler as colunas
  dava "falta" para o que o dono já salvou — e o card e a revisão discordavam (reprova de 05/11: "Garantia aceita").
  Cada item é calculado pela MESMA regra do editor; chave ausente no draft_data = rascunho antigo → fica o que veio do
  banco (nunca inventa "ok" nem "falta"). Os fatos que não moram no rascunho (documento, sublocação, padrão mínimo,
  qualificação, chácara) seguem do banco. Puro (node --test).
*/
import { mbpsValido } from "./sugestoes-cadastro.ts";
import { tipoEntradaValido } from "./chegada-e-pedido.ts";
import { manualSemEndereco } from "./proximidades.ts";
import { videoDoAnuncio } from "../video-anuncio.ts";
import type { Proximity } from "../types";
import type { FatosAnuncio } from "./prontidao.ts";

const tem = (d: Record<string, unknown>, ...k: string[]) => k.some((x) => x in d);
const txt = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

export function fatosDoRascunho(draftData: unknown, f: FatosAnuncio, opcoes: { publicado?: boolean } = {}): FatosAnuncio {
  if (!draftData || typeof draftData !== "object") return f;
  const d = draftData as Record<string, unknown>;
  const out: FatosAnuncio = { ...f };
  if (tem(d, "street", "neighborhood", "city")) out.enderecoOk = !!(txt(d.street).trim() && txt(d.neighborhood).trim() && txt(d.city).trim());
  if (tem(d, "bathrooms", "areaM2")) out.detalhesOk = (Number(d.bathrooms) || 0) >= 1 && (Number(d.areaM2) || 0) > 0;
  if ("minPeriod" in d) out.periodoOk = (Number(d.minPeriod) || 0) > 0;
  if (Array.isArray(d.photos)) out.fotos = d.photos.length;
  if ("title" in d) out.titulo = txt(d.title);
  if ("monthlyPrice" in d) out.preco = Number(d.monthlyPrice) || 0;
  if (d.garantias && typeof d.garantias === "object") out.garantiaOk = Object.values(d.garantias as Record<string, unknown>).some(Boolean);
  const priv = d.privacidade;
  if (priv && typeof priv === "object") out.privacidadeOk = (priv as { semCamerasInterior?: unknown }).semCamerasInterior === true;
  if ("description" in d) out.descricao = txt(d.description);
  if (d.qual && typeof d.qual === "object") out.selo = (d.qual as { baseBadge?: unknown }).baseBadge === true;
  if (tem(d, "videoUrl", "videoArquivo")) out.video = videoDoAnuncio({ videoArquivo: txt(d.videoArquivo) || null, videoUrl: txt(d.videoUrl) || null }).tipo !== null;
  if (Array.isArray(d.manualProximities)) out.proximidadesSemEndereco = (d.manualProximities as Proximity[]).filter(manualSemEndereco).length;
  // O anúncio já publicado não tem estes dois itens no portão (o editor também não os passa).
  if (!opcoes.publicado) {
    // O tipo de entrada só vai ao draft_data quando preenchido (payloadDaChegada); ausente = o do banco.
    if (typeof d.tipoEntrada === "string") out.tipoEntradaOk = tipoEntradaValido(d.tipoEntrada);
    if ("internetMbps" in d && f.internetOk !== undefined) out.internetOk = (mbpsValido(d.internetMbps) ?? 0) > 0;
  }
  return out;
}
