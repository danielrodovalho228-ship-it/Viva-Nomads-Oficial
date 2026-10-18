import { listMyProperties } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";
import { prontidaoDosImoveis } from "@/lib/anuncio/prontidao-servidor";
import type { Prontidao } from "@/lib/anuncio/prontidao";
import { meusPedidosDeAjuda } from "@/lib/data/ajuda-publicacao-actions";
import { ROTULO_STATUS } from "@/lib/ajuda-publicacao/ajuda";
import { MyPropertiesClient } from "./imoveis-client";

/**
 * "Meus imóveis": o servidor busca a lista REAL do proprietário e a prontidão de
 * cada anúncio (fonte única: lib/anuncio/prontidao); a renderização fica no
 * client (imoveis-client), que suporta o modo demonstração do admin.
 */
export default async function MyPropertiesPage() {
  // A lista e o usuário não dependem um do outro: busca os dois juntos (ordem 0f66a754, item 4).
  const [properties, supabase, ajudas] = await Promise.all([listMyProperties(), createClient(), meusPedidosDeAjuda()]);
  const prontidao: Record<string, Prontidao> = {};
  if (supabase && properties.length) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const mapa = await prontidaoDosImoveis(supabase, user.id, properties.map((p) => p.id));
      for (const [id, pr] of mapa) prontidao[id] = pr;
    }
  }
  return (
    <>
      {ajudas.length > 0 && (
        <section className="mb-4 rounded-2xl border border-sage-200 bg-sage-50 p-4 text-sm text-forest" data-testid="ajuda-andamento">
          <h2 className="font-medium text-ink">Publicamos para você</h2>
          <ul className="mt-1 space-y-0.5">
            {ajudas.map((a) => (
              <li key={a.id}>
                Pedido de {new Date(a.criado_em).toLocaleDateString("pt-BR")}: <strong>{ROTULO_STATUS[a.status]}</strong>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-muted">Nada vai ao ar sem a sua aprovação.</p>
        </section>
      )}
      <MyPropertiesClient properties={properties} prontidao={prontidao} />
    </>
  );
}
