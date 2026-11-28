import { safeInternalPath } from "./safe-redirect.ts";

/**
 * Destino guardado quando o proxy manda para o login (F11): caminho + query
 * (ex.: /qualificar?imovel=<id>), para a pessoa voltar exatamente onde estava.
 * Passa pelo mesmo filtro anti open redirect do /auth (só caminho interno).
 */
export function destinoAposLogin(pathname: string, search: string): string {
  return safeInternalPath(pathname + search, safeInternalPath(pathname));
}

/** Âncora simples: "#" + nome de seção (letras, números, "-" e "_", até 64). Nada com "=", "&", "/", ":" ou espaço. */
const ANCORA_SIMPLES = /^#[A-Za-z0-9_-]{1,64}$/;

/**
 * E1002 — a âncora do link sobrevive ao login. A âncora não chega ao servidor, então o proxy guarda só caminho e
 * consulta; o navegador, porém, a mantém ao seguir o redirecionamento para /auth. A tela do login chama esta função
 * com o destino já filtrado e o `location.hash` do momento.
 *  - Só âncora simples (nome de seção): uma resposta de login por link ("#access_token=…") nunca vai para o destino.
 *  - O destino que já traz âncora própria vence.
 */
export function destinoComAncoraDoLogin(destino: string, hash: string | null | undefined): string {
  if (!hash || !ANCORA_SIMPLES.test(hash) || destino.includes("#")) return destino;
  return destino + hash;
}

/**
 * /qualificar sem ?imovel → sempre o cadastro novo (E132-A, item 10): ele abre a Qualificação se ainda não respondida e,
 * com rascunho em andamento, oferece retomá-lo (o mesmo aviso de "Novo anúncio").
 */
export function destinoQualificarSemImovel(): string {
  return "/dashboard/imoveis/novo";
}
