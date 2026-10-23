/*
  CACHE DAS PÁGINAS PÚBLICAS DO ANÚNCIO (F9 do QA do Daniel, 12/10/2026).

  /imoveis/[id], a home, /buscar, /cidades, /imoveis-perto-de, /proprietario/[id] e o sitemap leem com o cliente anônimo
  (sem cookies), então o Next as guarda em cache. Sem invalidar, o 404 de quando o
  anúncio ainda era rascunho ficava preso depois de publicado — e, ao contrário, um
  anúncio pausado/editado continuava aparecendo com dados velhos.
  Toda mudança de status/edição/aprovação chama `revalidarAnuncio`; as páginas
  também têm `revalidate = REVALIDAR_SEGUNDOS` como rede de segurança.
*/

/** Rede de segurança: mesmo sem invalidar, a página se refaz em até 60 s. */
export const REVALIDAR_SEGUNDOS = 60;

type Revalidador = (caminho: string, tipo?: "page" | "layout") => void;

/** Caminhos públicos que mostram (ou listam) o anúncio. Só aceita id no formato de uuid. */
export function caminhosDoAnuncio(id?: string | null): { caminho: string; tipo?: "page" }[] {
  // E33: a home ("/") também lista anúncios. Sem ela aqui (e sem revalidate), a home era gerada no build e um anúncio
  // pausado continuava nela até o próximo deploy.
  const lista: { caminho: string; tipo?: "page" }[] = [
    { caminho: "/" },
    { caminho: "/buscar" },
    { caminho: "/cidades/[cidade]", tipo: "page" },
    { caminho: "/cidades/[cidade]/[polo]", tipo: "page" },
    { caminho: "/imoveis-perto-de/[slug]", tipo: "page" },
    { caminho: "/proprietario/[id]", tipo: "page" },
    { caminho: "/sitemap.xml" },
  ];
  if (id && /^[0-9a-f-]{8,64}$/i.test(id)) lista.unshift({ caminho: `/imoveis/${id}` });
  return lista;
}

/** Invalida as páginas públicas do anúncio. Nunca derruba a ação que a chamou. */
export function revalidarAnuncio(id: string | null | undefined, revalidar: Revalidador): void {
  for (const { caminho, tipo } of caminhosDoAnuncio(id)) {
    try {
      revalidar(caminho, tipo);
    } catch {
      /* best-effort: o revalidate de 60 s cobre */
    }
  }
}
