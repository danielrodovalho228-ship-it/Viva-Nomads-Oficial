import { listMyProperties } from "@/lib/data/properties";
import { createClient } from "@/lib/supabase/server";
import { prontidaoDosImoveis } from "@/lib/anuncio/prontidao-servidor";
import type { Prontidao } from "@/lib/anuncio/prontidao";
import { MyPropertiesClient } from "./imoveis-client";

/**
 * "Meus imóveis": o servidor busca a lista REAL do proprietário e a prontidão de
 * cada anúncio (fonte única: lib/anuncio/prontidao); a renderização fica no
 * client (imoveis-client), que suporta o modo demonstração do admin.
 */
export default async function MyPropertiesPage() {
  const properties = await listMyProperties();
  const prontidao: Record<string, Prontidao> = {};
  const supabase = await createClient();
  if (supabase && properties.length) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const mapa = await prontidaoDosImoveis(supabase, user.id, properties.map((p) => p.id));
      for (const [id, pr] of mapa) prontidao[id] = pr;
    }
  }
  return <MyPropertiesClient properties={properties} prontidao={prontidao} />;
}
