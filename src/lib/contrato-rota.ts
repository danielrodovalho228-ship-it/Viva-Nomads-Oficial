/*
  Rotas de detalhe do contrato (/dashboard/contratos/[id] do dono e /dashboard/estadia/[id]/contrato do inquilino;
  o antigo /dashboard/locacoes/[id] só redireciona — E539).
  O proxy usa isto para devolver 404 de verdade (o loading.tsx do painel faz streaming e a página
  só conseguiria 200 + noindex).
*/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROTA_RE = /^\/dashboard\/(?:contratos\/([^/]+)|locacoes\/([^/]+)|estadia\/([^/]+)\/contrato)\/?$/;

export type RotaContrato = { tipo: "id"; id: string } | { tipo: "invalida" } | null;

/** null = não é rota de detalhe de contrato; "invalida" = id que nem é UUID (404 sem consultar o banco). */
export function rotaDetalheContrato(pathname: string): RotaContrato {
  const m = ROTA_RE.exec(pathname);
  if (!m) return null;
  const id = m[1] ?? m[2] ?? m[3];
  return UUID_RE.test(id) ? { tipo: "id", id } : { tipo: "invalida" };
}
