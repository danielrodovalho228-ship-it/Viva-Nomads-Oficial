import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Prompt 62-B2 — o PDF do laudo VIS (o mesmo arquivo registrado, com o hash do /conferir). A leitura passa pela RLS de
 * vistoria_laudos (dono, avaliador do laudo ou admin com duas etapas); quem não pode ler recebe 404.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  const { data: l } = await supabase.from("vistoria_laudos").select("numero, versao, pdf_path").eq("id", id).maybeSingle();
  if (!l?.pdf_path) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const { data: arq } = await admin.storage.from("avaliacao-imovel").download(l.pdf_path as string);
  if (!arq) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  return new NextResponse(Buffer.from(await arq.arrayBuffer()), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${String(l.numero)}${Number(l.versao) > 1 ? `-v${l.versao}` : ""}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
