/**
 * L1-1 (D-V3): o endereço que o "Enviar documento" do passo Onde fica exige — CEP, rua e número — lido com folga,
 * para nunca travar o envio de quem já tem o endereço gravado (rascunho retomado, número dentro da rua, CEP com
 * máscara, "s/n"). PURO: sem React nem Supabase.
 */
export type CampoEnderecoDoc = "cep" | "rua" | "numero";

export interface EnderecoDoc {
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
}

export const ROTULO_CAMPO_ENDERECO: Record<CampoEnderecoDoc, string> = { cep: "CEP", rua: "rua", numero: "número" };

/** O campo da tela de cada um (data-testid no passo Onde fica). */
export const TESTID_CAMPO_ENDERECO: Record<CampoEnderecoDoc, string> = { cep: "cadastro-cep", rua: "cadastro-rua", numero: "cadastro-numero" };

const SEM_NUMERO = /^s\.?\s*\/?\s*n[º°o]?\.?$/i;

/** "s/n", "S/N", "sn", "s/nº" → "s/n"; o resto só sem espaços nas pontas. */
function numeroLimpo(n: string): string {
  const t = n.trim();
  return SEM_NUMERO.test(t) ? "s/n" : t;
}

const NUM = String.raw`(?:n[º°o]?\.?\s*)?(\d+[A-Za-z]?|s\.?\s*\/?\s*n[º°o]?\.?)`;
const COMPLEMENTO = String.raw`(?:apto?\.?|apartamento|bloco|bl\.?|casa|sala|lote|fundos|cj\.?|conjunto)`;
const SEGMENTO_NUMERO = new RegExp(`^\\s*${NUM}(?:\\s+${COMPLEMENTO}\\b.*)?\\s*$`, "i");
const NUMERO_NO_FIM = new RegExp(`^(\\S+(?:\\s+\\S+)+?)\\s+${NUM}(?:\\s+${COMPLEMENTO}\\b.*)?$`, "i");

/**
 * Número escrito dentro da rua. Com vírgula: o 1º trecho depois dela que é só número ("Rua 7 de Setembro, 210B",
 * "Rua X, nº 7, apto 3", "Rua Y, s/n"). Sem vírgula: número depois de um nome de 2+ palavras, no fim ou antes de um
 * complemento ("Av. Rondon Pacheco 45 apto 3"). "Rua 10" sozinha é o nome da rua, não o número.
 */
function numeroNaRua(texto: string): { rua: string; numero: string } | null {
  const partes = texto.split(",");
  for (let i = 1; i < partes.length; i++) {
    const m = SEGMENTO_NUMERO.exec(partes[i]);
    if (m && partes[0].trim()) return { rua: partes[0].trim(), numero: numeroLimpo(m[1]) };
  }
  const m = NUMERO_NO_FIM.exec(partes[0].trim());
  return m ? { rua: m[1].trim(), numero: numeroLimpo(m[2]) } : null;
}

/**
 * Normaliza: CEP só com dígitos; número vazio procurado no fim da rua ("Rua X, 120", "Av. Y 45 apto 3",
 * "Rua Z, nº 7", "Rua W, s/n"), e aí a rua fica sem o número.
 */
export function normalizarEnderecoDocumento(e: EnderecoDoc): { cep: string; rua: string; numero: string } {
  const cep = (e.cep ?? "").replace(/\D/g, "");
  let rua = (e.rua ?? "").trim();
  let numero = numeroLimpo(e.numero ?? "");
  if (!numero && rua) {
    const achado = numeroNaRua(rua);
    if (achado) ({ rua, numero } = achado);
  }
  return { cep, rua, numero };
}

/** Campos que faltam para enviar o documento, na ordem da tela (CEP, rua, número). */
export function faltaEnderecoDocumento(e: EnderecoDoc): CampoEnderecoDoc[] {
  const n = normalizarEnderecoDocumento(e);
  const falta: CampoEnderecoDoc[] = [];
  if (n.cep.length !== 8) falta.push("cep");
  if (!n.rua) falta.push("rua");
  if (!n.numero) falta.push("numero");
  return falta;
}

/**
 * Endereço a usar: o que está no passo agora e, campo a campo, o gravado no rascunho quando o da tela vem vazio.
 * O que está salvo nunca trava o botão.
 */
export function enderecoParaDocumento(daTela: EnderecoDoc, salvo?: EnderecoDoc | null): { cep: string; rua: string; numero: string } {
  const t = normalizarEnderecoDocumento(daTela);
  if (!salvo) return t;
  const s = normalizarEnderecoDocumento(salvo);
  return { cep: t.cep.length === 8 ? t.cep : s.cep.length === 8 ? s.cep : t.cep, rua: t.rua || s.rua, numero: t.numero || s.numero };
}

/** "Falta: número" · "Falta: CEP e número" · "Falta: CEP, rua e número". */
export function textoFaltaEndereco(campos: CampoEnderecoDoc[]): string {
  const r = campos.map((c) => ROTULO_CAMPO_ENDERECO[c]);
  if (!r.length) return "";
  const lista = r.length === 1 ? r[0] : `${r.slice(0, -1).join(", ")} e ${r[r.length - 1]}`;
  return `Falta: ${lista}`;
}

/** Mensagem embaixo de cada campo que falta (critério f: o campo fica marcado). */
export const ERRO_CAMPO_ENDERECO: Record<CampoEnderecoDoc, string> = {
  cep: "Informe o CEP (8 números) para enviar o documento.",
  rua: "Informe a rua para enviar o documento.",
  numero: "Informe o número (ou s/n) para enviar o documento.",
};
