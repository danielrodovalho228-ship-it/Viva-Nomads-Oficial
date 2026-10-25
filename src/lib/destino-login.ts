import { safeInternalPath } from "./safe-redirect.ts";

/**
 * Destino guardado quando o proxy manda para o login (F11): caminho + query
 * (ex.: /qualificar?imovel=<id>), para a pessoa voltar exatamente onde estava.
 * Passa pelo mesmo filtro anti open redirect do /auth (só caminho interno).
 */
export function destinoAposLogin(pathname: string, search: string): string {
  return safeInternalPath(pathname + search, safeInternalPath(pathname));
}

/**
 * /qualificar sem ?imovel → sempre o cadastro novo (E132-A, item 10): ele abre a Qualificação se ainda não respondida e,
 * com rascunho em andamento, oferece retomá-lo (o mesmo aviso de "Novo anúncio").
 */
export function destinoQualificarSemImovel(): string {
  return "/dashboard/imoveis/novo";
}
