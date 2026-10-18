import { promises as dns } from "node:dns";

/*
  Checagem de DNS do domínio do e-mail (só servidor). Mesma regra do pré-cadastro
  (/api/auth/validar-email, F2): só "domínio não existe / sem registro" reprova;
  falha de rede do DNS deixa passar, para não barrar gente de verdade.
*/
export interface ResolvedorDns {
  resolveMx(dominio: string): Promise<unknown[]>;
  resolve4(dominio: string): Promise<unknown[]>;
}

/** Domínios que o resolvedor do laboratório responde como existentes (provedores públicos comuns + o do lab). */
export const DOMINIOS_LAB_COM_MX = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "yahoo.com.br", "icloud.com", "uol.com.br", "bol.com.br", "vivanomads.com.br", "lab.vivanomads.test"];

/**
 * Resolvedor SIMULADO do laboratório: o lab local roda sem DNS externo (todo domínio dava ENOTFOUND e e-mail válido
 * era recusado — t62). Responde MX só para a lista acima; o resto é "não existe". A regra de recusa não muda.
 */
export const resolvedorLab: ResolvedorDns = {
  async resolveMx(dominio) {
    if (DOMINIOS_LAB_COM_MX.includes(dominio.toLowerCase())) return [{ exchange: `mx.${dominio}`, priority: 10 }];
    throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
  },
  async resolve4() {
    throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
  },
};

/** Só com LAB_DNS_SIMULADO=on e NUNCA em produção (VERCEL_ENV=production ignora a variável). */
export function resolvedorPadrao(env: Record<string, string | undefined> = process.env): ResolvedorDns {
  return env.LAB_DNS_SIMULADO === "on" && env.VERCEL_ENV !== "production" ? resolvedorLab : dns;
}

export async function dominioExiste(dominio: string, resolvedor: ResolvedorDns = resolvedorPadrao()): Promise<boolean> {
  const semRegistro = (e: unknown) => {
    const c = (e as { code?: string })?.code;
    return c === "ENOTFOUND" || c === "ENODATA";
  };
  try {
    const mx = await resolvedor.resolveMx(dominio);
    if (mx.length > 0) return true;
  } catch (e) {
    if (!semRegistro(e)) return true;
  }
  try {
    await resolvedor.resolve4(dominio);
    return true;
  } catch (e) {
    return !semRegistro(e);
  }
}
