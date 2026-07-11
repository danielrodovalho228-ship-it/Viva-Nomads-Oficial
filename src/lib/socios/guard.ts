import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sociosCookieValido, SOCIOS_COOKIE, SOCIOS_UNLOCK_PATH } from "./access";

/**
 * Segunda trava (além do proxy) das páginas internas dos sócios — chamada no
 * TOPO de cada page server component. Ler o cookie torna a página DINÂMICA, o
 * que força a checagem em toda requisição: imune ao cache de borda que servia a
 * versão estática sem passar pelo middleware (era o furo em produção).
 *
 * Libera: cookie de sócio válido OU sessão com papel admin. Senão, manda para a
 * tela de desbloqueio guardando o destino. Desliga com PAGES_INTERNAS_PRIVADAS=off.
 */
export async function guardSocios(pathname: string): Promise<void> {
  if (process.env.PAGES_INTERNAS_PRIVADAS === "off") return;

  const store = await cookies();
  if (await sociosCookieValido(store.get(SOCIOS_COOKIE)?.value)) return;

  const supabase = await createClient();
  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "admin") return;
    }
  }

  redirect(`${SOCIOS_UNLOCK_PATH}?next=${encodeURIComponent(pathname)}`);
}
