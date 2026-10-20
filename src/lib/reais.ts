/*
  Valores em reais digitados no formato brasileiro (complemento do prompt 27, parte B). Fonte única para todo campo
  de dinheiro. Antes, `Number(v.replace(",", "."))` lia "3.300" como 3,3 — e o aviso de piso da contraproposta
  aparecia para qualquer valor com ponto de milhar.
    "3300" → 3300 · "3.300" → 3300 · "3.300,50" → 3300.5 · "R$ 3.300" → 3300 · "" → null
    Ambíguo ("3.30", "3,300,00", "3.300.5") → erro claro, nunca um número inventado.
*/

export type LeituraReais = { ok: true; valor: number | null } | { ok: false; erro: string };

export const ERRO_REAIS_FORMATO = "Digite o valor como 3.300 ou 3.300,50 (ponto separa os milhares, vírgula os centavos).";

const MILHARES = /^\d{1,3}(\.\d{3})+$/;

export function lerReais(texto: string | number | null | undefined): LeituraReais {
  if (typeof texto === "number") return Number.isFinite(texto) && texto >= 0 ? { ok: true, valor: texto } : { ok: false, erro: ERRO_REAIS_FORMATO };
  const s = String(texto ?? "")
    .replace(/R\$/gi, "")
    .replace(/[\s ]/g, "");
  if (s === "") return { ok: true, valor: null };
  if (!/^[\d.,]+$/.test(s)) return { ok: false, erro: ERRO_REAIS_FORMATO };
  const partes = s.split(",");
  if (partes.length > 2) return { ok: false, erro: ERRO_REAIS_FORMATO };
  const [inteira, centavos] = partes;
  if (centavos !== undefined && !/^\d{1,2}$/.test(centavos)) return { ok: false, erro: ERRO_REAIS_FORMATO };
  let reais: number;
  if (/^\d+$/.test(inteira)) reais = Number(inteira);
  else if (MILHARES.test(inteira)) reais = Number(inteira.replace(/\./g, ""));
  else return { ok: false, erro: ERRO_REAIS_FORMATO };
  const valor = centavos === undefined ? reais : reais + Number(centavos.padEnd(2, "0")) / 100;
  return { ok: true, valor };
}

/** Para leituras que não mostram erro (ex.: simulador): o valor ou `padrao`. */
export function reaisOu(texto: string | number | null | undefined, padrao: number): number {
  const r = lerReais(texto);
  return r.ok && r.valor != null ? r.valor : padrao;
}

/**
 * Formata ENQUANTO a pessoa digita: só dígitos e uma vírgula (até 2 casas); o ponto vira separador de milhar.
 * "3300" → "3.300" · "3300,5" → "3.300,5" · "3.300" → "3.300". Sem centavos quando `centavos` = false.
 */
export function formatarReaisDigitando(texto: string, centavos = true): string {
  const s = String(texto ?? "").replace(/[^\d,]/g, "");
  const i = s.indexOf(",");
  const inteiraBruta = (i >= 0 ? s.slice(0, i) : s).replace(/^0+(?=\d)/, "");
  const decimais = i >= 0 && centavos ? s.slice(i + 1).replace(/,/g, "").slice(0, 2) : null;
  const inteira = inteiraBruta.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (decimais === null) return inteira;
  return `${inteira || "0"},${decimais}`;
}

/** Número → texto do campo ("3.300" / "3.300,50"); null → "". */
export function reaisParaCampo(valor: number | null | undefined, centavos = true): string {
  if (valor == null || !Number.isFinite(valor)) return "";
  const temCentavos = centavos && Math.round(valor * 100) % 100 !== 0;
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: temCentavos ? 2 : 0, maximumFractionDigits: temCentavos ? 2 : 0 });
}
