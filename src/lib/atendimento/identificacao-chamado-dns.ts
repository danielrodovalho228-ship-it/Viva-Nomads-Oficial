import { MSG_EMAIL_INUTILIZAVEL, dominioDoEmail } from "../email-dominio.ts";
import { dominioExiste, type ResolvedorDns } from "../email-dominio-dns.ts";
import { validarVisitante, type VisitanteValidado } from "./identificacao-chamado.ts";

/** Domínio das contas do laboratório (nosso, sem caixa de entrada): não consulta o DNS. */
const DOMINIO_DO_LAB = "lab.vivanomads.com.br";

/** validarVisitante + checagem de MX do domínio (mesma regra do pré-cadastro, F2). Só servidor. */
export async function validarVisitanteComDns(
  entrada: { nome?: string; email?: string; telefone?: string },
  resolvedor?: ResolvedorDns
): Promise<VisitanteValidado> {
  const v = validarVisitante(entrada);
  if (!v.ok) return v;
  const dominio = dominioDoEmail(v.email);
  if (!dominio) return { ok: false, error: MSG_EMAIL_INUTILIZAVEL };
  if (dominio !== DOMINIO_DO_LAB && !(await dominioExiste(dominio, resolvedor))) return { ok: false, error: MSG_EMAIL_INUTILIZAVEL };
  return v;
}
