import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { acessoInterno, INVESTIDOR_COOKIE, SOCIOS_COOKIE, SOCIOS_UNLOCK_PATH } from "./access";

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
 *
 * Exceção única: o código do INVESTIDOR abre o /simulacao (e só ele). A
 * página recebe "investidor" para mostrar o modo leitura.
 */
export async function guardSocios(pathname: string): Promise<"socio" | "investidor"> {
  if (process.env.PAGES_INTERNAS_PRIVADAS === "off") return "socio";

  const store = await cookies();
  const quem = await acessoInterno(pathname, {
    socio: store.get(SOCIOS_COOKIE)?.value,
    investidor: store.get(INVESTIDOR_COOKIE)?.value,
  });
  if (quem) return quem;

  redirect(`${SOCIOS_UNLOCK_PATH}?next=${encodeURIComponent(pathname)}`);
}
