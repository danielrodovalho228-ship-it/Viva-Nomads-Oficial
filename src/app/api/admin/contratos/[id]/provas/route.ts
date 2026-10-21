import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/data/admin-guard";
import { logModeracao } from "@/lib/data/moderacao-log";
import { carregarContratoAdmin } from "@/lib/data/contrato-admin";
import { conteudoPacoteProvas, nomeArquivoProvas } from "@/lib/contrato-provas";
import { gerarPdf } from "@/lib/fiscal/pdf";

export const dynamic = "force-dynamic";

/**
 * Pacote de provas gerado pela EQUIPE (admin › contrato, Prompt 35B F5): a mesma montagem do pacote das partes
 * (#901), com a linha "Gerado pela equipe Viva Nomads em …". Só admin com AAL2 (ehAdmin no servidor); quem não é
 * admin recebe 404, sem saber se o contrato existe. Nada fica em cache; o download entra no registro de moderação.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !(await ehAdmin(supabase, user.id))) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  const c = await carregarContratoAdmin(id);
  if (!c) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });
  const pdf = await gerarPdf(conteudoPacoteProvas({ ...c.provas, geradoPelaEquipeEm: new Date().toISOString() }));
  await logModeracao(supabase, user.id, "baixar_pacote_provas", "contrato", id);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${nomeArquivoProvas(id)}"`,
      "cache-control": "private, no-store",
    },
  });
}
