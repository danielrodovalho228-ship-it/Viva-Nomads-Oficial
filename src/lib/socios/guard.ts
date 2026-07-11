import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sociosCookieValido, SOCIOS_COOKIE, SOCIOS_UNLOCK_PATH } from "./access";

/**
 * Segunda trava (além do proxy) das páginas internas dos sócios — chamada no
 * TOPO de cada page server component. Ler o cookie torna a página DINÂMICA, o
 * que força a checagem em toda requisição: imune ao cache de borda que servia a
 * versão estática sem passar pelo middleware (era o furo em produção).
 *
 * PORTA ÚNICA: só o cookie de sócio válido (obtido digitando o código na tela
 * de desbloqueio) libera — SEM exceção para admin. Todos (Daniel, Romulo,
 * Danilo) passam pela mesma senha. Senão, manda para a tela de desbloqueio
 * guardando o destino. Desliga com PAGES_INTERNAS_PRIVADAS=off.
 */
export async function guardSocios(pathname: string): Promise<void> {
  if (process.env.PAGES_INTERNAS_PRIVADAS === "off") return;

  const store = await cookies();
  if (await sociosCookieValido(store.get(SOCIOS_COOKIE)?.value)) return;

  redirect(`${SOCIOS_UNLOCK_PATH}?next=${encodeURIComponent(pathname)}`);
}
