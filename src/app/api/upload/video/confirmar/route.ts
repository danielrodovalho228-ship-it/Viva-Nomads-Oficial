import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consumirLimite, DIA } from "@/lib/limites";
import { validarVideoNoServidor } from "@/lib/video-anuncio";

const BUCKET = "anuncio-videos";

/**
 * Confere no SERVIDOR o vídeo do anúncio que o navegador já enviou direto ao bucket (ordem 8681ae95, parte 1).
 * O corpo não passa pela função (50 MB estouraria o limite da Vercel); aqui só se baixa o que o dono mesmo enviou,
 * confere tipo real, tamanho e duração (até 60 s) e APAGA o arquivo se for recusado. Só a pasta do próprio dono.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Envio indisponível no modo demonstração." }, { status: 503 });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta para enviar vídeo." }, { status: 401 });

  if (!(await consumirLimite(`video-confirmar:${user.id}`, 60, DIA))) {
    return NextResponse.json({ error: "Muitos envios de vídeo hoje. Tente novamente amanhã." }, { status: 429 });
  }

  const corpo = (await request.json().catch(() => null)) as { path?: unknown } | null;
  const path = typeof corpo?.path === "string" ? corpo.path : "";
  const pasta = `${user.id}/`;
  if (!path.startsWith(pasta) || path.length > 200 || path.slice(pasta.length).includes("/") || path.includes("..")) {
    return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 400 });
  }

  const { data: arquivo, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !arquivo) return NextResponse.json({ error: "Vídeo não encontrado." }, { status: 404 });

  const resultado = validarVideoNoServidor(new Uint8Array(await arquivo.arrayBuffer()), arquivo.size);
  if (!resultado.ok) {
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: resultado.erro }, { status: 415 });
  }
  return NextResponse.json({ path, segundos: resultado.segundos });
}
