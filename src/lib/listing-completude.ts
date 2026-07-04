/*
  Completude do anúncio (Dashboard Fase 3) — regras PURAS e testáveis.

  "Anúncio completo rende mais": este cálculo dá ao proprietário um % e a lista
  do que falta. Mantido SEM imports para rodar no `node --test`.

  Só usa campos que existem no Property. O mínimo de 5 fotos para PUBLICAR
  (ADENDO 3-B) é sinalizado por `podePublicar`.
*/

/** Campos do imóvel usados no cálculo (subconjunto de Property). */
export interface ImovelCompletude {
  photos?: string[];
  description?: string;
  monthlyPrice?: number;
  maxGuests?: number;
  availableFrom?: string;
  garantiasAceitas?: string[];
  readyToLiveBadge?: boolean;
  videoUrl?: string;
  areaM2?: number;
}

export interface ItemCompletude {
  key: string;
  label: string;
  ok: boolean;
  peso: number;
}

export interface ResultadoCompletude {
  pct: number; // 0..100
  itens: ItemCompletude[];
  faltando: string[]; // rótulos dos itens não preenchidos
  podePublicar: boolean; // exige ≥ 5 fotos (ADENDO 3-B)
}

/** Nº mínimo de fotos para publicar (ADENDO 3-B). */
export const MIN_FOTOS_PUBLICAR = 5;

function temFoto(s?: string): boolean {
  return typeof s === "string" && (/^https?:\/\//.test(s) || s.startsWith("/"));
}

/** Calcula a completude do anúncio a partir dos campos preenchidos. */
export function completudeAnuncio(im: ImovelCompletude): ResultadoCompletude {
  const fotos = (im.photos ?? []).filter(temFoto);
  const itens: ItemCompletude[] = [
    { key: "fotos", label: `Pelo menos ${MIN_FOTOS_PUBLICAR} fotos`, ok: fotos.length >= MIN_FOTOS_PUBLICAR, peso: 3 },
    { key: "descricao", label: "Descrição (60+ caracteres)", ok: (im.description ?? "").trim().length >= 60, peso: 2 },
    { key: "preco", label: "Preço definido", ok: (im.monthlyPrice ?? 0) > 0, peso: 2 },
    { key: "capacidade", label: "Capacidade (pessoas)", ok: (im.maxGuests ?? 0) > 0, peso: 1 },
    { key: "area", label: "Área (m²)", ok: (im.areaM2 ?? 0) > 0, peso: 1 },
    { key: "disponibilidade", label: "Disponível a partir de", ok: !!im.availableFrom, peso: 1 },
    { key: "garantias", label: "Garantias aceitas", ok: (im.garantiasAceitas ?? []).length > 0, peso: 1 },
    { key: "selo", label: "Selo Pronto para Morar", ok: !!im.readyToLiveBadge, peso: 1 },
    { key: "video", label: "Vídeo do imóvel", ok: !!im.videoUrl, peso: 1 },
  ];
  const pesoTotal = itens.reduce((s, i) => s + i.peso, 0);
  const pesoOk = itens.reduce((s, i) => s + (i.ok ? i.peso : 0), 0);
  const pct = Math.round((pesoOk / pesoTotal) * 100);
  return {
    pct,
    itens,
    faltando: itens.filter((i) => !i.ok).map((i) => i.label),
    podePublicar: fotos.length >= MIN_FOTOS_PUBLICAR,
  };
}
