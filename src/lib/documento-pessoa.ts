/*
  DOCUMENTO DA PESSOA (CPF ou CNPJ) — regras PURAS e testáveis (sem imports @/).

  Pacote "Cadastro confiável" (Daniel, 07/10/2026): o contrato, a cobrança e o
  documento fiscal precisam do documento de quem assina. Pessoa física: CPF.
  Pessoa jurídica: CNPJ + razão social + CPF de quem representa a empresa.
  Os dígitos verificadores são conferidos aqui E no banco (0090). O número
  aparece sempre MASCARADO na tela; inteiro, só no servidor (contrato/cobrança).
*/

export type TipoPessoa = "pf" | "pj";

export const soDigitos = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

/** CPF: 11 dígitos, não todos iguais, com os 2 dígitos verificadores certos. */
export function cpfValido(v: string | null | undefined): boolean {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

/** CNPJ: 14 dígitos, não todos iguais, com os 2 dígitos verificadores certos. */
export function cnpjValido(v: string | null | undefined): boolean {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((s, c, i) => s + Number(c) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

/** "***.456.789-**" — mostra só o miolo (padrão de mascaramento de CPF). */
export function mascararCpf(v: string | null | undefined): string | null {
  const d = soDigitos(v);
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : null;
}

/** "12.345.678/****-**" — a raiz do CNPJ é pública (identifica a empresa); filial e dígitos, não. */
export function mascararCnpj(v: string | null | undefined): string | null {
  const d = soDigitos(v);
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**` : null;
}

export interface DocumentoInput {
  tipo: TipoPessoa;
  cpf?: string;
  cnpj?: string;
  razaoSocial?: string;
  cpfRepresentante?: string;
}

export interface DocumentoValidado {
  tipo: TipoPessoa;
  cpf: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  cpfRepresentante: string | null;
}

/** Valida e normaliza (só dígitos). Devolve a mensagem de erro em pt-BR ou o documento pronto. */
export function validarDocumento(i: DocumentoInput): { ok: true; doc: DocumentoValidado } | { ok: false; erro: string } {
  if (i.tipo === "pf") {
    if (!cpfValido(i.cpf)) return { ok: false, erro: "CPF inválido. Confira os 11 números." };
    return { ok: true, doc: { tipo: "pf", cpf: soDigitos(i.cpf), cnpj: null, razaoSocial: null, cpfRepresentante: null } };
  }
  if (!cnpjValido(i.cnpj)) return { ok: false, erro: "CNPJ inválido. Confira os 14 números." };
  const razao = (i.razaoSocial ?? "").replace(/\s+/g, " ").trim();
  if (razao.length < 3 || razao.length > 150) return { ok: false, erro: "Informe a razão social da empresa (como está no CNPJ)." };
  if (/[<>]/.test(razao) || /@|https?:\/\//i.test(razao)) return { ok: false, erro: "Razão social inválida." };
  if (!cpfValido(i.cpfRepresentante)) return { ok: false, erro: "CPF do representante inválido. Confira os 11 números." };
  return { ok: true, doc: { tipo: "pj", cpf: null, cnpj: soDigitos(i.cnpj), razaoSocial: razao, cpfRepresentante: soDigitos(i.cpfRepresentante) } };
}

export interface PerfilDocumento {
  person_type?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  company_name?: string | null;
  cpf_representante?: string | null;
}

/** O perfil já tem o documento completo para assinar contrato e ser cobrado? */
export function documentoCompleto(p: PerfilDocumento | null | undefined): boolean {
  if (!p) return false;
  if (p.person_type === "pj") return cnpjValido(p.cnpj) && !!(p.company_name ?? "").trim() && cpfValido(p.cpf_representante);
  return cpfValido(p.cpf);
}

/** Documento usado no contrato, na cobrança e no fiscal (só dígitos), ou null. */
export function documentoParaContrato(p: PerfilDocumento | null | undefined): string | null {
  if (!documentoCompleto(p)) return null;
  return p!.person_type === "pj" ? soDigitos(p!.cnpj) : soDigitos(p!.cpf);
}

export const LINK_DOCUMENTO = "/dashboard/conta#documento";

/** Mensagens das travas (aceitar candidatura, assinar plano, fechar contrato). */
export const MSG_DOCUMENTO = {
  aceitar: "Antes de aceitar uma candidatura, informe seu CPF (ou o CNPJ da empresa) em Conta → Documento. Ele vai no contrato.",
  assinar: "Antes de assinar o plano, informe seu CPF (ou o CNPJ da empresa) em Conta → Documento. Ele vai na cobrança e na nota.",
  fecharDono: "Para fechar o contrato, informe seu CPF (ou o CNPJ da empresa) em Conta → Documento.",
  fecharInquilino: "O inquilino ainda não informou o CPF. Peça para ele preencher em Conta → Documento; o contrato precisa do documento das duas partes.",
} as const;
