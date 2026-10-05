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
  max: number; // dias (no máximo 180)
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
      "Locação por temporada (art. 48 da Lei 8.245/91). Ao fim do prazo, proprietário e inquilino combinam a saída ou um novo contrato pela plataforma — não há prorrogação automática.",
  },
  {
    key: "media_estadia",
    label: "Média duração",
    min: 90,
    max: 180,
    resumo: "90 a 180 dias",
    aviso:
      "Locação de média duração (90 a 180 dias): contrato próprio para o período, diferente da locação de curta duração.",
  },
];
// "Longa duração (180+ dias)" saiu: a plataforma é de 30 a 180 dias. A chave
// 'longa' fica no TIPO só para não quebrar registros antigos.

const FAIXA_BY_KEY: Record<string, FaixaDef> = Object.fromEntries(FAIXAS.map((f) => [f.key, f]));

export function faixaLabel(key: string): string {
  if (key === "longa") return "Média duração";
  return FAIXA_BY_KEY[key]?.label ?? key;
}

/** Faixa “natural” para um prazo mínimo em dias (para sugestão no cadastro). */
export function faixaForDays(dias: number): FaixaPrazo {
  if (dias < 90) return "temporada";
  return "media_estadia"; // o máximo da plataforma é 180 dias
}

// ── Garantias aceitas ──
// Onda 1 (Dra. Beatriz): o "título de capitalização" foi APOSENTADO — não é
// mais oferecido. A chave 'titulo' permanece no TIPO e no banco só para não
// quebrar histórico (imóveis antigos que já a tinham); ela apenas não aparece
// no catálogo `GARANTIAS_FAIXA`, então não é mais selecionável no cadastro.

export type GarantiaKey = "caucao_avista" | "caucao_parcelada" | "titulo" | "seguro_fianca";

/**
 * Frase ÚNICA da caução em todo o site (nome: só "Caução", sem a marca — a
 * plataforma não guarda nem garante o dinheiro; ver CDC). Mudar aqui muda em
 * todo lugar. TODO(juridico): redação validada com a Dra. Beatriz.
 */
export const CAUCAO_FRASE =
  "Caução devolvível de até 3 aluguéis, em poupança — a plataforma não tem acesso ao dinheiro.";

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

export interface GarantiaCadastro {
  key: GarantiaKey;
  label: string;
  microtext?: string;
  disabled?: boolean;
  badge?: string;
}

/**
 * Garantias oferecidas no CADASTRO do anúncio (estados honestos — ADENDO
 * garantias). TODO(juridico): redação final da caução e do seguro.
 *  • Caução renomeada e explicada (depósito devolvível, poupança da caução).
 *  • "Caução parcelada" só aparece com a flag (fora da UI até o parecer).
 *  • Seguro-fiança VISÍVEL porém DESABILITADO ("Em breve — via parceiro") — o
 *    produto ainda não existe; marcar hoje bateria em nada no fechamento.
 */
export const GARANTIAS_CADASTRO: GarantiaCadastro[] = [
  {
    key: "caucao_avista",
    label: "Caução (depósito devolvível)",
    microtext: `${CAUCAO_FRASE} 50% antes da entrada (art. 38, §2º da Lei 8.245/91); o restante conforme o contrato. Devolvida ao inquilino no fim, após a vistoria de saída.`,
  },
  ...(CAUCAO_PARCELADA_UI
    ? [{ key: "caucao_parcelada" as GarantiaKey, label: "Caução parcelada" }]
    : []),
  { key: "seguro_fianca", label: "Seguro-fiança", disabled: true, badge: "Em breve — via parceiro" },
];

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
