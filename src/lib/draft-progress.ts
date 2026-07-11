// Mínimo de fotos da checklist de publicação do editor. Espelha `MIN_PHOTOS` de
// lib/listing (mantido sem import para este módulo rodar sob `node --test`, que
// não resolve o alias `@`); o teste `draft-progress.test.ts` trava os dois para
// que nunca divirjam.
const MIN_PHOTOS = 8;

/** Snapshot do editor de anúncio, tal como gravado em `properties.draft_data`
 * (autosave — P0). Só os campos que contam para o "% completo". */
export interface DraftSnapshot {
  title?: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  bathrooms?: string;
  areaM2?: string;
  minPeriod?: string;
  monthlyPrice?: string;
  photos?: unknown[];
}

/**
 * "% completo" HONESTO de um rascunho — mesmos marcos da checklist de publicação
 * do editor (sem o item de moderação do documento, que não é do rascunho). Serve
 * ao banner "Você tem um anúncio em andamento" e ao card da Visão geral, para o
 * número bater com o que o proprietário vê na etapa Revisão.
 */
export function draftCompletionPct(d: DraftSnapshot | null | undefined): number {
  if (!d || typeof d !== "object") return 0;
  const marcos = [
    !!(d.street?.trim() && d.neighborhood?.trim() && d.city?.trim()),
    (Number(d.bathrooms) || 0) >= 1 && (Number(d.areaM2) || 0) > 0,
    (Number(d.minPeriod) || 0) > 0,
    Array.isArray(d.photos) && d.photos.length >= MIN_PHOTOS,
    (d.title?.trim().length || 0) >= 3,
    Number(d.monthlyPrice) > 0,
  ];
  return Math.round((marcos.filter(Boolean).length / marcos.length) * 100);
}
