import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { destinoPublicar } from "@/lib/anuncio/destino-pendencia";

/**
 * E433 (02/11): destino ÚNICO do botão "Publicar meu anúncio" dos e-mails. Decide no clique, pelo status de agora (pode
 * ter mudado desde o envio): rascunho → Revisão do assistente (Publicar ali); fora do cadastro → editor (Publicar no
 * topo). Lê o imóvel pela sessão (RLS: só o do dono); sem imóvel → Meus anúncios.
 */
export default async function PublicarAnuncioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  let status: string | null = null;
  let achou = false;
  if (supabase) {
    const { data } = await supabase.from("properties").select("id, status").eq("id", id).maybeSingle();
    achou = !!data;
    status = (data?.status as string | null) ?? null;
  }
  redirect(achou ? destinoPublicar({ id, status }) : "/dashboard/imoveis");
}
