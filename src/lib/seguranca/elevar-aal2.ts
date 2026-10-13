/**
 * Eleva a sessão a aal2 antes de operações sensíveis (trocar senha/e-mail).
 * Com 2FA ativo, o Supabase recusa `updateUser` em aal1 (401 insufficient_aal).
 * Cliente mínimo tipado à mão para poder testar sem rede.
 */
import { codigoTotpValido, MSG_CODIGO_NAO_CONFERE, MSG_CONFIRME_CODIGO_SENHA, precisaCodigoParaOperacaoSensivel } from "../admin/mfa.ts";

type Falha = { message: string } | null;
export interface ClienteMfa {
  auth: {
    mfa: {
      getAuthenticatorAssuranceLevel(): Promise<{ data: { currentLevel?: string | null; nextLevel?: string | null } | null }>;
      listFactors(): Promise<{ data: { totp?: { id: string }[] } | null }>;
      challengeAndVerify(a: { factorId: string; code: string }): Promise<{ error: Falha }>;
    };
  };
}

export type ResultadoElevacao =
  | { ok: true }
  | { ok: false; pedirCodigo: boolean; erro: string };

/** `codigoBruto` vazio quando a pessoa ainda não digitou: devolve pedirCodigo para a tela mostrar o campo. */
export async function elevarParaAal2(supabase: ClienteMfa, codigoBruto: string): Promise<ResultadoElevacao> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!precisaCodigoParaOperacaoSensivel(data?.currentLevel, data?.nextLevel)) return { ok: true };
  const codigo = codigoTotpValido(codigoBruto);
  if (!codigo) return { ok: false, pedirCodigo: true, erro: MSG_CONFIRME_CODIGO_SENHA };
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  const fator = fatores?.totp?.[0]; // só verificados
  if (!fator) return { ok: false, pedirCodigo: true, erro: MSG_CONFIRME_CODIGO_SENHA };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator.id, code: codigo });
  if (error) return { ok: false, pedirCodigo: true, erro: MSG_CODIGO_NAO_CONFERE };
  return { ok: true };
}
