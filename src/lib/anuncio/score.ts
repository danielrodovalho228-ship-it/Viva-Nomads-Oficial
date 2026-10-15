/*
  SCORE DE QUALIDADE DO ANÚNCIO (ordem 0f9b9d58) — PURO e testável.

  Usa a MESMA lista da prontidão (lib/anuncio/prontidao.ts): os obrigatórios
  valem 70 pontos (divididos igualmente) e a qualidade vale mais 30:

    fotos: 12+ ............ 8     descrição: 40+ palavras ... 6
    comodidades: 5+ ....... 6     regras de pet definidas ... 4
    vídeo ................. 3     Selo Pronto para Morar .... 3

  Cada dica que falta é clicável e leva à etapa certa do editor. Recalculado
  no servidor a cada leitura do rascunho (logo, ao salvar/editar o anúncio).
*/
import type { FatosAnuncio, Prontidao } from "./prontidao.ts";

export const PONTOS_OBRIGATORIOS = 70;
export const MIN_FOTOS_BOAS = 12;
export const MIN_PALAVRAS = 40;
export const MIN_COMODIDADES = 5;

export interface ExtrasQualidade {
  comodidades: number;
  /** O dono definiu as regras de pets (aceita ou não, com detalhes). */
  petsDefinido: boolean;
}

export interface DicaScore {
  key: string;
  label: string;
  pontos: number;
  /** Etapa do editor onde se resolve (0..6). */
  etapa: number;
}

export interface ScoreAnuncio {
  /** 0 a 100, inteiro. */
  score: number;
  /** O que falta para subir, do que mais vale ao que menos vale. */
  dicas: DicaScore[];
}

export function contarPalavras(texto: string): number {
  const t = texto.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function scoreAnuncio(p: Prontidao, f: FatosAnuncio, x: ExtrasQualidade): ScoreAnuncio {
  const total = p.obrigatorios.length;
  const cumpridos = p.obrigatorios.filter((i) => i.ok).length;
  let pontos = total > 0 ? (cumpridos / total) * PONTOS_OBRIGATORIOS : 0;
  const dicas: DicaScore[] = [];

  // Obrigatórios que faltam também viram dica (a mesma lista do checklist).
  const porItem = total > 0 ? PONTOS_OBRIGATORIOS / total : 0;
  for (const i of p.obrigatorios) {
    if (!i.ok) dicas.push({ key: i.key, label: i.label, pontos: Math.round(porItem), etapa: i.key === "documento" ? 6 : i.etapa });
  }

  const qualidade: { key: string; label: string; pontos: number; etapa: number; ok: boolean }[] = [
    { key: "fotos12", label: `Adicione fotos: ${MIN_FOTOS_BOAS}+ aparecem mais na busca (tem ${f.fotos})`, pontos: 8, etapa: 3, ok: f.fotos >= MIN_FOTOS_BOAS },
    { key: "palavras", label: `Descrição com pelo menos ${MIN_PALAVRAS} palavras`, pontos: 6, etapa: 5, ok: contarPalavras(f.descricao) >= MIN_PALAVRAS },
    { key: "comodidades", label: `Marque as comodidades (pelo menos ${MIN_COMODIDADES})`, pontos: 6, etapa: 4, ok: x.comodidades >= MIN_COMODIDADES },
    { key: "pets", label: "Defina as regras de pet", pontos: 4, etapa: 2, ok: x.petsDefinido },
    { key: "video", label: "Adicione um vídeo do imóvel", pontos: 3, etapa: 3, ok: f.video },
    { key: "selo", label: "Peça o Selo Pronto para Morar", pontos: 3, etapa: 0, ok: f.selo },
  ];
  for (const q of qualidade) {
    if (q.ok) pontos += q.pontos;
    else dicas.push({ key: q.key, label: q.label, pontos: q.pontos, etapa: q.etapa });
  }
  dicas.sort((a, b) => b.pontos - a.pontos);
  return { score: Math.max(0, Math.min(100, Math.round(pontos))), dicas };
}
