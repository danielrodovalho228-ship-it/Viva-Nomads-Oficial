/*
  PRONTIDÃO DO ANÚNCIO — fonte única de "o que falta para publicar" (PURO).

  Uma pergunta, uma resposta, em todo lugar: editor (Revisão e botão Publicar),
  Meus imóveis, Visão geral, ação do servidor, FAQ e a ferramenta da Viva.

  Dois grupos que NUNCA se misturam:
    • obrigatórios — sem eles não publica (o banco também barra fotos e documento);
    • opcionais    — só Selo Pronto para Morar e vídeo. Melhoram o anúncio,
                     nunca bloqueiam, nunca entram no "falta" nem baixam a %.
*/

import { declaracaoCamerasFeita } from "./privacidade.ts";
import { exigeAutorizacao, ROTULO_FALTA_AUTORIZACAO } from "./operacao.ts";

export const MIN_FOTOS = 8;
export const MIN_DESCRICAO = 60;

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
  /** Sublocado/administrado sem a autorização (declaração + documento anexado) não publica. */
  sublocacaoOk: boolean;
  /** Declaração "sem câmeras/dispositivos de gravação dentro do imóvel" feita (ordem f92bc582). */
  privacidadeOk: boolean;
  /** "own" | "subleased" | "managed" — só muda o rótulo do item que falta. */
  operacao?: string | null;
  documento: StatusDocumento;
  /** null = não se aplica/não verificado aqui (ex.: editor sem consulta do plano). */
  limitePlanoOk: boolean | null;
  /** Obrigatória: mínimo de MIN_DESCRICAO caracteres. */
  descricao: string;
  // Opcionais
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

/** Rótulo curto do documento na prontidão do editor (o inquilino nunca vê isto). */
export function rotuloDocumento(status: StatusDocumento, motivo?: string | null): string {
  if (status === "approved") return "Aprovado";
  if (status === "pending") return "Em análise";
  if (status === "rejected") {
    const m = motivo?.trim();
    return m ? `Reprovado: ${m}` : "Reprovado";
  }
  return "Não enviado";
}

const DOC_DETALHE: Record<StatusDocumento, string> = {
  none: "ainda não enviado",
  pending: "em análise pela equipe (avisamos por e-mail quando for aprovado)",
  approved: "aprovado",
  rejected: "reprovado — envie de novo",
};

/** Item condicional (como a autorização): só aparece quando a declaração falta. */
export const ROTULO_FALTA_PRIVACIDADE = "Declaração de privacidade (sem câmeras dentro do imóvel)";

