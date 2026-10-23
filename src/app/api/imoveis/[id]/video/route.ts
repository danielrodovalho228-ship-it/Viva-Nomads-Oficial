import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "anuncio-videos";
const SEGUNDOS = 600;

/**
 * Endereço temporário (10 min) do vídeo de um anúncio PUBLICADO (ordem 8681ae95). A página só chama no clique em
 * "play", então o arquivo não pesa no celular e o link nunca fica velho no cache da página. Quem autoriza é o banco:
 * sem leitura do anúncio ou do arquivo (rascunho/pausado de outro dono), a política do bucket nega e a resposta é 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Vídeo indisponível no modo demonstração." }, { status: 503 });

  const { data: imovel } = await supabase.from("properties").select("video_arquivo").eq("id", id).eq("status", "active").maybeSingle();
  const path = (imovel as { video_arquivo?: string | null } | null)?.video_arquivo;
  if (!path) return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 });

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SEGUNDOS);
  if (error || !data?.signedUrl) return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 });
  return NextResponse.json({ url: data.signedUrl }, { headers: { "cache-control": "no-store" } });
}
