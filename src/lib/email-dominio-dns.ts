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

export async function dominioExiste(dominio: string, resolvedor: ResolvedorDns = dns): Promise<boolean> {
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
