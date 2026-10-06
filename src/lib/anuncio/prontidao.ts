/*
  PRONTIDÃO DO ANÚNCIO — fonte única de "o que falta para publicar" (PURO).

  Uma pergunta, uma resposta, em todo lugar: editor (Revisão e botão Publicar),
  Meus imóveis, Visão geral, ação do servidor, FAQ e a ferramenta da Viva.

  Dois grupos que NUNCA se misturam:
    • obrigatórios — sem eles não publica (o banco também barra fotos e documento);
    • opcionais    — melhoram o anúncio (selo, vídeo…). Nunca bloqueiam e nunca
                     entram no "falta".
*/

export const MIN_FOTOS = 8;

export type StatusDocumento = "none" | "pending" | "approved" | "rejected";

export interface FatosAnuncio {
  enderecoOk: boolean;
  /** Ao menos 1 banheiro e área > 0 (quartos podem ser 0 — studio). */
  detalhesOk: boolean;
  periodoOk: boolean;
  fotos: number;
  titulo: string;
  preco: number;
  garantiaOk: boolean;
  /** Sublocação sem autorização não publica. */
  sublocacaoOk: boolean;
  documento: StatusDocumento;
  /** null = não se aplica/não verificado aqui (ex.: editor sem consulta do plano). */
  limitePlanoOk: boolean | null;
  // Opcionais
  descricao: string;
  capacidade: number;
  disponivelDesde: boolean;
  selo: boolean;
  video: boolean;
}

export interface ItemProntidao {
  key: string;
  label: string;
  ok: boolean;
  /** Etapa do editor onde se resolve (0..6). */
  etapa: number;
  /** Explicação curta quando falta (ex.: "em análise pela equipe"). */
  detalhe?: string;
}

export interface Prontidao {
  podePublicar: boolean;
  obrigatorios: ItemProntidao[];
  /** Rótulos dos obrigatórios que faltam (com o detalhe). */
  faltam: string[];
  opcionais: ItemProntidao[];
  /** Rótulos dos opcionais que melhorariam o anúncio. */
  melhorar: string[];
  /** % dos obrigatórios cumpridos (o "X% completo" de todas as telas). */
  pct: number;
}

const DOC_DETALHE: Record<StatusDocumento, string> = {
  none: "ainda não enviado",
  pending: "em análise pela equipe (avisamos por e-mail quando for aprovado)",
  approved: "aprovado",
  rejected: "reprovado — envie de novo",
};

/** Rótulos dos obrigatórios, na ordem (o FAQ e a Viva usam esta lista). */
export const OBRIGATORIOS_ROTULOS = [
  "Endereço preenchido",
  "Detalhes básicos (banheiros e área)",
  "Período mínimo definido",
  `Pelo menos ${MIN_FOTOS} fotos`,
  "Título do anúncio",
  "Preço mensal",
  "Garantia aceita",
  "Documento do imóvel aprovado",
] as const;

export function prontidaoAnuncio(f: FatosAnuncio): Prontidao {
  const obrigatorios: ItemProntidao[] = [
    { key: "endereco", label: OBRIGATORIOS_ROTULOS[0], ok: f.enderecoOk, etapa: 1 },
    { key: "detalhes", label: OBRIGATORIOS_ROTULOS[1], ok: f.detalhesOk, etapa: 2 },
    { key: "periodo", label: OBRIGATORIOS_ROTULOS[2], ok: f.periodoOk, etapa: 2 },
    { key: "fotos", label: OBRIGATORIOS_ROTULOS[3], ok: f.fotos >= MIN_FOTOS, etapa: 3, detalhe: f.fotos < MIN_FOTOS ? `tem ${f.fotos}` : undefined },
    { key: "titulo", label: OBRIGATORIOS_ROTULOS[4], ok: f.titulo.trim().length >= 3, etapa: 5 },
    { key: "preco", label: OBRIGATORIOS_ROTULOS[5], ok: f.preco > 0, etapa: 5 },
    { key: "garantia", label: OBRIGATORIOS_ROTULOS[6], ok: f.garantiaOk, etapa: 5 },
    { key: "documento", label: OBRIGATORIOS_ROTULOS[7], ok: f.documento === "approved", etapa: 0, detalhe: f.documento === "approved" ? undefined : DOC_DETALHE[f.documento] },
  ];
  if (!f.sublocacaoOk) obrigatorios.push({ key: "sublocacao", label: "Autorização de sublocação", ok: false, etapa: 0 });
  if (f.limitePlanoOk === false) {
    obrigatorios.push({ key: "limite", label: "Vaga no seu plano", ok: false, etapa: 6, detalhe: "o plano já tem o máximo de anúncios publicados — pause um ou faça upgrade" });
  }
  const opcionais: ItemProntidao[] = [
    { key: "descricao", label: "Descrição com 60+ caracteres", ok: f.descricao.trim().length >= 60, etapa: 5 },
    { key: "capacidade", label: "Capacidade (pessoas)", ok: f.capacidade > 0, etapa: 2 },
    { key: "disponibilidade", label: "Disponível a partir de", ok: f.disponivelDesde, etapa: 2 },
    { key: "selo", label: "Selo Pronto para Morar", ok: f.selo, etapa: 0 },
    { key: "video", label: "Vídeo do imóvel", ok: f.video, etapa: 3 },
  ];
  const cumpridos = obrigatorios.filter((i) => i.ok).length;
  return {
    podePublicar: obrigatorios.every((i) => i.ok),
    obrigatorios,
    faltam: obrigatorios.filter((i) => !i.ok).map((i) => (i.detalhe ? `${i.label} (${i.detalhe})` : i.label)),
    opcionais,
    melhorar: opcionais.filter((i) => !i.ok).map((i) => i.label),
    pct: Math.round((cumpridos / obrigatorios.length) * 100),
  };
}

/** Linha do banco (properties + fotos + documento) → fatos. */
export interface LinhaAnuncio {
  title: string | null;
  address: string | null;
  city: string | null;
  bathrooms: number | null;
  area_m2: number | null;
  min_period_days: number | null;
  monthly_price: number | string | null;
  garantias_aceitas: string[] | null;
  ownership_type: string | null;
  sublease_authorized: boolean | null;
  description: string | null;
  max_guests: number | null;
  available_from: string | null;
  ready_to_live_badge: boolean | null;
  video_url: string | null;
}

export function fatosDaLinha(p: LinhaAnuncio, fotos: number, documento: StatusDocumento, limitePlanoOk: boolean | null): FatosAnuncio {
  return {
    enderecoOk: !!(p.address?.trim() && p.city?.trim()),
    detalhesOk: (Number(p.bathrooms) || 0) >= 1 && (Number(p.area_m2) || 0) > 0,
    periodoOk: (Number(p.min_period_days) || 0) > 0,
    fotos,
    titulo: p.title ?? "",
    preco: Number(p.monthly_price) || 0,
    garantiaOk: (p.garantias_aceitas ?? []).length > 0,
    sublocacaoOk: p.ownership_type !== "subleased" || !!p.sublease_authorized,
    documento,
    limitePlanoOk,
    descricao: p.description ?? "",
    capacidade: Number(p.max_guests) || 0,
    disponivelDesde: !!p.available_from,
    selo: !!p.ready_to_live_badge,
    video: !!p.video_url,
  };
}
