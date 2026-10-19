/*
  "Cadastro completo" — UMA regra para a Conta e para o admin (Prompt 29, item 4c). Desde a 0150 o telefone fica só no
  Supabase Auth, então a regra antiga (nome + profiles.phone) dava "Não" para todo mundo. Agora: nome + e-mail
  confirmado + documento (CPF ou CNPJ) + foto. Puro (node --test).
*/

export interface DadosCadastro {
  nome: string | null | undefined;
  /** auth.users.email_confirmed_at preenchido. */
  emailConfirmado: boolean;
  cpf: string | null | undefined;
  cnpj: string | null | undefined;
  /** profiles.avatar_url preenchido. */
  foto: boolean;
}

export interface ItemCadastro {
  chave: "nome" | "email" | "documento" | "foto";
  rotulo: string;
  feito: boolean;
}

export function itensCadastro(d: DadosCadastro): ItemCadastro[] {
  return [
    { chave: "nome", rotulo: "Nome", feito: !!d.nome?.trim() },
    { chave: "email", rotulo: "E-mail confirmado", feito: d.emailConfirmado },
    { chave: "documento", rotulo: "Documento (CPF ou CNPJ)", feito: !!(d.cpf?.trim() || d.cnpj?.trim()) },
    { chave: "foto", rotulo: "Foto de perfil", feito: d.foto },
  ];
}

export function cadastroCompleto(d: DadosCadastro): boolean {
  return itensCadastro(d).every((i) => i.feito);
}

/** O que falta, em texto ("Documento (CPF ou CNPJ) e Foto de perfil"); completo → "". */
export function faltaNoCadastro(d: DadosCadastro): string {
  const f = itensCadastro(d).filter((i) => !i.feito).map((i) => i.rotulo);
  if (f.length <= 1) return f.join("");
  return `${f.slice(0, -1).join(", ")} e ${f[f.length - 1]}`;
}
