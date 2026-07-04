/*
  Catálogo único das faixas de prazo e das garantias aceitas. Fonte usada pelo
  cadastro, pela busca e pelo fechamento — mesmos valores e rótulos em todo lugar.
  Os avisos por faixa são CONFIGURÁVEIS aqui (texto, não regra fixa em UI); o
  texto jurídico dos contratos vem depois, via tabela modelos_contrato.
*/

export type FaixaPrazo = "temporada" | "media_estadia" | "longa";

export interface FaixaDef {
  key: FaixaPrazo;
  label: string;
  min: number; // dias
  max: number | null; // null = sem teto (180+)
  resumo: string; // faixa de dias, curto
  aviso: string; // explicação do regime (configurável)
}

export const FAIXAS: FaixaDef[] = [
  {
    key: "temporada",
    label: "Temporada",
    min: 30,
    max: 90,
    resumo: "30 a 90 dias",
    aviso:
      "Locação por temporada (art. 48 da Lei 8.245/91). Ao fim do prazo, a plataforma conduz a retomada do imóvel ou um novo contrato — não há prorrogação automática.",
  },
  {
    key: "media_estadia",
    label: "Média estadia",
    min: 90,
    max: 180,
    resumo: "90 a 180 dias",
    aviso:
      "Estadia de média duração (90 a 180 dias): regime intermediário, com contrato próprio para o período.",
  },
  {
    key: "longa",
    label: "Longa duração",
    min: 180,
    max: null,
    resumo: "180+ dias",
    aviso:
      "Locação de longa duração (180 dias ou mais): regras de locação residencial podem se aplicar — contrato específico.",
  },
];

const FAIXA_BY_KEY: Record<string, FaixaDef> = Object.fromEntries(FAIXAS.map((f) => [f.key, f]));

export function faixaLabel(key: string): string {
  return FAIXA_BY_KEY[key]?.label ?? key;
}

/** Faixa “natural” para um prazo mínimo em dias (para sugestão no cadastro). */
export function faixaForDays(dias: number): FaixaPrazo {
  if (dias < 90) return "temporada";
  if (dias < 180) return "media_estadia";
  return "longa";
}

// ── Garantias aceitas ──
// Onda 1 (Dra. Beatriz): o "título de capitalização" foi APOSENTADO — não é
// mais oferecido. A chave 'titulo' permanece no TIPO e no banco só para não
// quebrar histórico (imóveis antigos que já a tinham); ela apenas não aparece
// no catálogo `GARANTIAS_FAIXA`, então não é mais selecionável no cadastro.

export type GarantiaKey = "caucao_avista" | "caucao_parcelada" | "titulo" | "seguro_fianca";

export interface GarantiaDef {
  key: GarantiaKey;
  label: string;
}

export const GARANTIAS_FAIXA: GarantiaDef[] = [
  { key: "caucao_avista", label: "Caução à vista" },
  { key: "caucao_parcelada", label: "Caução parcelada" },
  { key: "seguro_fianca", label: "Seguro-fiança" },
];

/**
 * Flag da UI PÚBLICA para a modalidade "caução parcelada" (B1 do E2E). Enquanto
 * a mecânica de pagamento da caução aguarda parecer jurídico, a interface
 * pública NÃO expõe "à vista / parcelada" como opções distintas — mostra só
 * "Caução". Religue com NEXT_PUBLIC_CAUCAO_PARCELADA_UI=on quando o jurídico
 * liberar. Os valores/enum do banco permanecem intactos.
 */
export const CAUCAO_PARCELADA_UI = process.env.NEXT_PUBLIC_CAUCAO_PARCELADA_UI === "on";

/** Garantias exibidas no filtro PÚBLICO da busca (caução unificada + seguro). */
export const GARANTIAS_PUBLICAS: { key: string; label: string }[] = [
  { key: "caucao", label: "Caução" },
  { key: "seguro_fianca", label: "Seguro-fiança" },
];

/** Rótulo mesmo para chaves aposentadas (histórico), como 'titulo'. */
const GARANTIA_LABELS: Record<string, string> = {
  caucao_avista: "Caução à vista",
  caucao_parcelada: "Caução parcelada",
  titulo: "Título de capitalização",
  seguro_fianca: "Seguro-fiança",
};

export function garantiaLabel(key: string): string {
  return GARANTIA_LABELS[key] ?? key;
}
