import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { carregarProvas } from "@/lib/data/contrato-provas";
import { conteudoPacoteProvas, nomeArquivoProvas } from "@/lib/contrato-provas";
import { gerarPdf } from "@/lib/fiscal/pdf";

export const dynamic = "force-dynamic";

/**
 * Pacote de provas do contrato em PDF (ordem 283d8001). Só as duas partes: a leitura inteira passa pelo RLS da
 * pessoa, e quem não é parte recebe 404. Nada é gravado; o PDF é montado na hora e não fica em cache.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Entre na sua conta." }, { status: 401 });
  const dados = await carregarProvas(id);
  if (!dados) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  const pdf = await gerarPdf(conteudoPacoteProvas(dados));
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${nomeArquivoProvas(dados.contratoId)}"`,
      "cache-control": "private, no-store",
    },
  });
}
