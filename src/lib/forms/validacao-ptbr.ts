/**
 * E384 (01/11): a validação nativa do navegador fala o idioma do NAVEGADOR ("Please fill out this field.") mesmo num site
 * em português. Esta é a mensagem em pt-BR para cada falha do ValidityState. Puro (node --test).
 */
export interface CampoValidavel {
  type: string;
  tagName: string;
  title?: string;
  minLength?: number;
  maxLength?: number;
  min?: string;
  max?: string;
  validity: Pick<ValidityState, "valueMissing" | "typeMismatch" | "tooShort" | "tooLong" | "patternMismatch" | "rangeUnderflow" | "rangeOverflow" | "stepMismatch" | "badInput">;
}

export function mensagemValidacaoPtBr(c: CampoValidavel): string | null {
  const v = c.validity;
  const tipo = (c.type || "").toLowerCase();
  const tag = (c.tagName || "").toUpperCase();
  if (v.valueMissing) {
    if (tipo === "checkbox") return "Marque esta opção para continuar.";
    if (tipo === "radio") return "Escolha uma das opções.";
    if (tipo === "file") return "Escolha um arquivo.";
    if (tag === "SELECT") return "Escolha uma opção da lista.";
    return "Preencha este campo.";
  }
  if (v.typeMismatch) {
    if (tipo === "email") return "Informe um e-mail válido (ex.: nome@exemplo.com).";
    if (tipo === "url") return "Informe um link válido, começando com https://.";
    return "Confira o formato deste campo.";
  }
  if (v.tooShort) return `Use pelo menos ${c.minLength} caracteres.`;
  if (v.tooLong) return `Use no máximo ${c.maxLength} caracteres.`;
  if (v.patternMismatch) return c.title?.trim() || "Confira o formato deste campo.";
  if (v.rangeUnderflow) return `O valor mínimo é ${c.min}.`;
  if (v.rangeOverflow) return `O valor máximo é ${c.max}.`;
  if (v.badInput) return tipo === "number" ? "Informe um número." : "Confira o valor deste campo.";
  if (v.stepMismatch) return "Informe um valor válido para este campo.";
  return null;
}
