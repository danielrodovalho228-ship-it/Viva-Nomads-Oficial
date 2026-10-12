/*
  Perfil de proprietário completo (F45) — exigido NO SERVIDOR para publicar.
  A mesma conta pode ser dona e inquilina; abrir o assistente de anúncio troca
  para o modo Proprietário, mas publicar só libera com nome e telefone válidos.
*/
import { normalizarTelefone, validarNome } from "../conta-validacao.ts";

export const MSG_PERFIL_DONO_INCOMPLETO =
  "Complete seu perfil de proprietário (nome e telefone) em Conta antes de publicar. Você pode salvar como rascunho.";

export function perfilDonoCompleto(p: { full_name?: string | null; phone?: string | null } | null): boolean {
  if (!p) return false;
  if (!validarNome(p.full_name ?? "").ok) return false;
  const tel = normalizarTelefone(p.phone ?? "");
  return tel.ok && !!tel.valor;
}
