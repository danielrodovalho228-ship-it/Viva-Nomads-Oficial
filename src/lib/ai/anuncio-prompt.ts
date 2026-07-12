/**
 * Geração de título/descrição do anúncio por IA — prompt, guarda-corpos e
 * sanitização. Puro e testável (sem I/O). A chamada ao provedor fica só no
 * servidor (src/app/api/ai/anuncio/route.ts) — a chave NUNCA vai ao cliente.
 */

/** Limite diário de gerações por proprietário (anti-abuso/custo). */
export const IA_LIMITE_DIA = 10;

/** Campos SEGUROS enviados ao modelo — sem PII, sem endereço exato, sem contato. */
export interface AnuncioBrief {
  tipo?: string;
  cidade?: string;
  bairro?: string;
  quartos?: number;
  banheiros?: number;
  areaM2?: number;
  vagas?: number;
  mobiliado?: boolean;
  aceitaPet?: boolean;
  comodidades?: string[];
  faixas?: string[];
  temHomeOffice?: boolean;
}

/** Entrada CRUA e não confiável (JSON do cliente). Tratada por allowlist —
 * campos fora do brief seguro (rua/CEP/contato/PII) são ignorados por construção. */
export type AnuncioBriefInput = Record<string, unknown>;

/**
 * Monta o brief SEGURO a partir da entrada do editor: allowlist estrita (nada
 * de rua/CEP/nome/telefone), comodidades limitadas a 12, strings aparadas.
 */
export function montarBrief(input: AnuncioBriefInput): AnuncioBrief {
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : undefined);
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) && x > 0 ? Math.round(x) : undefined;
  };
  const b = (v: unknown) => (typeof v === "boolean" ? v : undefined);
  const comodidades = Array.isArray(input.comodidades)
    ? input.comodidades.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim().slice(0, 40)).slice(0, 12)
    : undefined;
  const faixas = Array.isArray(input.faixas)
    ? input.faixas.filter((c) => typeof c === "string" && c.trim()).slice(0, 3)
    : undefined;
  return {
    tipo: s(input.tipo),
    cidade: s(input.cidade),
    bairro: s(input.bairro),
    quartos: n(input.quartos),
    banheiros: n(input.banheiros),
    areaM2: n(input.areaM2),
    vagas: n(input.vagas),
    mobiliado: b(input.mobiliado),
    aceitaPet: b(input.aceitaPet),
    comodidades: comodidades?.length ? comodidades : undefined,
    faixas: faixas?.length ? faixas : undefined,
    temHomeOffice: b(input.temHomeOffice),
  };
}

/** Regras do modelo — honestidade, sem contato, sem promessa de dinheiro. */
export const IA_SYSTEM_PROMPT = [
  "Você escreve título e descrição de anúncios de imóveis MOBILIADOS para locação de MÉDIA DURAÇÃO (30 a 180 dias) no Brasil, na plataforma Viva Nomads.",
  "REGRAS OBRIGATÓRIAS:",
  "- Escreva em português do Brasil, tom acolhedor e objetivo.",
  "- Use SOMENTE os dados fornecidos. NÃO invente comodidades, metragem, número de quartos nem características que não foram informadas.",
  "- NUNCA inclua telefone, e-mail, links, redes sociais, nome de pessoas nem endereço exato (rua/número). A região (bairro/cidade) pode ser citada.",
  "- NUNCA mencione pagamento pela plataforma nem prometa retorno financeiro — a plataforma conecta e documenta, não intermedia dinheiro.",
  "- Não faça promessas absolutas nem use superlativos vazios ('o melhor', 'imperdível').",
  "- Título: no máximo ~60 caracteres, sem emoji.",
  "- Descrição: 2 a 4 frases, no máximo ~600 caracteres.",
].join("\n");

/** Schema de saída estruturada (JSON) — só título e descrição. */
export const IA_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    titulo: { type: "string" },
    descricao: { type: "string" },
  },
  required: ["titulo", "descricao"],
} as const;

// Contato ou URL na saída (guarda-corpo pós-geração — defesa em profundidade).
const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
const RE_URL = /\b(?:https?:\/\/|www\.)\S+/gi;
const RE_TEL = /(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4}/g;

/** Há contato (telefone/e-mail/URL) no texto? (defesa em profundidade.) */
export function contemContato(texto: string): boolean {
  return RE_EMAIL.test(texto) || RE_URL.test(texto) || RE_TEL.test(texto);
}

/** Remove qualquer contato que escape para o texto gerado (best-effort). */
export function limparSaida(texto: string): string {
  return texto
    .replace(RE_EMAIL, "")
    .replace(RE_URL, "")
    .replace(RE_TEL, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