/** Rótulos dos obrigatórios, na ordem (o FAQ e a Viva usam esta lista). */
export const OBRIGATORIOS_ROTULOS = [
  "Endereço preenchido",
  "Detalhes básicos (banheiros e área)",
  "Período mínimo definido",
  `Pelo menos ${MIN_FOTOS} fotos`,
  "Título do anúncio",
  `Descrição com ${MIN_DESCRICAO}+ caracteres`,
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
    {
      key: "descricao",
      label: OBRIGATORIOS_ROTULOS[5],
      ok: f.descricao.trim().length >= MIN_DESCRICAO,
      etapa: 5,
      detalhe: f.descricao.trim().length < MIN_DESCRICAO ? `tem ${f.descricao.trim().length}` : undefined,
    },
    { key: "preco", label: OBRIGATORIOS_ROTULOS[6], ok: f.preco > 0, etapa: 5 },
    { key: "garantia", label: OBRIGATORIOS_ROTULOS[7], ok: f.garantiaOk, etapa: 5 },
    { key: "documento", label: OBRIGATORIOS_ROTULOS[8], ok: f.documento === "approved", etapa: 0, detalhe: f.documento === "approved" ? undefined : DOC_DETALHE[f.documento] },
  ];
  if (!f.sublocacaoOk) {
    const label = f.operacao === "managed" ? ROTULO_FALTA_AUTORIZACAO.managed : ROTULO_FALTA_AUTORIZACAO.subleased;
    obrigatorios.push({ key: "sublocacao", label, ok: false, etapa: 0 });
  }
  if (!f.privacidadeOk) {
    obrigatorios.push({ key: "privacidade", label: ROTULO_FALTA_PRIVACIDADE, ok: false, etapa: 2 });
  }
  if (f.limitePlanoOk === false) {
    obrigatorios.push({ key: "limite", label: "Vaga no seu plano", ok: false, etapa: 6, detalhe: "o plano já tem o máximo de anúncios publicados — pause um ou faça upgrade" });
  }
  const opcionais: ItemProntidao[] = [
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

export interface ItemChecklist {
  key: string;
  label: string;
  ok: boolean;
  detalhe?: string;
  /** Leva ao campo certo (etapa do editor do rascunho, ou à página do plano). */
  href: string;
}

export interface ChecklistAnuncio {
  itens: ItemChecklist[];
  /** Primeiro item que falta, em destaque ("próximo passo"); null = tudo feito. */
  proximo: ItemChecklist | null;
}

/**
 * Checklist clicável do "Anúncio em andamento" (ordem de8761b0, item 1): cada
 * obrigatório vira ✓ feito / ○ falta com link direto para a etapa do editor.
 * O documento é aprovado pela equipe (não se resolve numa etapa): leva à Revisão,
 * onde o estado da moderação aparece. A vaga no plano leva à página do plano.
 */
export function checklistAnuncio(p: Prontidao, draftId: string): ChecklistAnuncio {
  const id = encodeURIComponent(draftId);
  const itens = p.obrigatorios.map((i): ItemChecklist => {
    const etapa = i.key === "documento" ? 6 : i.etapa;
    return {
      key: i.key,
      label: i.label,
      ok: i.ok,
      detalhe: i.detalhe,
      href: i.key === "limite" ? "/precos" : `/dashboard/imoveis/novo?draft=${id}&etapa=${etapa}`,
    };
  });
  return { itens, proximo: itens.find((i) => !i.ok) ?? null };
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
  /** 0091: o documento da operação está anexado (undefined = banco sem a 0091). */
  autorizacao_anexada?: boolean | null;
  /** 0116: declaração de privacidade (undefined = banco sem a 0116 → não barra). */
  sem_cameras_interior?: boolean | null;
  description: string | null;
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
    // Sem a 0091 (coluna ausente) vale a regra antiga: só a declaração.
    sublocacaoOk: !exigeAutorizacao(p.ownership_type) || (!!p.sublease_authorized && p.autorizacao_anexada !== false),
    privacidadeOk: p.sem_cameras_interior === undefined ? true : declaracaoCamerasFeita(p.sem_cameras_interior),
    operacao: p.ownership_type,
    documento,
    limitePlanoOk,
    descricao: p.description ?? "",
    selo: !!p.ready_to_live_badge,
    video: !!p.video_url,
  };
}

export interface FaixaDocumentoAprovado {
  titulo: string;
  /** Rótulos que ainda faltam (sem o documento, que já está aprovado). Vazio = é só publicar. */
  faltam: string[];
}

/**
 * Faixa "Documento aprovado — falta publicar" (#58): aparece só em rascunho cujo
 * documento já foi aprovado, para o dono não esperar por algo que já aconteceu.
 * Diz exatamente o que falta (o botão Publicar usa a mesma lista).
 */
export function faixaDocumentoAprovado(comp: Prontidao, statusImovel: string): FaixaDocumentoAprovado | null {
  if (statusImovel !== "draft") return null;
  const doc = comp.obrigatorios.find((i) => i.key === "documento");
  if (!doc?.ok) return null;
  const faltam = comp.obrigatorios.filter((i) => !i.ok).map((i) => (i.detalhe ? `${i.label} (${i.detalhe})` : i.label));
  return {
    titulo: faltam.length === 0 ? "Documento aprovado — é só publicar" : "Documento aprovado — falta publicar",
    faltam,
  };
}
