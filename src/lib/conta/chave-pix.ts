/*
  CHAVE PIX DE RECEBIMENTO (PERFIL-B; mockup perfil-07-pagamentos) — regras PURAS.
  O morador paga o valor mensal direto ao proprietário; a Viva não recebe esse valor. Aqui só se valida e mostra a
  chave que o próprio proprietário informou. CPF/CNPJ com dígito verificador, e-mail, celular com DDD (+55) ou chave
  aleatória (EVP). O servidor normaliza de novo antes de gravar (0236: só o dono lê e grava).
*/
import { cnpjValido, cpfValido, soDigitos } from "../documento-pessoa.ts";

export const TIPOS_CHAVE_PIX = [
  { valor: "cpf", rotulo: "CPF" },
  { valor: "cnpj", rotulo: "CNPJ" },
  { valor: "email", rotulo: "E-mail" },
  { valor: "telefone", rotulo: "Celular" },
  { valor: "aleatoria", rotulo: "Chave aleatória" },
] as const;

export type TipoChavePix = (typeof TIPOS_CHAVE_PIX)[number]["valor"];

export interface ChavePix {
  tipo: TipoChavePix;
  chave: string;
}

export type ResultadoChavePix = { ok: true; chave: ChavePix } | { ok: false; erro: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EVP_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function ehTipoChavePix(v: unknown): v is TipoChavePix {
  return TIPOS_CHAVE_PIX.some((t) => t.valor === v);
}

/** Valida e põe no formato do Pix: CPF/CNPJ só dígitos, e-mail minúsculo, celular +55DDNNNNNNNNN, EVP minúsculo. */
export function normalizarChavePix(tipo: unknown, entrada: unknown): ResultadoChavePix {
  if (!ehTipoChavePix(tipo)) return { ok: false, erro: "Escolha o tipo da chave." };
  const v = typeof entrada === "string" ? entrada.trim() : "";
  if (!v) return { ok: false, erro: "Informe a chave Pix." };
  switch (tipo) {
    case "cpf":
      return cpfValido(v) ? { ok: true, chave: { tipo, chave: soDigitos(v) } } : { ok: false, erro: "CPF inválido. Confira os números." };
    case "cnpj":
      return cnpjValido(v) ? { ok: true, chave: { tipo, chave: soDigitos(v) } } : { ok: false, erro: "CNPJ inválido. Confira os números." };
    case "email": {
      const e = v.toLowerCase();
      return e.length <= 77 && EMAIL_RE.test(e) ? { ok: true, chave: { tipo, chave: e } } : { ok: false, erro: "E-mail inválido." };
    }
    case "telefone": {
      let d = soDigitos(v);
      if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
      // Celular: DDD (11–99) + 9 + 8 dígitos.
      return /^[1-9][1-9]9\d{8}$/.test(d) ? { ok: true, chave: { tipo, chave: `+55${d}` } } : { ok: false, erro: "Celular inválido. Use o DDD e os 9 dígitos." };
    }
    case "aleatoria": {
      const a = v.toLowerCase();
      return EVP_RE.test(a) ? { ok: true, chave: { tipo, chave: a } } : { ok: false, erro: "Chave aleatória inválida. Cole os 32 caracteres com os hífens." };
    }
  }
}

/**
 * Como a chave aparece na tela, mascarada como o documento (documento-pessoa.ts): o dono reconhece a sua chave sem
 * que ela fique inteira num print. CPF ***.456.789-**; CNPJ **.345.678/0001-**; e-mail a***@dominio; celular
 * (11) *****-4321; aleatória só o começo e o fim.
 */
export function mascararChavePix(c: ChavePix): string {
  const k = c.chave;
  switch (c.tipo) {
    case "cpf":
      return `***.${k.slice(3, 6)}.${k.slice(6, 9)}-**`;
    case "cnpj":
      return `**.${k.slice(2, 5)}.${k.slice(5, 8)}/${k.slice(8, 12)}-**`;
    case "email": {
      const [u, dom] = k.split("@");
      return `${u.charAt(0)}***@${dom}`;
    }
    case "telefone": {
      const d = k.replace(/^\+55/, "");
      return `(${d.slice(0, 2)}) *****-${d.slice(-4)}`;
    }
    case "aleatoria":
      return `${k.slice(0, 4)}…${k.slice(-4)}`;
  }
}

export function rotuloTipoChavePix(tipo: TipoChavePix): string {
  return TIPOS_CHAVE_PIX.find((t) => t.valor === tipo)?.rotulo ?? "Chave";
}
