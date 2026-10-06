import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { urlAssinadaDoDocumento } from "@/lib/fiscal/emitir";

/**
 * Baixa o PDF de um documento (recibo, comprovante, termo). A leitura passa
 * pelo RLS da pessoa: só as partes do contrato (e o admin) acham a linha. O
 * PDF sai do bucket PRIVADO por URL assinada de 10 minutos.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Documento inválido." }, { status: 400 });
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const { data: doc } = await supabase.from("documentos_fiscais").select("pdf_path").eq("id", id).maybeSingle();
  if (!doc) return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  const url = await urlAssinadaDoDocumento(doc.pdf_path as string);
  if (!url) return NextResponse.json({ error: "Não foi possível gerar o link agora." }, { status: 503 });
  return NextResponse.redirect(url, 302);
}
