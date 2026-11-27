import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehAdmin } from "@/lib/data/admin-guard";
import { motivoSemLaudo, podeLerLaudo } from "@/lib/vistoria/leitura-do-laudo";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Quem não pode ler (ou pede um laudo que não existe) recebe o mesmo 404: a rota não diz se o laudo existe. */
const naoEncontrado = () => NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: { "cache-control": "private, no-store" } });

/**
 * Prompt 62-B2 — o PDF do laudo VIS (o mesmo arquivo registrado, com o hash do /conferir). Lê o dono do imóvel, o
 * avaliador do laudo e o admin com as duas etapas; quem não pode ler recebe 404.
 * E1121 (ORDEM-DUET-523): a permissão é decidida AQUI, com a mesma regra que abre a Central (ehAdmin: papel admin e a
 * sessão com as duas etapas), e não mais pela leitura da tabela com a sessão da pessoa. Antes, a Central listava o
 * laudo (lista lida pelo servidor) e o link podia responder "Não encontrado." à mesma conta, porque as duas portas
 * conferiam a permissão por caminhos diferentes. Cada 404 deixa UM motivo no log do servidor (sem id de pessoa).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  if (!UUID.test(id)) return naoEncontrado();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return naoEncontrado();

  const { data: l, error } = await admin
    .from("vistoria_laudos")
    .select("numero, versao, pdf_path, owner_id, avaliadores_credenciamento(parceiros(user_id))")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[laudo] leitura", error.message);
    return NextResponse.json({ error: "Indisponível." }, { status: 503 });
  }
  const contaDoAvaliador = (l?.avaliadores_credenciamento as unknown as { parceiros: { user_id: string | null } | null } | null)?.parceiros?.user_id ?? null;
  const pode = !!l && podeLerLaudo({ leitor: user.id, dono: l.owner_id as string | null, contaDoAvaliador, admin: await ehAdmin(supabase, user.id) });
  const arquivo = pode && l?.pdf_path ? await admin.storage.from("avaliacao-imovel").download(l.pdf_path as string) : null;
  const motivo = motivoSemLaudo({ existe: !!l, pode, temCaminho: !!l?.pdf_path, baixou: !!arquivo?.data });
  if (motivo) {
    console.warn(`[laudo] 404 ${motivo} laudo=${id}`);
    return naoEncontrado();
  }
  return new NextResponse(Buffer.from(await arquivo!.data!.arrayBuffer()), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${String(l!.numero)}${Number(l!.versao) > 1 ? `-v${l!.versao}` : ""}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
