import { safeInternalPath } from "./safe-redirect.ts";

/**
 * Destino guardado quando o proxy manda para o login (F11): caminho + query
 * (ex.: /qualificar?imovel=<id>), para a pessoa voltar exatamente onde estava.
 * Passa pelo mesmo filtro anti open redirect do /auth (só caminho interno).
 */
export function destinoAposLogin(pathname: string, search: string): string {
  return safeInternalPath(pathname + search, safeInternalPath(pathname));
}

/** /qualificar sem ?imovel: com rascunho em andamento → lista; senão → cadastro novo. */
export function destinoQualificarSemImovel(temRascunho: boolean): string {
  return temRascunho ? "/dashboard/imoveis" : "/dashboard/imoveis/novo";
}
