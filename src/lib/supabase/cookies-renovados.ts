/**
 * E793 A1 — o cookie renovado pelo proxy precisa chegar ao layout.
 *
 * O `setAll` do createServerClient no proxy gravava os cookies renovados só na RESPOSTA (o que volta ao navegador). O
 * pedido que segue para o layout e as páginas continuava com os cookies ANTIGOS: o token de acesso vencido e o refresh
 * token que o proxy acabou de gastar. Uma conferência de sessão no layout com esses cookies podia falhar e mandar para
 * /auth uma pessoa com sessão viva. Padrão oficial do @supabase/ssr:
 *   1. grava os cookies também no PEDIDO (`request.cookies.set` reescreve o cabeçalho "cookie");
 *   2. recria a resposta com `montar()` (NextResponse.next com os cabeçalhos ATUAIS do pedido — e o x-vn-destino);
 *   3. devolve à resposta nova os cookies que a anterior já tinha e os renovados (o comCookies do E428 lê a resposta atual).
 *
 * Sem import de "next/server" aqui: o proxy injeta `montar` (assim o módulo roda no `node --test`).
 */
export interface CookieRenovado {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}
interface PedidoComCookies {
  cookies: { set(name: string, value: string): unknown };
}
interface RespostaComCookies {
  cookies: { set(...args: never[]): unknown; getAll(): { name: string; value: string }[] };
}
type SetCookie = (nomeOuCookie: unknown, valor?: string, opcoes?: unknown) => unknown;

export function cookiesRenovados<R extends RespostaComCookies>(pedido: PedidoComCookies, montar: () => R) {
  let response = montar();
  return {
    /** A resposta ATUAL (é recriada a cada setAll). */
    resposta: () => response,
    setAll(lista: CookieRenovado[]) {
      lista.forEach(({ name, value }) => pedido.cookies.set(name, value));
      const anteriores = response.cookies.getAll();
      response = montar();
      const set = response.cookies.set.bind(response.cookies) as SetCookie;
      anteriores.forEach((c) => set(c));
      lista.forEach(({ name, value, options }) => set(name, value, options));
    },
  };
}
