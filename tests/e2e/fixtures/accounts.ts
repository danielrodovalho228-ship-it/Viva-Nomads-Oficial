/**
 * Contas de TESTE (via env — nunca no código, nunca a conta pessoal do Daniel).
 * Três papéis: inquilino, proprietário e admin de teste. O `nome` esperado é
 * usado no T4 para conferir a saudação/sidebar contra o nome REAL da conta.
 */
export type Role = "inquilino" | "proprietario" | "admin";

export interface Account {
  role: Role;
  email: string;
  senha: string;
  /** Nome real esperado na saudação/sidebar (T4). Opcional. */
  nome: string;
}

function envVar(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Faltou ${name}. Configure as contas de TESTE em .env.local (local) ou GitHub Secrets (CI). ` +
        `Use contas de teste — NUNCA a conta pessoal.`
    );
  }
  return v;
}

const KEYS: Record<Role, string> = {
  inquilino: "INQUILINO",
  proprietario: "PROPRIETARIO",
  admin: "ADMIN",
};

/** Lê (lazy) a conta de um papel a partir das variáveis TESTES_<PAPEL>_*. */
export function account(role: Role): Account {
  const k = KEYS[role];
  return {
    role,
    email: envVar(`TESTES_${k}_EMAIL`),
    senha: envVar(`TESTES_${k}_SENHA`),
    nome: process.env[`TESTES_${k}_NOME`] ?? "",
  };
}

export const ALL_ROLES: Role[] = ["inquilino", "proprietario", "admin"];

/** Domínio de produção — usado para impedir escrita acidental no banco real (T5). */
export const PROD_HOST = "vivanomads.com.br";
