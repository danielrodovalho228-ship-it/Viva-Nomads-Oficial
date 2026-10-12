import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoQualificarSemImovel } from "@/lib/destino-login";
import QualificarClient from "./qualificar-client";

/**
 * A qualificação é a pendência da etapa Revisão de UM imóvel (`?imovel=<id>`).
 * Sem o parâmetro, quem chega aqui (link antigo, favorito, botão esquecido)
 * começa pelo cadastro pelas Fotos — o dono novo nunca abre o questionário antes.
 */
export default async function QualificarPage({
  searchParams,
}: {
  searchParams: Promise<{ imovel?: string | string[] }>;
}) {
  const { imovel } = await searchParams;
  const id = Array.isArray(imovel) ? imovel[0] : imovel;
  if (!id) {
    // Sem ?imovel (ex.: o link perdeu a query): quem já tem rascunho volta para a
    // lista e não perde o fluxo; quem não tem começa o cadastro.
    let temRascunho = false;
    const supabase = await createClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (supabase && user) {
      const { data } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", user.id)
        .eq("status", "draft")
        .limit(1);
      temRascunho = (data?.length ?? 0) > 0;
    }
    redirect(destinoQualificarSemImovel(temRascunho));
  }
  return <QualificarClient />;
}
