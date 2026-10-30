/*
  E288-B — tráfego de teste fora das métricas. PURO (sem imports de servidor; roda com node --test).
  Todo evento gravado leva `trafego`:
    'e2e'   → a requisição veio da suíte automática (Playwright): cabeçalho x-vn-origem: e2e, ou o cookie vn_trafego=e2e
              que o proxy grava quando vê o cabeçalho (vale para o que o navegador dispara depois, inclusive o beacon);
    'teste' → sessão de conta is_teste (porta de QA, contas do Muse, fixtures);
    'real'  → o resto.
  Funil, Eventos e os números do admin contam SÓ 'real' (mesma regra da 0181 para as contas de teste).
*/

export const TRAFEGOS = ["real", "e2e", "teste"] as const;
export type Trafego = (typeof TRAFEGOS)[number];

/** Cabeçalho fixo que o playwright.config manda em TODA requisição da suíte. */
export const CABECALHO_TRAFEGO = "x-vn-origem";
/** Cookie equivalente (legível no navegador: o Vercel Analytics descarta a página com ele). */
export const COOKIE_TRAFEGO = "vn_trafego";
export const VALOR_E2E = "e2e";

/** A requisição é da suíte automática? (cabeçalho OU cookie, só com o valor exato). */
export function ehTrafegoE2e(cabecalho: string | null | undefined, cookie: string | null | undefined): boolean {
  return cabecalho?.trim().toLowerCase() === VALOR_E2E || cookie?.trim().toLowerCase() === VALOR_E2E;
}

/** A origem do evento: e2e vence (o robô também entra com contas de teste); depois conta is_teste; senão real. */
export function trafegoDoEvento(e: { e2e: boolean; contaTeste: boolean }): Trafego {
  if (e.e2e) return "e2e";
  if (e.contaTeste) return "teste";
  return "real";
}

/**
 * Entra na contagem? Só 'real' e de conta que não é de teste. Linha sem `trafego` (lida antes da 0266 aplicar) conta
 * como real — a regra antiga das contas de teste continua valendo para ela.
 */
export function eventoConta(e: { trafego?: string | null; usuario_id?: string | null }, contasTeste: ReadonlySet<string>): boolean {
  if (e.trafego != null && e.trafego !== "real") return false;
  return !e.usuario_id || !contasTeste.has(e.usuario_id);
}

/** Lê um cookie do cabeçalho Cookie cru. */
export function cookieDoCabecalho(cabecalho: string | null | undefined, nome: string): string | null {
  for (const parte of (cabecalho ?? "").split(/;\s*/)) {
    const i = parte.indexOf("=");
    if (i > 0 && parte.slice(0, i) === nome) return parte.slice(i + 1);
  }
  return null;
}

/** "N eventos de teste fora da contagem" (null quando não há nenhum: a linha some). */
export function rotuloForaDaContagem(n: number): string | null {
  if (!n || n <= 0) return null;
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? "evento de teste fora" : "eventos de teste fora"} da contagem`;
}

/** Navegador: a página é da suíte automática? Cookie vn_trafego=e2e (o proxy grava) ou navegador automatizado. */
export function descartarVisitaDeTeste(documentCookie: string, webdriver: boolean): boolean {
  return webdriver || ehTrafegoE2e(null, cookieDoCabecalho(documentCookie, COOKIE_TRAFEGO));
}
